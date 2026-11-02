# Automatic market and Kronos updates

The market snapshot workflow is the primary pipeline: verified exchange quotes → actual-session calendar → official per-stock history → history/quote date and content alignment → publish data → Kronos inference → verify all 16 shards → publish models → deploy Pages.

Research history and calendar failures now fail the run. The existing market schedule retries every 20 minutes during its UTC 09–23 window, with a next-morning recovery attempt. Each market fetch also retries three times. Kronos additionally has hourly recovery attempts; it first requires a fresh market snapshot and aligned history, so it cannot generate a new forecast from yesterday's archive.

All inference shards use the same pinned repository commit. Publishing checks each successful result's ticker, market, source-history signature, date, next session, pinned model/tokenizer revisions and 32 finite samples. It rejects missing or duplicate shard results and any source revision during inference. Instruments which cannot be modeled keep an explicit unavailable reason and lose their previous result. An unchanged completed input set is skipped; missing or damaged outputs are recomputed. Merely changing a generation timestamp does not recompute all stocks.

Both data and model publication explicitly deploy the current main branch to Pages; automated commits do not depend on triggering another Pages build. Different artifact names prevent the chained data and model deployments from colliding. The frontend loads official history from the current site's data directory, and explains mismatched dates or unavailable history instead of showing only a generic missing-model message.

GitHub scheduled Actions are best effort and can be delayed. This pipeline removes the ordering race and adds catch-up attempts, but cannot guarantee a fixed completion minute during a GitHub or exchange outage. Failed runs remain visible in Actions; the next scheduled attempt retries. Model results remain unavailable until matching, verified data is published.

Validation: `node scripts/tests/kronos-automation.test.cjs` covers mismatched dates, revised quotes/history, timestamp-only updates, missing/duplicate shards, invalid model outputs, stale-file removal, idempotency, publication races, unavailable instruments, deployed-site history routing and frontend missing-data explanations. Existing offline and browser regressions run through the repository's contract workflow.
