'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),cp=require('node:child_process');
const verifier=path.resolve(__dirname,'../verify-deployed-frontend.py');
function python(body){
 const setup=`import importlib.util, sys\nspec=importlib.util.spec_from_file_location('verifier',sys.argv[1])\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\n`;
 const result=cp.spawnSync(process.platform==='win32'?'python':'python3',['-B','-c',setup+body,verifier],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.error?.message||result.stdout);
}
test('deployment target follows the current repository, supports overrides, and refuses an unknown target',()=>{
 python(`
assert m.deployment_base({'GITHUB_REPOSITORY':'isu9922004a/VIP-BOWTOWER-6-SEARCH'}) == 'https://isu9922004a.github.io/VIP-BOWTOWER-6-SEARCH/'
assert m.deployment_base({'GITHUB_REPOSITORY':'isu9922004a/VIP-6-SEARCH-Delay'}) == 'https://isu9922004a.github.io/VIP-6-SEARCH-Delay/'
assert m.deployment_base({'GITHUB_REPOSITORY':'OtherOwner/renamed'}) == 'https://otherowner.github.io/renamed/'
assert m.deployment_base({'RESEARCH_BROWSER_ORIGIN':'https://preview.example/site','GITHUB_REPOSITORY':'owner/repo'}) == 'https://preview.example/site/'
for env in [{}, {'GITHUB_REPOSITORY':'invalid'}, {'GITHUB_REPOSITORY':'/repo'}]:
    try:
        m.deployment_base(env)
    except ValueError:
        pass
    else:
        raise AssertionError('Missing target must not silently select another website')
`);
});
test('deployed byte check uses the selected website and still rejects different bytes or HTTP errors',()=>{
 python(`
from unittest.mock import patch
import urllib.error
class Response:
    def __init__(self, raw): self.raw=raw
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return self.raw
base=m.deployment_base({'GITHUB_REPOSITORY':'isu9922004a/VIP-6-SEARCH-Delay'})
with patch('pathlib.Path.read_bytes',return_value=b'expected'):
    with patch.object(m.urllib.request,'urlopen',return_value=Response(b'expected')) as fetch:
        result=m.check('index.html',base)
        assert result['match'] is True
        assert fetch.call_args.args[0].full_url.startswith(base+'index.html?verify=')
    with patch.object(m.urllib.request,'urlopen',return_value=Response(b'old-version')):
        assert m.check('index.html',base)['match'] is False
    with patch.object(m.urllib.request,'urlopen',side_effect=urllib.error.HTTPError(base,404,'missing',{},None)):
        assert m.check('index.html',base)['match'] is False
`);
});
