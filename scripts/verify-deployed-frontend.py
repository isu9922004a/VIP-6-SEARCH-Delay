"""Read-only Pages byte check; never changes deployment or market data."""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ["ui-minimal-v925.css", "ui-minimal-v925.js", "ui-feedback-v923.css", "ui-feedback-v923.js", "stock-worker.mjs", "life-line-visual-v972.js", "life-line-visual-v913.js", "market-life-visual-v913.js", "life-risk-transparency-v916.js", "heikin-ashi-life-v920.js", "assets/shitou-character-original-v972.jpg", "main-force-lifeline-ranking-v971.js", "main-force-lifeline-core-v97.js", "main-force-lifeline-scanner-v97.js", "main-force-lifeline-report-v97.js", "main-force-lifeline-ui-v97.js", "main-force-lifeline-v97.css", "market-life-source-audit-v96.js", "market-life-report-v96.js", "market-life-ui-v96.js", "market-life-v96.css", "kline-life-03-pages-v94.js", "kline-life-03-viewer-v94.js", "research-life-source-audit-v932.js", "kline-life-03-core-v1.js", "kline-life-03-report-v1.js", "research-chart-layout-v921.js", "research-ui-v921.css", "kline-attack-v90.js", "kline-attack-report-v90.js", "strategy-2560-config-v90.js", "strategy-2560-v1.js", "strategy-2560-scanner-v1.js", "strategy-2560-ui-v1.js", "strategy-2560-report-v1.js", "indicator-shadow-ui-v1.js", "enhanced-macd-v923.js", "enhanced-macd-ui-v923.js", "enhanced-macd-v923.css", "report-beginner-copy-v88.js", "research-v83/market-freshness.js", "kronos-future-share-config-v873.js", "kronos-future-shares-v873.js", "kronos-future-core-v1.js", "kronos-future-report-v1.js", "wave-postclose-context-v1.js", "elliott-wave-market-beginner-v1.js", "elliott-wave-stock-beginner-v1.js", "strong-stock-ui-v47.js", "strong-stock-filter-v47.js", "deep-scan-health-v1.js", "tower-line-core.js", "research-v83/workspace-v831.js", "research-v83/workspace-v831.css", "elliott-wave-report-v1.js", "market-worker.mjs", "market-report-refresh-v864.js", "r45-report-suite.js", "elliott-wave-v1.js", "elliott-wave-visual-v1.js", "engulf-range-report-v1.js", "structure-context-v1.js", "price-action-context-v1.js", "price-action-integration-v1.js", "research-validation-v1.js", "research-v86/market-config.js", "research-v86/market-regime.js", "report-watermark-v84.js", "stock-professional-v84.js", "frontend-v84.css", "research-v83/market-simple-report.js", "research-v83/market-simple-report.css", "research-action-guide-v1.js", "research-mobile-v1.css", "research-official-history-v1.js", "index.html", "version-v50.js", "research-beginner-v1.js",
         "research-chart-v1.js", "research-report-v1.js", "unified-analysis-v1.js", "research-entry-direction-v1.js",
         "four-models-research-v1.js", "research-common-v1.js", "research-integration-v1.js",
         "stock-query-runtime-v826.js", "tower-integration.js", "shito-assistant-v47.js",
         "industry-context-v47.js", "stock-audit-alert-v82.js",
         "scan-report-rsi-v5328.js", "research-query-fallback-v1.js", "research-opening-plan-v1.js", "research-source-evidence-v1.js", "selection-data-v2.js", "market-outlook.html",
         "research-v83/forecast-engine.js", "research-v83/kronos-data.js", "research-v83/stock-fifth-module.js",
         "research-v83/iphone-summary-renderer.js", "research-v83/stock-simple-report.js", "research-v83/stock-simple-report.css",
         "research-v83/stock-fifth-module.css", "research-v83/market.js", "research-v83/market-engine.js",
         "research-v83/market-base.css", "research-v83/market.css",
         "mobile-image-share-v1.js", "report-preview-v926.css", "market-report-comfort-v864.js", "release-compact-v1.js",
         "postmarket-patterns-v926.js", "postmarket-trend-v926.js", "postmarket-report-v926.js", "postmarket-preview-v926.js", "market-facts-v927.js"]


def deployment_base(environ=None):
    environ = os.environ if environ is None else environ
    explicit = environ.get("RESEARCH_BROWSER_ORIGIN", "").strip()
    if explicit:
        return explicit.rstrip("/") + "/"
    repository = environ.get("GITHUB_REPOSITORY", "").strip()
    parts = repository.split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError("Set RESEARCH_BROWSER_ORIGIN or GITHUB_REPOSITORY to select the deployment")
    owner, name = parts
    return f"https://{owner.lower()}.github.io/{name}/"


def check(name, base, expected_root=None):
    try:
        request = urllib.request.Request(
            base + name + "?verify=" + str(time.time_ns()),
            headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=20) as response:
            actual = response.read()
        # Staged files must match the built artifact; never fall back to source for them.
        staged = name == "index.html" or name == "frontend-v924-manifest.json" or name.startswith("index-inline-v924-")
        reference = (expected_root / name) if expected_root is not None and staged else (ROOT / name)
        return {"path": name, "match": actual == reference.read_bytes(),
                "sha256": hashlib.sha256(actual).hexdigest()}
    except Exception as error:
        return {"path": name, "match": False, "error": str(error)}


def main():
    # Match the actual deployed artifact, not the pre-build canonical index.
    with tempfile.TemporaryDirectory(prefix="v924-verify-") as temp:
        expected = pathlib.Path(temp)
        subprocess.run(["node", str(ROOT / "scripts/build-frontend-v924.cjs"), temp, "--defer-future"], cwd=ROOT, check=True)
        manifest = json.loads((expected / "frontend-v924-manifest.json").read_text())
        assert manifest["originalReconstructionIdentical"] and len(manifest["assets"]) == 15
        verify(expected, FILES + ["frontend-v924-manifest.json"] + [a["name"] for a in manifest["assets"]])


def verify(expected_root, files):
    base = deployment_base()
    deadline = time.monotonic() + 480
    while True:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(lambda name: check(name, base, expected_root), files))
        evidence = {"status": "PASS" if all(x["match"] for x in results) else "WAIT",
                    "site": base, "files": results}
        pathlib.Path("/tmp/deployed-frontend-verification.json").write_text(
            json.dumps(evidence, indent=2) + "\n")
        print(json.dumps(evidence), flush=True)
        if evidence["status"] == "PASS":
            return
        if time.monotonic() >= deadline:
            raise SystemExit("Pages bytes did not match this release before timeout")
        time.sleep(10)


if __name__ == "__main__":
    main()
