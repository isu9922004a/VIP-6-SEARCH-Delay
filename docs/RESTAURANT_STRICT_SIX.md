# Restaurant strategy: six required conditions

The frontend remains V8.5. The restaurant model is `RESTAURANT_STRICT_6_1`; legacy balanced-observation candidates cannot be exported as strict matches.

All six conditions must be verified true on the same completed trading session:

| Rule | Gate |
| --- | --- |
| #904 | Today's close equals a verified same-day exchange limit-up price; a touch or an estimate is insufficient. |
| #9072 | Same-day main-broker net-buy volume / total volume is strictly greater than 5%. |
| #932 | Today's volume is strictly below the rolling five-bar average, including today. |
| #9291 | Today's close is strictly above verified JMA20; no crossing, three-day slope, distance-band, SMA or EMA replacement. |
| #9091 | Same-day official turnover rank is at most 100; includes rank 100. |
| #802 | Today's CMF is strictly positive; this implementation explicitly uses a 20-bar CMF. |

The screenshot does **not** specify the source app's JMA formula/phase parameters, main-broker population, CMF period, whether the volume mean includes today, or the ranking universe. The declared implementation uses the combined TWSE/TPEx ordinary-share universe, a rolling-five-bar volume mean including today and CMF20. These choices are visible in the UI and reports and must still be reconciled with the other app before claiming identical results. In the user's November 2 comparison, all eight shown stocks ranked outside the combined ordinary-share turnover top 100; do not alter the ranking definition merely to reproduce that list.

`UNVERIFIED` is separate from `NOT_MATCH`, market-data failures and transport failures. Missing main-broker/JMA/official-limit records never count as true, and a missing-data run never claims that there are definitely zero matches. Additional extension, OBV, price-structure, industry, low-liquidity or monthly conditions do not decide admission. Risk messages remain advisory; sorting is turnover rank then ticker.

## Evidence contract

The existing `report.restaurantEvidence` transport accepts these source-backed records. Each record must have `verified:true`, matching `code`, `market`, `date`, and a nonempty `source`:

- `limits[]`: `limitUpPrice`, or `noPriceLimit:true` (which fails #904).
- `mainNetBuyShare`: `definition:"MAIN_NET_BUY_VOLUME_OVER_TOTAL_VOLUME"` and numeric `valuePct`.
- `jma20`: `period:20`, positive numeric `value`, and a nonempty `formulaId`.

Those records must be supplied by an actual provider; this change does not fabricate proprietary feeds or infer main-broker ownership from OHLCV. Existing published OHLCV archives alone lack those records, so they can leave otherwise promising stocks pending. The user-supplied JMA screenshot confirms rule #9291's comparator, not its underlying indicator formula.

Turnover ranking is verified against a complete same-date official market snapshot. If the current Worker lacks the legacy `commonStockUniverseVerified` flag, the restaurant UI cross-checks every row, official turnover, counts, date and snapshot identity against the deployed `data/market/latest.json`. Estimated turnover, stale/incomplete rows or mismatched identities cannot certify a rank. Known ranks above 100 fail without unnecessary deep requests; all such exclusions remain in the audit report.

## Verification

`node scripts/tests/restaurant-strict.test.cjs` tests every gate, strict equality boundaries, missing/stale/wrong-ticker inputs, no indicator substitution, one-day window enforcement, risk-only warnings, absence of unrelated exclusions, snapshot/condition binding, full-universe ranking and incomplete-data counts. Existing transport and mobile PNG-sharing checks are retained. `scripts/tests/restaurant-strict-browser.cjs` exercises the actual UI, image guards and 1284×2778 PNG export using explicitly synthetic test receipts; those receipts are never loaded by the production website.
