'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
test('effective GitHub Actions market updater checks exchange-calendar and completed snapshot',()=>{
 const effective=fs.readFileSync(path.join(root,'.github/workflows/update-market-snapshot.yml'),'utf8');
 const legacy=fs.readFileSync(path.join(root,'update-market-snapshot.yml'),'utf8');
 assert.equal(effective,legacy,'two market-update workflows diverged');
 assert.match(effective,/node --test scripts\/tests\/update-market-snapshot\.test\.mjs/);
 assert.match(effective,/node scripts\/verify-market-snapshot\.mjs/);
 assert.match(effective,/config\/verified-market-closures\.json/);
});
test('main-branch code commits trigger Worker contract tests',()=>{
 const src=fs.readFileSync(path.join(root,'.github/workflows/worker-contract-tests.yml'),'utf8');
 assert.match(src,/branches: \['main', 'codex\/\*\*'\]/);
 assert.match(src,/node scripts\/run-all-tests\.cjs/);
});
