"""
Dedicated HomeSeek Scraper & AI Background Worker.
Isolates Playwright/Camoufox P24 scraping and scheduled alert radar from the FastAPI HTTP process.
Run standalone: `.venv\\Scripts\\python.exe -m worker` (from `api/`).
"""
import asyncio
import json
import os
import time
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


async def run_worker_loop():
    redis_url = (os.getenv("REDIS_URL") or "").strip()
    print(f"[WORKER] Starting HomeSeek Scraper & AI Worker (redis={'configured' if redis_url else 'local-standby'})")

    if not redis_url:
        print("[WORKER] REDIS_URL not set. Worker standing by; FastAPI continues serving local cache-first requests.")
        while True:
            await asyncio.sleep(60)

    try:
        import redis.asyncio as aioredis  # type: ignore
    except ImportError:
        print("[WORKER] Install `redis` package to enable Redis queue consumption.")
        return

    client = aioredis.from_url(redis_url, decode_responses=True)
    queue_key = "homeseek:scrape_jobs"
    lock_key = "homeseek:p24_global_lock"

    while True:
        item = await client.blpop(queue_key, timeout=5)
        if not item:
            continue
        _, raw_job = item
        job = json.loads(raw_job)
        # Enforce global 1-at-a-time P24 rate limit lock across workers
        acquired = await client.set(lock_key, str(time.time()), nx=True, ex=10)
        if not acquired:
            await asyncio.sleep(4.0)
        suburbs = job.get("suburbs") or []
        if suburbs:
            try:
                from services.live_search import fetch_live_p24_listings
                print(f"[WORKER] Processing scrape job: {suburbs}")
                await fetch_live_p24_listings(
                    suburbs=suburbs,
                    min_price=int(job.get("min_price", 5000)),
                    max_price=int(job.get("max_price", 35000)),
                    bedrooms=str(job.get("bedrooms", "any")),
                    force_fresh=bool(job.get("force_fresh", False)),
                )
            except Exception as exc:
                print(f"[WORKER] Job failed: {exc}")
        await asyncio.sleep(4.0)


if __name__ == "__main__":
    asyncio.run(run_worker_loop())
