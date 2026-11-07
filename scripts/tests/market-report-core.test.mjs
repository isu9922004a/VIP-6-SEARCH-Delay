import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {buildTaiexReportFromHistory as build} from '../../market-worker.mjs';
const input=fs.readFileSync(new URL('../fixtures/market-abc-20261105.json',import.meta.url)),fixture=JSON.parse(input),baseline=JSON.parse(fs.readFileSync(new URL('../fixtures/market-core-baseline-v87.json',import.meta.url)));
test('shared Worker calculator preserves every original result on the same dated historical window',()=>{
 assert.equal(crypto.createHash('sha256').update(input).digest('hex'),baseline.inputSha256);const before=JSON.stringify(fixture),result=build({rows:fixture.dailySeries,dailySeries:fixture.dailySeries,dailySeriesMeta:fixture.dailySeriesMeta});assert.deepEqual(result,baseline.expected);assert.equal(JSON.stringify(fixture),before);
});
test('calculator refuses short or unordered histories rather than filling missing prices',()=>{assert.throws(()=>build({rows:fixture.dailySeries.slice(-30)}),/日線不足/);assert.throws(()=>build({rows:fixture.dailySeries.toReversed()}),/日期/);});
