import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException
from sqlalchemy import text
from db.models import CreditTransactionModel, UserProfileModel
from db.session import SessionLocal, init_db

# Cost-weighted AI credit schedule (covers Gemini Flash/Vision API cost with ~5-15x margin)
CREDIT_COSTS: Dict[str, int] = {
    "alert_match": 1,         # Batched Gemini Flash text scoring per qualifying match
    "inspection_photo": 1,    # 1 photo Gemini Vision defect description
    "inspection_criteria": 1, # Tailored room checklist generation
    "listing_chat": 1,        # Follow-up Gemini advisor chat turn
    "forensic_vision": 2,     # Multi-photo Forensic Vision audit (0 on cache hit)
    "compare_ai": 3,          # Multi-property architectural + image comparison
    "pro_report": 5,          # Full due-diligence Pro PDF report
}


def _ensure_profile(db, user_id: str) -> UserProfileModel:
    uid = (user_id or "").strip() or "local-dev-user"
    row = db.get(UserProfileModel, uid)
    if not row:
        now = time.time()
        row = UserProfileModel(
            user_id=uid,
            tier="free",
            ai_credits=0,
            auth_provider="google",
            profile_json={},
            created_at=now,
            last_active=now,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_credit_balance(user_id: str) -> Dict[str, Any]:
    init_db()
    uid = (user_id or "").strip() or "local-dev-user"
    with SessionLocal() as db:
        prof = _ensure_profile(db, uid)
        txs = (
            db.query(CreditTransactionModel)
            .filter(CreditTransactionModel.user_id == uid)
            .order_by(CreditTransactionModel.created_at.desc())
            .limit(15)
            .all()
        )
        return {
            "user_id": uid,
            "ai_credits": int(prof.ai_credits if prof.ai_credits is not None else 0),
            "tier": prof.tier or "free",
            "pricing": CREDIT_COSTS,
            "transactions": [
                {
                    "id": t.id,
                    "action": t.action,
                    "credits_delta": t.credits_delta,
                    "balance_after": t.balance_after,
                    "metadata": t.metadata_json or {},
                    "created_at": t.created_at,
                }
                for t in txs
            ],
        }


def require_credits(user_id: str, action: str, override_cost: Optional[int] = None) -> int:
    init_db()
    cost = override_cost if override_cost is not None else CREDIT_COSTS.get(action, 1)
    if cost <= 0:
        return 0
    uid = (user_id or "").strip() or "local-dev-user"
    with SessionLocal() as db:
        prof = _ensure_profile(db, uid)
        bal = int(prof.ai_credits if prof.ai_credits is not None else 0)
        if bal < cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient AI credits for {action} (requires {cost}, balance {bal}).",
            )
    return cost


def charge_credits(
    user_id: str,
    action: str,
    metadata: Optional[Dict[str, Any]] = None,
    override_cost: Optional[int] = None,
) -> int:
    init_db()
    cost = override_cost if override_cost is not None else CREDIT_COSTS.get(action, 1)
    if cost <= 0:
        return get_credit_balance(user_id)["ai_credits"]
    uid = (user_id or "").strip() or "local-dev-user"
    now = time.time()
    with SessionLocal() as db:
        _ensure_profile(db, uid)
        res = db.execute(
            text(
                "UPDATE user_profiles SET ai_credits = ai_credits - :cost, last_active = :now "
                "WHERE user_id = :uid AND ai_credits >= :cost"
            ),
            {"cost": cost, "now": now, "uid": uid},
        )
        if res.rowcount == 0:
            db.rollback()
            raise HTTPException(status_code=402, detail=f"Insufficient AI credits for {action}.")
        prof = db.get(UserProfileModel, uid)
        new_bal = int(prof.ai_credits) if prof else 0
        db.add(
            CreditTransactionModel(
                id=f"ctx-{uuid.uuid4().hex[:12]}",
                user_id=uid,
                action=action,
                credits_delta=-cost,
                balance_after=new_bal,
                metadata_json=metadata or {},
                created_at=now,
            )
        )
        db.commit()
        return new_bal


def add_credits(user_id: str, amount: int, reason: str = "topup") -> int:
    init_db()
    uid = (user_id or "").strip() or "local-dev-user"
    now = time.time()
    with SessionLocal() as db:
        prof = _ensure_profile(db, uid)
        bal = int(prof.ai_credits if prof.ai_credits is not None else 0)
        new_bal = bal + max(0, int(amount))
        prof.ai_credits = new_bal
        prof.last_active = now
        db.add(
            CreditTransactionModel(
                id=f"ctx-{uuid.uuid4().hex[:12]}",
                user_id=uid,
                action=reason,
                credits_delta=max(0, int(amount)),
                balance_after=new_bal,
                metadata_json={},
                created_at=now,
            )
        )
        db.commit()
        return new_bal
