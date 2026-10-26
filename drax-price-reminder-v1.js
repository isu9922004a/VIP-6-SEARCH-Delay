/* DRAX reference card only. No notification, order or research-state mutations. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.ShitouDraxPriceReminder=api;})(globalThis,function(root){
'use strict';
const FIELDS=Object.freeze([{key:'above',label:'價格高於',unit:'元'},{key:'below',label:'價格低於',unit:'元'},{key:'gain',label:'單日漲幅超過',unit:'%'},{key:'loss',label:'單日跌幅超過',unit:'%'}]);
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>0?x:null;
const fmt=x=>num(x)===null?'未填':String(Number(x.toFixed(2)));
function build(analysis){
 const a=analysis||{},c=a.tradeContext,z=a.sourceBars?.at(-1),valid=a.validation?.technicalModelAvailable===true&&num(z?.close)!==null,close=valid?z.close:null;
 const pressure=valid?(c?.pressures||[]).filter(x=>num(x.price)!==null&&x.price>close&&!/待核/.test(x.kind)).sort((x,y)=>x.price-y.price)[0]:null;
 const above=pressure?.price??(valid&&z.high>close?z.high:null),bp=c?.breakout?.price;
 const support=valid&&num(bp)!==null&&bp<close?bp:valid&&z.low<close?z.low:null;
 return {schema:'DRAX_PRICE_REMINDER_1',code:String(a.code||''),name:String(a.name||a.code||''),date:a.date||null,close,
  rows:FIELDS.map(f=>({...f,value:{above,below:support,gain:5,loss:5}[f.key],enabled:false,
   basis:f.key==='above'?pressure?.kind||(above!==null?'當日高點':'請自行填入'):
    f.key==='below'?support===null?'請自行填入':support===bp?'近期突破參考':'當日低點':'可自行調整'})),
  note:'對照設定用；請在 DRAX 手動填入並開啟通知。'};
}
function validate(model){
 for(const row of model.rows){if(row.value!==null&&(num(row.value)===null||Math.round(row.value*100)/100!==row.value))return `${row.label}請輸入大於0、最多兩位小數的數值`;if(row.enabled&&num(row.value)===null)return `${row.label}需先填入數值才能標記開啟`;if((row.key==='gain'||row.key==='loss')&&row.value!==null&&row.value>100)return `${row.label}請輸入100%以內`;}
 return null;
}
function round(ctx,x,y,w,h,r=24){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function fit(ctx,text,width,size,weight=700){let n=size;do{ctx.font=`${weight} ${n}px "Microsoft JhengHei",sans-serif`;if(ctx.measureText(text).width<=width)return n;n-=2;}while(n>=24);return n;}
function canvasFor(model,doc=root.document){
 const canvas=doc.createElement('canvas');canvas.width=1080;canvas.height=1510;const x=canvas.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,1080,1510);x.fillStyle='#111';fit(x,`${model.name} ${model.code}`,960,76,850);x.fillText(`${model.name} ${model.code}`,60,108);
 x.font='750 42px "Microsoft JhengHei",sans-serif';x.fillText('DRAX 價格對應提醒',60,184);
 x.fillStyle='#555';x.font='500 31px "Microsoft JhengHei",sans-serif';x.fillText(`行情 ${model.date||'待核對'}｜${model.close===null?'價格待核對':'收盤 '+fmt(model.close)+' 元'}`,60,240);
 x.fillText('對照下列欄位，在 DRAX 設定通知。',60,302);
 x.fillStyle='#f2f2f3';round(x,42,348,996,892,40);x.fill();
 model.rows.forEach((row,i)=>{const y=365+i*214;
  if(i){x.strokeStyle='#d9d9db';x.lineWidth=2;x.beginPath();x.moveTo(76,y-9);x.lineTo(1004,y-9);x.stroke();}
  x.fillStyle='#171717';fit(x,row.label,410,48,600);x.fillText(row.label,82,y+76);
  x.fillStyle='#e2e2e5';round(x,514,y+25,270,112,24);x.fill();x.fillStyle=row.value===null?'#888':'#111';fit(x,fmt(row.value),230,58,600);x.textAlign='right';x.fillText(fmt(row.value),758,y+101);x.textAlign='left';
  x.font='500 32px sans-serif';x.fillStyle='#333';x.fillText(row.unit,797,y+98);
  x.fillStyle=row.enabled?'#35a864':'#d2d2d5';round(x,870,y+38,126,76,38);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(row.enabled?957:909,y+76,31,0,Math.PI*2);x.fill();
  x.fillStyle='#666';fit(x,`${row.enabled?'圖卡標記：開啟':'圖卡標記：關閉'}｜${row.basis}`,900,28,500);x.fillText(`${row.enabled?'圖卡標記：開啟':'圖卡標記：關閉'}｜${row.basis}`,82,y+178);
 });
 x.fillStyle='#454545';x.font='650 32px "Microsoft JhengHei",sans-serif';x.fillText('此圖不會自動啟用 DRAX 通知。',60,1312);
 x.font='500 29px "Microsoft JhengHei",sans-serif';x.fillText('價格開關與通知是否生效，請到 DRAX 確認。',60,1370);
 x.fillStyle='#777';x.font='500 27px "Microsoft JhengHei",sans-serif';x.fillText('四策略研究｜個股提醒對照圖',60,1452);
 canvas.dataset.draxAudit=JSON.stringify(model);return canvas;
}
let current=null,serial=0;
function clear(){serial++;if(!current)return;if(current.url)root.URL.revokeObjectURL(current.url);current.dialog.remove();current.opener?.focus?.();current=null;}
function supported(file){try{return typeof root.navigator?.share==='function'&&typeof root.navigator?.canShare==='function'&&root.navigator.canShare({files:[file]});}catch(_){return false;}}
function open(analysis,opener){
 clear();const doc=root.document,model=build(analysis),dialog=doc.createElement('dialog');dialog.className='drax-reminder-dialog';dialog.setAttribute('aria-label','DRAX 價格對應提醒');
 const e=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const header=e('div');header.className='drax-reminder-header';const title=e('h2',`${model.name} ${model.code}`),close=e('button','關閉');close.type='button';close.onclick=clear;header.append(title,close);dialog.append(header,e('h3','DRAX 價格對應提醒'),e('p','依目前個股查詢結果帶入，可調整後製作圖片。'),e('p','下列開關只標記圖卡設定；請在 DRAX 手動填入並開啟通知。'));
 const rows=e('div');rows.className='drax-reminder-rows';const controls=[];
 model.rows.forEach((row,i)=>{const field=e('div');field.className='drax-reminder-row';const id=`drax-reminder-${row.key}`,label=e('label',row.label),input=e('input'),unit=e('span',row.unit),toggle=e('input'),switchLabel=e('label'),basis=e('small',row.basis);label.htmlFor=id;input.id=id;input.type='number';input.min='0.01';input.step='0.01';input.inputMode='decimal';input.placeholder='價格';input.value=row.value??'';if(row.key==='gain'||row.key==='loss'){input.max='100';input.placeholder='百分比';}toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',row.label+'圖卡標記');switchLabel.className='drax-reminder-switch';const switchText=e('span','圖卡關閉');switchLabel.append(toggle,switchText);field.append(label,input,unit,switchLabel,basis);rows.append(field);controls.push({input,toggle,row,basis,switchText,initialValue:row.value,initialBasis:row.basis});input.oninput=toggle.onchange=()=>update();});dialog.append(rows);
 const actions=e('div');actions.className='drax-reminder-actions';const share=e('button','分享到 LINE'),save=e('a','儲存個股提醒圖片'),preview=e('details'),image=e('img'),status=e('p');share.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');preview.append(e('summary','預覽個股提醒圖片'),image);image.alt=`${model.name} ${model.code} DRAX 價格對應提醒`;image.className='drax-reminder-image';actions.append(share,save);dialog.append(actions,status,preview);doc.body.append(dialog);
 current={dialog,opener,model,url:null,file:null,busy:false};const selected=current;
 dialog.oncancel=event=>{event.preventDefault();clear();};dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)clear();}});
 async function update(){
  const token=++serial;selected.file=null;share.disabled=true;save.removeAttribute('href');save.removeAttribute('download');image.removeAttribute('src');
  if(selected.url){root.URL.revokeObjectURL(selected.url);selected.url=null;}
  for(const c of controls){const raw=c.input.value.trim();c.row.value=raw===''?null:Number(raw);c.row.enabled=c.toggle.checked;c.row.basis=c.row.value===c.initialValue?c.initialBasis:'自行輸入';c.basis.textContent=c.row.basis;c.switchText.textContent=c.row.enabled?'圖卡開啟':'圖卡關閉';}
  const error=controls.find(c=>c.input.validity.badInput)?'請輸入有效數值':validate(model);if(error){status.textContent=error;return;}
  status.textContent='正在準備個股提醒圖片…';
  try{if(doc.fonts?.ready)await doc.fonts.ready;if(current!==selected||token!==serial)return;const canvas=canvasFor(model,doc);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('圖片轉換失敗')),'image/png'));canvas.width=canvas.height=1;
   if(current!==selected||token!==serial)return;selected.file=new File([blob],`DRAX_${model.code}_${String(model.date||'').replaceAll('-','')}.png`,{type:'image/png'});selected.url=root.URL.createObjectURL(blob);save.href=selected.url;save.download=selected.file.name;image.src=selected.url;share.disabled=selected.busy;status.textContent=supported(selected.file)?'圖片已備妥。按分享到 LINE 後，在系統分享選單選 LINE。':'圖片已備妥。此瀏覽器請先儲存圖片，再從 LINE 相簿傳送。';
  }catch(error){if(current===selected&&token===serial)status.textContent='圖片準備未完成，請重新開啟：'+error.message;}
 }
 share.onclick=async()=>{
  if(current!==selected||!selected.file||selected.busy)return;
  if(!supported(selected.file)){preview.open=true;status.textContent='請點「儲存個股提醒圖片」，再從 LINE 相簿傳送；也可長按預覽圖儲存。';return;}
  selected.busy=true;share.disabled=true;
  try{const result=root.navigator.share({files:[selected.file]});await result;if(current===selected)status.textContent='已開啟系統分享；請在 LINE 確認是否送出。';}
  catch(error){if(current===selected)status.textContent=error?.name==='AbortError'?'已取消分享，可再次點擊。':'分享未完成，請儲存圖片後從 LINE 相簿傳送。';}
  finally{selected.busy=false;if(current===selected)share.disabled=!selected.file;}
 };
 dialog.showModal();update();return dialog;
}
return Object.freeze({build,validate,canvasFor,open,clear,getCurrent:()=>current&&({model:structuredClone(current.model),ready:!!current.file,filename:current.file?.name})});
});
