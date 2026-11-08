"""Compare presentation edits with an explicit baseline; never executes app code."""
import argparse, hashlib, json, re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.nodes=[]; self.inline_scripts=[]; self.scripts=[]; self.links=[]; self.styles=[]
        self.mode=None; self.buf=[]
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.nodes.append((tag,a,self.getpos()[0]))
        if tag=='script':
            if a.get('src'): self.scripts.append(a['src'])
            else: self.mode='script'; self.buf=[]
        if tag=='link' and a.get('rel')=='stylesheet': self.links.append(a.get('href'))
        if tag=='style': self.mode='style'; self.buf=[]
    def handle_endtag(self, tag):
        if tag==self.mode:
            if tag=='script': self.inline_scripts.append(hashlib.sha256(''.join(self.buf).encode()).hexdigest())
            else: self.styles.append(''.join(self.buf))
            self.mode=None
    def handle_data(self, text):
        if self.mode:self.buf.append(text)
    def protected(self):
        return Counter((t,tuple(sorted((k,v) for k,v in a.items() if k in ('id','name') or k.startswith(('on','aria-','data-'))))) for t,a,_ in self.nodes if any(k in ('id','name') or k.startswith(('on','aria-','data-')) for k in a))
    def inventory(self):
        inline=[{'line':line,'tag':t,**{k:a[k] for k in ('id','class','style') if k in a}} for t,a,line in self.nodes if 'style' in a]
        css=';\n'.join(self.styles+[x['style'] for x in inline])
        colors=Counter(x.lower() for x in re.findall(r'#[0-9a-fA-F]{3,8}\b',css))
        fonts=Counter(x.strip() for x in re.findall(r'font-size\s*:\s*([^;}]+)',css))
        radii=Counter(x.strip() for x in re.findall(r'border-radius\s*:\s*([^;}]+)',css))
        return {'inlineStyles':inline,'colors':dict(colors.most_common()),'fontSizes':dict(fonts.most_common()),'radii':dict(radii.most_common()),'counts':{'inlineStyles':len(inline),'colorKinds':len(colors),'fontSizeKinds':len(fonts),'radiusKinds':len(radii)}}

def main():
    p=argparse.ArgumentParser();p.add_argument('before');p.add_argument('after',nargs='?',default='index.html');p.add_argument('--out',default='docs/ui-polish');args=p.parse_args()
    old=Path(args.before).read_bytes().decode();new=Path(args.after).read_bytes().decode();a,b=Page(old),Page(new)
    ids=lambda p:Counter(x['id'] for _,x,_ in p.nodes if 'id' in x)
    onclick=lambda p:Counter(x['onclick'] for _,x,_ in p.nodes if 'onclick' in x)
    classes=lambda p:Counter(c for _,x,_ in p.nodes for c in x.get('class','').split())
    link='./ui-polish-v1.css?v=V8.7.1'
    text=lambda s:re.sub(r'\s+','',re.sub('<[^>]+>','',s.split('<body',1)[1].split('<script',1)[0]))
    # Original static text, including warnings, stays a subsequence after additions/reordering.
    words=lambda s:Counter(re.findall(r'[\u3400-\u9fffA-Za-z0-9／.]+',re.sub('<[^>]+>',' ',s.split('<body',1)[1].split('<script',1)[0])))
    checks={'idMultisetUnchanged':ids(a)==ids(b),'onclickMultisetUnchanged':onclick(a)==onclick(b),'protectedAttributesUnchanged':a.protected()==b.protected(),'originalClassesRetained':not(classes(a)-classes(b)),'inlineScriptsByteIdentical':a.inline_scripts==b.inline_scripts,'originalInlineStylesheetsByteIdentical':a.styles==b.styles,'existingScriptOrderAndVersionsUnchanged':a.scripts==b.scripts,'existingStylesheetOrderAndVersionsUnchanged':a.links==[x for x in b.links if x!=link],'newStylesheetLastInHead':Page(new.split('</head>')[0]).links[-1:]==[link],'staticWarningsAndTextRetained':not(words(old)-words(new)),'staticInlineStylesRemoved':not b.inventory()['inlineStyles']}
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    for name,page in [('before',a),('after',b)]: (out/(name+'-inventory.json')).write_text(json.dumps(page.inventory(),ensure_ascii=False,indent=2)+'\n')
    result={'checks':checks,'idCount':sum(ids(a).values()),'onclickCount':sum(onclick(a).values()),'inlineScriptBlocks':len(a.inline_scripts),'externalScriptCount':len(a.scripts),'existingStylesheets':len(a.links),'before':a.inventory()['counts'],'after':b.inventory()['counts']}
    (out/'contract.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
    assert all(checks.values()),checks
if __name__=='__main__':main()
