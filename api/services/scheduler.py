import asyncio
import datetime as dt
import hashlib
import time
from typing import List, Dict, Any, Optional
from db.models import AlertReportModel, SentAlertListingModel, UserAlertModel, UserProfileModel
from db.session import SessionLocal, init_db
from services.database import get_all_active_alerts, get_user_alerts, get_user_profile, print_safe
from services.ai_scout import scout_engine, ScoutPreferences, AIScoutResult
from services.notifications import EvolutionClient, ResendEmailClient

# South Africa Standard Time is UTC+2 (no daylight saving)
SAST_TZ = dt.timezone(dt.timedelta(hours=2))

class DailyScoutScheduler:
    """
    SaaS Daily Cron Engine:
    - Runs every day at 11:00 AM SAST (South African Standard Time)
    - Scouts and ranks the top 10 listings per active user alert
    - Stores the full insight report in Firestore (`users/{uid}/reports/{report_id}`)
    - Triggers WhatsApp and Email alerts with the top 3 highlights and direct report link
    """
    def __init__(self):
        self._task = None
        self._running = False
        self.last_run_date: Optional[str] = None
        self.evolution = EvolutionClient()
        self.email_client = ResendEmailClient()

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._cron_loop())
        print_safe("[SCHEDULER] ⏰ SaaS Daily AI Scout Scheduler initiated (Target: 11:00 AM SAST).")

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        print_safe("[SCHEDULER] SaaS Daily AI Scout Scheduler stopped.")

    async def _cron_loop(self):
        """Heartbeat check every 30 seconds to catch 11:00 AM SAST."""
        while self._running:
            try:
                now_sast = dt.datetime.now(SAST_TZ)
                today_str = now_sast.strftime("%Y-%m-%d")

                # Trigger at 11:00 AM (between 11:00 and 11:05 AM) once per calendar day
                if now_sast.hour == 11 and self.last_run_date != today_str:
                    print_safe(f"[SCHEDULER] 🎯 11:00 AM SAST reached on {today_str}! Commencing Global Daily AI Scout...")
                    self.last_run_date = today_str
                    await self.run_global_daily_scout()

            except asyncio.CancelledError:
                break
            except Exception as e:
                print_safe(f"[SCHEDULER LOOP ERROR] {e}")

            await asyncio.sleep(30)

    async def run_global_daily_scout(self, force_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Executes daily intelligence scout across all active user alerts in Supabase Postgres.
        """
        init_db()
        generated_reports = []
        try:
            if force_user_id:
                raw_alerts = await get_user_alerts(force_user_id)
                all_alerts = [
                    {"user_id": force_user_id, "alert_id": a.get("id"), **a}
                    for a in raw_alerts
                    if a.get("is_active") is not False
                ]
            else:
                raw_alerts = await get_all_active_alerts()
                all_alerts = [
                    {"user_id": a.get("user_id"), "alert_id": a.get("id"), **a}
                    for a in raw_alerts
                    if a.get("is_active") is not False
                ]

            print_safe(f"[SCHEDULER] Found {len(all_alerts)} active alerts to scout.")

            for alert in all_alerts:
                user_id = alert.get("user_id")
                if not user_id:
                    continue

                try:
                    report = await self.generate_alert_report(user_id, alert)
                    if report:
                        generated_reports.append(report)
                except Exception as alert_err:
                    print_safe(f"[SCHEDULER] Error processing alert {alert.get('alert_id')}: {alert_err}")

        except Exception as e:
            print_safe(f"[SCHEDULER] Error in run_global_daily_scout: {e}")

        return generated_reports

    async def generate_alert_report(self, user_id: str, alert: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Scouts portals, deduplicates already-alerted listings, deducts 1 credit per qualifying match, and notifies."""
        now_sast = dt.datetime.now(SAST_TZ)
        alert_id = str(alert.get("alert_id") or alert.get("id") or "gen")

        # Check available AI credits before running Gemini scoring
        with SessionLocal() as db:
            prof = db.get(UserProfileModel, user_id)
            credits_left = int(getattr(prof, "ai_credits", 50)) if prof else 50
            if credits_left <= 0:
                print_safe(f"[SCHEDULER] Skipping alert {alert_id} for {user_id}: 0 AI credits remaining.")
                return None
        
        # Prepare preferences from alert config
        areas = alert.get("areas")
        if not areas:
            target_area = alert.get("target_area") or alert.get("search_query") or "Cape Town"
            areas = [a.strip() for a in target_area.split(",") if a.strip()]

        raw_b = alert.get("min_bedrooms")
        parsed_min_b = None
        if raw_b:
            if isinstance(raw_b, list):
                parsed_min_b = float(raw_b[0]) if raw_b else None
            else:
                try:
                    parsed_min_b = float(str(raw_b).replace("+", "").strip())
                except Exception:
                    parsed_min_b = None

        prefs = ScoutPreferences(
            prompt=alert.get("prompt") or alert.get("search_query") or "Looking for best rental matching my lifestyle",
            personal_tastes=alert.get("personal_tastes") or alert.get("lifestyle_prompt") or "",
            areas=areas,
            min_price=alert.get("min_price"),
            max_price=alert.get("max_price") or 20000,
            min_bedrooms=parsed_min_b,
            property_type=alert.get("property_type", "Apartment"),
            is_furnished=alert.get("is_furnished"),
            must_have_parking=bool(alert.get("must_have_parking", False))
        )

        print_safe(f"[SCHEDULER] Scouting for user {user_id} across {prefs.areas} (Max: R {prefs.max_price})...")
        scout_res: AIScoutResult = await scout_engine.scout_and_rank(prefs)

        # Filter by user's minimum AI Fit threshold AND deduplicate against previously alerted listings
        min_fit_score = int(alert.get("min_fit_score") or 0)
        with SessionLocal() as db:
            seen_rows = (
                db.query(SentAlertListingModel.listing_id)
                .filter(SentAlertListingModel.alert_id == alert_id)
                .all()
            )
            seen_ids = {r[0] for r in seen_rows}

        filtered_ranked = []
        for l in scout_res.ranked_listings:
            lid = str(getattr(l, "id", "") or getattr(l, "url", "") or hashlib.sha256(str(getattr(l, "title", "")).encode()).hexdigest()[:16])
            score = getattr(l, "match_score", 0) or 0
            if (min_fit_score <= 0 or score >= min_fit_score) and lid not in seen_ids:
                filtered_ranked.append((lid, score, l))

        if not filtered_ranked:
            print_safe(f"[SCHEDULER] No new qualifying matches (>= {min_fit_score}%) for alert {alert_id}.")
            return None

        top_10 = [item[2] for item in filtered_ranked[:10]]
        ranked_dicts = [l.dict() for l in top_10]
        
        # Populate commute & location proximities if anchors are set
        anchors = alert.get("commute_anchors") or alert.get("location_anchors") or []
        if anchors:
            try:
                from services.commute_service import calculate_listing_proximities
                for item in ranked_dicts:
                    addr = item.get("address") or item.get("location") or item.get("title") or "Cape Town"
                    item["location_proximity"] = await calculate_listing_proximities(addr, anchors)
            except Exception as e:
                print_safe(f"[SCHEDULER PROXIMITY ERROR] {e}")

        report_id = f"rep_{now_sast.strftime('%Y%m%d_%H%M%S')}_{alert.get('alert_id', 'gen')[:8]}"
        report_data = {
            "id": report_id,
            "user_id": user_id,
            "alert_id": alert.get("alert_id"),
            "alert_title": alert.get("title") or f"{', '.join(prefs.areas)} Daily Scout",
            "created_at": now_sast.isoformat(),
            "created_at_timestamp": int(now_sast.timestamp()),
            "areas_scouted": prefs.areas,
            "total_found": scout_res.total_found,
            "overall_summary": scout_res.overall_summary,
            "user_prompt": prefs.prompt,
            "personal_tastes": prefs.personal_tastes,
            "max_price": prefs.max_price,
            "min_fit_score": min_fit_score,
            "ranked_listings": ranked_dicts,
            "commute_anchors": anchors,
            "location_anchors": anchors
        }

        # 1. Save Report, record deduplicated sent listings & deduct 1 AI credit per qualifying match
        now_ts = time.time()
        with SessionLocal() as db:
            db.add(
                AlertReportModel(
                    id=report_id,
                    user_id=user_id,
                    alert_id=alert_id,
                    report_json=report_data,
                    created_at=now_ts,
                )
            )
            for lid, score, _ in filtered_ranked[:10]:
                sent_pk = f"{alert_id}:{lid}"
                if not db.get(SentAlertListingModel, sent_pk):
                    db.add(
                        SentAlertListingModel(
                            id=sent_pk,
                            alert_id=alert_id,
                            user_id=user_id,
                            listing_id=lid,
                            fit_score=int(score),
                            sent_at=now_ts,
                        )
                    )
            prof = db.get(UserProfileModel, user_id)
            if prof and prof.ai_credits is not None:
                from core.credits import charge_credits
                charge_credits(user_id, "alert_match", {"alert_id": alert_id, "matches": len(top_10)}, override_cost=len(top_10))
            alert_row = db.get(UserAlertModel, alert_id)
            if alert_row:
                alert_row.alert_json = {
                    **(alert_row.alert_json or {}),
                    "last_run_at": now_sast.isoformat(),
                    "last_report_id": report_id,
                    "last_match_count": len(top_10),
                }
                alert_row.updated_at = now_ts
            db.commit()

        print_safe(f"[SCHEDULER] Saved Daily Report {report_id} with {len(top_10)} NEW qualifying listings.")

        # 2. Deliver Notifications (WhatsApp / Email)
        await self._dispatch_notifications(user_id, alert, report_data)

        return report_data

    async def _dispatch_notifications(self, user_id: str, alert: Dict[str, Any], report: Dict[str, Any]):
        """Builds concise, professional WhatsApp & Email digest of the top 3 options."""
        top_listings = report.get("ranked_listings", [])[:3]
        if not top_listings:
            return

        user_profile = await get_user_profile(user_id)

        whatsapp_num = user_profile.get("whatsapp") or alert.get("whatsapp_number")
        email_addr = user_profile.get("email") or alert.get("notification_email")
        
        areas_str = ", ".join(report.get("areas_scouted", []))
        summary = report.get("overall_summary", "")

        # Format Top 3 items
        items_text = []
        for it in top_listings:
            price_str = f"R {it['price']:,} pm" if it.get("price") else "Price On Request"
            items_text.append(
                f"• *#{it['rank']} {it['title']}* ({price_str})\n"
                f"  📍 {it['address']}\n"
                f"  💡 {it['short_explanation']}\n"
                f"  🔗 {it['url']}"
            )
        bullet_points = "\n\n".join(items_text)

        wa_message = (
            f"🏡 *HomeSeek Daily Intelligence Report (11:00 AM SAST)*\n"
            f"📍 *Areas:* {areas_str}\n\n"
            f"🧠 *AI Advisor Insight:*\n{summary}\n\n"
            f"🏆 *Top Ranked Matches:*\n\n{bullet_points}\n\n"
            f"📊 View your full interactive Top 10 Report on your HomeSeek Dashboard."
        )

        # Dispatch WhatsApp
        if whatsapp_num and (alert.get("notify_whatsapp", True) or user_profile.get("notify_whatsapp")):
            try:
                await self.evolution.send_whatsapp(whatsapp_num, wa_message)
                print_safe(f"[SCHEDULER] WhatsApp digest sent to {whatsapp_num}")
            except Exception as e:
                print_safe(f"[SCHEDULER] WhatsApp send error: {e}")

        # Dispatch Email
        if email_addr and (alert.get("notify_email", True) or user_profile.get("notify_email")):
            try:
                subject = f"🏡 HomeSeek Top 10 Intelligence Report: {areas_str}"
                await self.email_client.send_email(email_addr, subject, wa_message)
                print_safe(f"[SCHEDULER] Email digest sent to {email_addr}")
            except Exception as e:
                print_safe(f"[SCHEDULER] Email send error: {e}")

scheduler = DailyScoutScheduler()

