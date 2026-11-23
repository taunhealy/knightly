import datetime as dt
import hashlib
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

from db.models import (
    AppSettingModel,
    FingerprintModel,
    TaskModel,
    UserAlertModel,
    UserProfileModel,
)
from db.session import SessionLocal, init_db
from services.listings_db import upsert_listings


def print_safe(msg):
    try:
        safe_msg = str(msg).encode("ascii", "ignore").decode("ascii")
        print(safe_msg)
        sys.stdout.flush()
    except Exception:
        pass


init_db()


def get_db():
    """Firestore removed; all persistence runs on Supabase Postgres via SQLAlchemy."""
    return None


def create_listing_id(listing: dict) -> str:
    """Generates a deterministic hash ID based on core property attributes."""
    title = str(listing.get("title", "")).lower().strip()
    price = str(listing.get("price", "0")).strip()
    address = str(listing.get("address", "")).lower().strip()
    payload = f"{title}-{price}-{address}"
    return hashlib.sha256(payload.encode()).hexdigest()[:24]


async def save_listing(user_id: str, listing: Any, task_id: Optional[str] = None):
    """Save a listing to the Postgres listings pool."""
    if not isinstance(listing, dict):
        if hasattr(listing, "model_dump"):
            listing = listing.model_dump()
        elif hasattr(listing, "dict"):
            listing = listing.dict()
        else:
            return
    suburb = str(listing.get("suburb") or listing.get("area") or "Cape Town").strip()
    if not listing.get("id"):
        listing["id"] = create_listing_id(listing)
    upsert_listings([listing], suburb_name=suburb, is_full_suburb_scrape=False)


async def get_sources() -> List[Dict[str, Any]]:
    """Get enabled scraping sources."""
    return [{"id": "property24", "name": "Property24", "enabled": True}]


async def get_user_profile(user_id: str, token_data: Optional[dict] = None) -> Dict[str, Any]:
    """Get user profile from Postgres and lazy-init if missing."""
    uid = str(user_id or "").strip() or "local-dev-user"
    now = time.time()
    with SessionLocal() as db:
        row = db.get(UserProfileModel, uid)
        if row:
            return {
                "id": row.user_id,
                "tier": row.tier,
                "email": row.email,
                "name": row.name,
                "photo": row.photo,
                "auth_provider": row.auth_provider,
                **(row.profile_json or {}),
            }

        tier = "silver" if uid == "taun_test_user" else "free"
        row = UserProfileModel(
            user_id=uid,
            email=(token_data or {}).get("email", "") or "",
            name=(token_data or {}).get("name", "") or "",
            photo=(token_data or {}).get("picture", "") or "",
            tier=tier,
            auth_provider="google",
            profile_json={},
            created_at=now,
            last_active=now,
        )
        db.add(row)
        db.commit()
        return {
            "id": row.user_id,
            "tier": row.tier,
            "email": row.email,
            "name": row.name,
            "photo": row.photo,
            "auth_provider": row.auth_provider,
        }


async def create_task(user_id: str, search_query: str) -> str:
    task_id = f"task-{uuid.uuid4().hex[:12]}"
    now = time.time()
    with SessionLocal() as db:
        db.add(
            TaskModel(
                id=task_id,
                user_id=user_id,
                query=search_query,
                status="Initializing",
                progress=0,
                completed=False,
                logs_json=[],
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()
    return task_id


async def update_task(task_id: str, stage: str, message: str, progress: int = 0, completed: bool = False):
    now = time.time()
    with SessionLocal() as db:
        row = db.get(TaskModel, task_id)
        if not row:
            return
        row.status = f"{stage}: {message}"
        row.updated_at = now
        logs = list(row.logs_json or [])
        logs.append(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {stage}: {message}")
        row.logs_json = logs[-100:]
        if progress > 0:
            row.progress = progress
        if completed:
            row.completed = True
        db.commit()


async def is_hash_scanned(hash_key: str) -> bool:
    with SessionLocal() as db:
        return db.get(FingerprintModel, hash_key) is not None


async def record_hash(hash_key: str, metadata: Optional[dict] = None):
    now = time.time()
    with SessionLocal() as db:
        row = db.get(FingerprintModel, hash_key)
        if not row:
            db.add(FingerprintModel(hash_key=hash_key, metadata_json=metadata or {}, scanned_at=now))
        else:
            row.metadata_json = metadata or {}
            row.scanned_at = now
        db.commit()


async def get_users_by_tier(tier: str) -> List[Dict[str, Any]]:
    with SessionLocal() as db:
        rows = db.query(UserProfileModel).filter(UserProfileModel.tier == tier.lower()).all()
        return [{"id": r.user_id, "tier": r.tier, "email": r.email, "name": r.name} for r in rows]


async def get_user_alerts(user_id: str) -> List[Dict[str, Any]]:
    uid = str(user_id or "").strip()
    with SessionLocal() as db:
        rows = (
            db.query(UserAlertModel)
            .filter(UserAlertModel.user_id == uid)
            .order_by(UserAlertModel.updated_at.desc())
            .all()
        )
        return [{"id": r.id, "user_id": r.user_id, **(r.alert_json or {})} for r in rows]


async def get_all_active_alerts() -> List[Dict[str, Any]]:
    with SessionLocal() as db:
        rows = db.query(UserAlertModel).filter(UserAlertModel.is_active.is_(True)).all()
        return [{"id": r.id, "user_id": r.user_id, **(r.alert_json or {})} for r in rows]


async def save_search(user_id: str, search: dict) -> Optional[str]:
    uid = str(user_id or "").strip()
    now = time.time()
    search_id = hashlib.sha256(f"{uid}-{search.get('search_query', '')}".lower().encode()).hexdigest()
    payload = dict(search)
    payload["user_id"] = uid
    payload["updated_at"] = now
    with SessionLocal() as db:
        row = db.get(UserAlertModel, search_id)
        if not row:
            row = UserAlertModel(id=search_id, user_id=uid)
            db.add(row)
        row.search_query = str(search.get("search_query", ""))
        row.is_active = bool(search.get("is_active", True))
        row.alert_json = payload
        row.updated_at = now
        db.commit()
    return search_id


async def delete_user_alert(user_id: str, search_id: str) -> bool:
    with SessionLocal() as db:
        row = db.get(UserAlertModel, search_id)
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True


async def get_global_cookies():
    with SessionLocal() as db:
        row = db.get(AppSettingModel, "facebook_session")
        if row and isinstance(row.value_json, dict):
            return row.value_json.get("cookies")
        return None


async def save_global_cookies(cookies: list):
    now = time.time()
    with SessionLocal() as db:
        row = db.get(AppSettingModel, "facebook_session")
        if not row:
            row = AppSettingModel(key="facebook_session")
            db.add(row)
        row.value_json = {"cookies": cookies}
        row.updated_at = now
        db.commit()


async def get_listings_by_keys(urls: list[str], hashes: list[str]) -> list[dict]:
    return []


async def get_known_listings(urls: list[str], hashes: list[str]) -> set[str]:
    return set()
