'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const workerFile = pathToFileURL(path.resolve(__dirname, '../../workers/stock-worker.mjs')).href;
test('Taipei Monday just after midnight is included, rather than UTC Sunday', async()=>{
 const {assistantRecentDatesV47:dates}=await import(workerFile);
 const xs=dates(4,new Date('2026-10-25T16:30:00.000Z'));
 assert.deepEqual(xs,['2026-10-26','2026-10-23']);
});
test('Taipei Saturday just after midnight is excluded, rather than UTC Friday', async()=>{
 const {assistantRecentDatesV47:dates}=await import(workerFile);
 const xs=dates(4,new Date('2026-10-23T16:30:00.000Z'));
 assert.deepEqual(xs,['2026-10-23','2026-10-22','2026-10-21']);
});
test('Same Taipei civil day yields the same five weekday dates regardless of UTC hour', async()=>{
 const {assistantRecentDatesV47:dates}=await import(workerFile);
 assert.deepEqual(dates(9,new Date('2026-10-25T16:30:00.000Z')),dates(9,new Date('2026-10-26T04:30:00.000Z')));
});
