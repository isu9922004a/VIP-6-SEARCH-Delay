'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../research-integration-v1.js'),'utf8');
test('V9.2 life study fields cannot pollute existing exported report row DOM contract',()=>{
  const section=code.slice(code.indexOf('const life=root.ShitouKlineLife03Report?.inspect(a);'),code.indexOf('if(root.ShitouEngulfRangeReport)'));
  assert.match(section,/row\.className='research-life03-row'/);
  assert.match(section,/panel\.append\([^;]*lifeField\(lf\.summary\)\)/);
  assert.match(section,/panel\.append\(lifeField\(item\)\)/);
  assert.doesNotMatch(section,/panel\.append\([^;]*field\(lf\.summary\)\)/);
  assert.doesNotMatch(section,/panel\.append\(field\(item\)\)/);
  assert.match(code,/for\(const item of report\.details\)evidence\.append\(field\(item\)\)/);
});
