"""Orchestrator — runs all scrapers and reports results."""
from __future__ import annotations
import json
import sys
from datetime import datetime, timedelta, timezone

import amber_grant
import cartier
import scale_investors
import business_gov_au
import ifundwomen
import tory_burch
import heads_over_heels
import sbe_australia
import techstars
import sheeo_coralus
from shared.config import get_client

SCRAPERS = [
    ("Amber Grant", amber_grant),
    ("Cartier Women's Initiative", cartier),
    ("Scale Investors", scale_investors),
    ("business.gov.au", business_gov_au),
    ("IFundWomen", ifundwomen),
    ("Tory Burch Foundation", tory_burch),
    ("Heads Over Heels", heads_over_heels),
    ("SBE Australia", sbe_australia),
    ("Techstars", techstars),
    ("Coralus/SheEO", sheeo_coralus),
]

# Rolling/no-deadline opportunities get marked inactive if not re-verified
# by any scraper for this many days. Six months is conservative — scrapers run
# daily, so a healthy opp gets last_checked_at refreshed every day.
STALENESS_GRACE_DAYS = 180


def expire_stale_opportunities() -> tuple[int, int]:
    """Mark opportunities inactive if past deadline or stale.

    Returns:
      (expired_by_deadline, expired_by_staleness)
    """
    client = get_client()
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    staleness_threshold = (now - timedelta(days=STALENESS_GRACE_DAYS)).isoformat()

    # 1) Past deadline → inactive
    resp_deadline = client.patch(
        "/opportunities",
        params={
            "deadline": f"lt.{today_iso}",
            "is_active": "eq.true",
        },
        content=json.dumps({"is_active": False}),
    )
    expired_by_deadline = (
        len(resp_deadline.json()) if resp_deadline.status_code == 200 else 0
    )

    # 2) No deadline + unchecked for STALENESS_GRACE_DAYS → inactive
    resp_stale = client.patch(
        "/opportunities",
        params={
            "deadline": "is.null",
            "last_checked_at": f"lt.{staleness_threshold}",
            "is_active": "eq.true",
        },
        content=json.dumps({"is_active": False}),
    )
    expired_by_staleness = (
        len(resp_stale.json()) if resp_stale.status_code == 200 else 0
    )

    return expired_by_deadline, expired_by_staleness


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

    # Expire opportunities past their deadline or stale rolling-deadline ones
    print(f"\n{'='*60}")
    print("EXPIRE PASS")
    print(f"{'='*60}")
    try:
        expired_deadline, expired_stale = expire_stale_opportunities()
        print(f"  Marked {expired_deadline} past-deadline opportunities inactive")
        print(
            f"  Marked {expired_stale} stale opportunities inactive "
            f"(no deadline, unchecked for {STALENESS_GRACE_DAYS}d)"
        )
    except Exception as e:
        # Don't fail the whole run if expire fails — log and continue
        print(f"  WARN: expire pass failed: {e}")

    print(f"\nFinished: {datetime.now(timezone.utc).isoformat()}")

    if failures:
        print(f"\n{'!'*60}")
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print(f"  - {f}")
        print(f"{'!'*60}")
        sys.exit(1)


if __name__ == "__main__":
    main()
