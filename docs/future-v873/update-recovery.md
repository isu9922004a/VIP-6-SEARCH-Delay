# V8.7.3 20-session update recovery

The verified market-snapshot workflow now calls the independent 20-session workflow
alongside the existing one-session workflow. Its original hourly recovery schedule
remains enabled. Identical verified catalogs skip inference but still deploy, so a
previous deployment failure can recover without rerunning the model.

Each run freezes the source revision, index/calendar artifacts, source identity
and 16 inference shards. Shard output directories are cleared in temporary CI
checkouts before inference: old published files must never overwrite new results
when artifacts are merged. Publication still requires every shard and all original
model/source/receipt checks, including a final identity check after rebase.

`data/kronos-future/update-status.json` records schema
`shitou-kronos-future-update-v1`, state RUNNING/READY/FAILED, market/model dates,
identity, stage, runId/runAttempt, updatedAt, runUrl and a safe failure reason.
READY requires a matching catalog date and identity. Older runs/dates cannot
overwrite newer status. Status is informational: the browser continues to require
the original date, model fingerprint, execution, freshness and query checks.
Missing, wrong-date, future-dated or older-than-six-hour statuses show unknown
progress instead of claiming inference is running.

Known transport failures retry at most three times, after 20 and 40 seconds, with
unchanged arguments. Validation failures are not retried. Existing deterministic
seed, weights, sample count, inference code and all trading rules remain unchanged.
The existing hourly schedule retries a still-incomplete batch on a later run.

After publication, deploy and verify actual stock/TAIEX clean and watermarked
1284×2778 PNG downloads. A test that only proves stale models are blocked does not
count as recovery. True instrument data/model limitations stay explicit.

Validation: focused update/model/share tests, existing full unit and contract tests,
DOM binding preservation, unchanged canvas renderer, actual four-button browser
exports, plus deployed-file and current-date live checks in the workflow.
