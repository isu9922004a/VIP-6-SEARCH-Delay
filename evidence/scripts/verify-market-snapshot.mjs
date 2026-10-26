#!/usr/bin/env node
// Post-update gate: a green GitHub Action must mean an actually valid snapshot.
import { readFileSync } from 'node:fs';
import { verifyMarketSnapshotCoverage, verifySnapshotAdvancement } from './update-market-snapshot.mjs';

try {
  const snapshot=JSON.parse(readFileSync('data/market/latest.json','utf8'));
  const coverage=verifyMarketSnapshotCoverage(snapshot);
  const audit=verifySnapshotAdvancement(snapshot,null);
  console.log(`VERIFIED_SNAPSHOT: ${JSON.stringify({ ...coverage, ...audit })}`);
} catch (error) {
  console.error(`SNAPSHOT_VERIFICATION_FAILED: ${error?.stack || error}`);
  process.exitCode=1;
}
