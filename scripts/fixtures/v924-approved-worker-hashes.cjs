'use strict';
// Only the two explicitly authorized Worker performance changes may supersede
// the historical whole-file baselines. All unrelated engine hashes stay intact.
const revisions=Object.freeze({
  'stock-worker.mjs':Object.freeze({before:'c2a54599efcb65b20bdfb12e169977ed333dbfd7cff24e4149522a0a5113fe9c',after:'318605ebc56b7e5f5a99f6e7addf7a4d7982be83598d5eb7b76e29095ea44f17'}),
  'market-worker.mjs':Object.freeze({before:'2342df059ecdf563246bacacdadaf2240685b5c8104498439c51d599f00e59d5',after:'620a2b459df6c142e69fd48d5d9964632f2961f63610e713b8a51e393904fd00'})
});
function expected(name,hash){const row=revisions[name];return row&&hash===row.before?row.after:hash;}
module.exports=Object.freeze({expected,revisions});
