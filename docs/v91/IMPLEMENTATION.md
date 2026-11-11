# 石頭少爺 V9.1 — 2560戰法｜25日均線突破

## Scope and rollback
Based on main d161750435db88b4853b40c96c6b5db87c32c0fe, which already contains V9.0 PR #33. Fifth-filter implementation only: the archived restaurant engine, the other five engines, postclose data, official histories, Worker APIs and market guards remain unchanged. The visible strategy remains "2560"; the new model ID 2560-STRATEGY-V2.0 and cache V9.1-2560-CORE2 explicitly reject V9.0 candidate snapshots.

## Selection (all required)
- #9041: previous completed close <= previous completed SMA25, and today's completed close > today's completed SMA25; no intraday or continuing-above signal.
- #9012 (PARTIAL RECONSTRUCTION): average volume for the latest 5 completed sessions > the average volume for the latest 60 completed sessions, using consistent shares. The three other original daily-volume periods are **not verified** and are not guessed. Every passing report displays 「#9012量能規則部分還原，待確認」.
- #533: today's SMA5 > today's SMA40. Does not require a crossing today.

Status is PASS only if all gates pass, FAIL if a confirmed gate fails, INSUFFICIENT_DATA for missing/unfinished history, and DATA_ERROR for malformed/mismatched records. At least 60 completed sessions are required. Normal existing EXCLUDED coverage stays separate.

Removed previous required SMA5/SMA40 fresh cross, SMA5 and SMA25 both rising, automatic MA5 downturn exclusion, MA5-based exit warning. The fifth filter does not place an exit order or define an exit strategy. No other filter's exit rule changes.

## Risk (read-only)
MA5 distance, MA25 breakout magnitude, VMA5/VMA60, latest daily volume, current volume versus VMA60, upper-shadow ratio, candle body ratio, previous 20 high, near-peak warning and moving-average support observation. All are explicit non-gating, heuristic warnings; 3%/6%, 2x daily volume, 40% shadow and 3% peak proximity are not backtested performance claims. Never interpret breakoutPct as next-day profit.

## UI, render and cache
Fifth strategy's position/control IDs remain the same; Top8 includes only current PASS rows, sorted by code not strength. Empty full scan versus incomplete scan differ. Read-only K-line research remains independent. Common renderer produces 1284px width pages plus watermarked export; LINE native share functionality remains unchanged. The homepage, global release object, UI, audit labels and image prefix are V9.1; cache query is distinct from V9.0. Historical data records are untouched.

## Verification gates
- Run npm test, npm run test:contract and scripts/audit-v90-universe.cjs against the latest complete production snapshot.
- Browser report images: scripts/tests/v90-browser.cjs, existing browsers, current market date. No fabricated PASS candidates in production; synthetic fallback is only a clearly segregated *test preview*.
- On merge into main, existing official workflows deploy current main contents; verify shipped bytes and the live browser before declaring release complete.
- If checks fail, do not merge or deploy. To roll back frontend code, safely revert this PR's changes while retaining all intervening market data/receipts; never reset main/force-push or reuse old cached candidate snapshots.

## Pending evidence
Original #9012 trailing three volume comparisons have unknown periods. Therefore the strategy reproduces only the verified sub-rule, not the complete original screenshot.
