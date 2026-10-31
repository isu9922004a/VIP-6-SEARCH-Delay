"""Read-only Pages byte check; never changes deployment or market data."""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ["research-action-guide-v1.js", "research-mobile-v1.css", "research-official-history-v1.js", "index.html", "version-v50.js", "research-beginner-v1.js",
         "research-chart-v1.js", "research-report-v1.js", "unified-analysis-v1.js", "research-entry-direction-v1.js",
         "four-models-research-v1.js", "research-common-v1.js", "research-integration-v1.js",
         "stock-query-runtime-v826.js", "tower-integration.js", "shito-assistant-v47.js",
         "industry-context-v47.js", "stock-audit-alert-v82.js",
         "scan-report-rsi-v5328.js", "research-query-fallback-v1.js", "research-opening-plan-v1.js", "research-source-evidence-v1.js", "selection-data-v2.js"]


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


def check(name, base):
    try:
        request = urllib.request.Request(
            base + name + "?verify=" + str(time.time_ns()),
            headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"})
        with urllib.request.urlopen(request, timeout=20) as response:
            actual = response.read()
        return {"path": name, "match": actual == (ROOT / name).read_bytes(),
                "sha256": hashlib.sha256(actual).hexdigest()}
    except Exception as error:
        return {"path": name, "match": False, "error": str(error)}


def main():
    base = deployment_base()
    deadline = time.monotonic() + 480
    while True:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(lambda name: check(name, base), FILES))
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

