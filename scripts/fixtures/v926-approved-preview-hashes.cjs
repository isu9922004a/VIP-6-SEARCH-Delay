'use strict';
const worker = require('./v924-approved-worker-hashes.cjs');
// V9.26 replaces only the existing preview, page navigation and sharing paths.
// Keep the old fixture bytes and protect the exact approved replacement bytes.
const revisions = Object.freeze({
  'kline-life-03-viewer-v94.js': Object.freeze({
    before: 'c7cfb756e6e77759673ca40145291293d9973cb809db615a5c7c8efa38972fc9',
    after: 'e8c2006807f997ca9ce3f7a153e92afcc55c64e9af1f6bcc6bd80a3eff1cea42'
  }),
  'mobile-image-share-v1.js': Object.freeze({
    before: 'e220674d08a1bc636953e7806f09c725e79db2ec72284609dde0085f11074f41',
    after: '1311a4f1b8343261447a705ff228abe643739976ef8a46613b6abac1ca1ba0cf'
  }),
  'index.html inline scripts': Object.freeze({
    before: '89f417047f22293b28f9fcf12219525cd94616afeea699af5990af9a95a0606c',
    after: '65187bcd440600f7d8aa121dbb49be8aa52bbef821d4176e3b9a1910c4b51107'
  })
});
function expected(name, hash) {
  const revision = revisions[name];
  return revision && hash === revision.before ? revision.after : worker.expected(name, hash);
}
module.exports = Object.freeze({expected});
