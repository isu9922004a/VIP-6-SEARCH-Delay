'use strict';
const {test}=require('node:test'),cp=require('node:child_process'),path=require('node:path');
test('future validation preserves all valid closing paths while refusing invalid closes and synthetic candles',()=>{
 cp.execFileSync('python3',[path.join(__dirname,'future-output-quality.py')],{stdio:'pipe'});
});
