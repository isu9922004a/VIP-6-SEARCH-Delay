'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const normalize = value => String(value).replace(/\r\n?/g, '\n');
const shared = normalize(fs.readFileSync(path.join(root, 'worker-data-contract-v1.js'), 'utf8')).trimEnd() + '\n';
const begin = '// BEGIN EMBEDDED DAILY CONTRACT\n';
const end = '// END EMBEDDED DAILY CONTRACT\n';
for (const name of ['stock-worker.mjs', 'market-worker.mjs']) {
  const file = path.join(root, name);
  const old = fs.readFileSync(file, 'utf8');
  let payload = normalize(old);
  // Remove every previously embedded header (including older CRLF copies).
  while (payload.startsWith(begin)) {
    const endAt = payload.indexOf(end);
    if (endAt === -1) throw new Error(`Incomplete embedded contract in ${name}`);
    payload = payload.slice(endAt + end.length);
  }
  const rebuilt = begin + shared + '\n' + end + payload;
  if (normalize(old) !== rebuilt) fs.writeFileSync(file, rebuilt);
}
