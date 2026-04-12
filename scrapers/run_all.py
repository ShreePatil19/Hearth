"""Orchestrator — runs all scrapers and reports results."""
from __future__ import annotations
import sys
from datetime import datetime, timezone

import amber_grant
import cartier
import scale_investors
import business_gov_au

SCRAPERS = [
    ("Amber Grant", amber_grant),
    ("Cartier Women's Initiative", cartier),
    ("Scale Investors", scale_investors),
    ("business.gov.au", business_gov_au),
]


def main() -> None:
    print(f"\n{'='*60}")
    print(f"Hearth Funding Radar — Scraper Run")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"{'='*60}\n")

    results: list[tuple[str, int | None]] = []
    failures: list[str] = []

    for name, module in SCRAPERS:
        print(f"\n--- {name} ---")
        try:
            count = module.run()
            results.append((name, count))
            print(f"  OK: {count} opportunities")
        except Exception as e:
            results.append((name, None))
            failures.append(f"{name}: {e}")
            print(f"  FAIL: {e}")

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    for name, count in results:
        status = f"{count} opportunities" if count is not None else "FAILED"
        print(f"  {name}: {status}")

    total = sum(c for _, c in results if c is not None)
    print(f"\nTotal: {total} opportunities upserted")
    print(f"Finished: {datetime.now(timezone.utc).isoformat()}")

    if failures:
        print(f"\n{'!'*60}")
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        print(f"{'!'*60}")
        sys.exit(1)


if __name__ == "__main__":
    main()
