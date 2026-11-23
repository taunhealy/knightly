import time
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from core.auth import AuthUser, get_current_user
from core.credits import add_credits, get_credit_balance
from db.models import UserWorkspaceModel
from db.session import SessionLocal, init_db, is_postgres

router = APIRouter(tags=["workspace"])
init_db()


class WorkspacePayload(BaseModel):
    favourites: List[Dict[str, Any]] = []
    compare_list: List[Dict[str, Any]] = []
    hidden_ids: List[str] = []
    preferences: str = ""


@router.get("/api/health/db")
async def db_health():
    return {
        "status": "ok",
        "engine": "supabase_postgres" if is_postgres() else "local_sqlite",
    }


@router.get("/api/workspace")
async def get_workspace(current_user: AuthUser = Depends(get_current_user)):
    with SessionLocal() as db:
        row = db.get(UserWorkspaceModel, current_user.uid)
        if not row:
            return {
                "status": "success",
                "user_id": current_user.uid,
                "favourites": [],
                "compare_list": [],
                "hidden_ids": [],
                "preferences": "",
            }
        return {
            "status": "success",
            "user_id": current_user.uid,
            "favourites": row.favourites_json or [],
            "compare_list": row.compare_json or [],
            "hidden_ids": row.hidden_ids_json or [],
            "preferences": row.preferences or "",
            "updated_at": row.updated_at,
        }


@router.put("/api/workspace")
async def save_workspace(req: WorkspacePayload, current_user: AuthUser = Depends(get_current_user)):
    now = time.time()
    with SessionLocal() as db:
        row = db.get(UserWorkspaceModel, current_user.uid)
        if not row:
            row = UserWorkspaceModel(user_id=current_user.uid)
            db.add(row)
        row.favourites_json = req.favourites
        row.compare_json = req.compare_list[:4]
        row.hidden_ids_json = req.hidden_ids
        row.preferences = req.preferences
        row.updated_at = now
        db.commit()
    return {"status": "success", "user_id": current_user.uid, "updated_at": now}


@router.get("/api/credits/balance")
async def credit_balance(current_user: AuthUser = Depends(get_current_user)):
    return {"status": "success", **get_credit_balance(current_user.uid)}


class CreditTopupBody(BaseModel):
    credits: int = 25
    reason: str = "topup"


@router.post("/api/credits/topup")
async def topup_ai_credits(body: CreditTopupBody, current_user: AuthUser = Depends(get_current_user)):
    import os
    from fastapi import HTTPException
    if os.getenv("FIREBASE_AUTH_REQUIRED", "false").lower() == "true" and os.getenv("ALLOW_DEV_TOPUP", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Direct top-ups are disabled in production. Use PayPal checkout.")
    new_bal = add_credits(current_user.uid, body.credits, reason=body.reason)
    return {"status": "success", "user_id": current_user.uid, "ai_credits": new_bal}
