import hashlib
import hmac
import json
import os
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from core.auth import AuthUser, get_current_user
from core.credits import add_credits
from db.models import CreditTransactionModel
from db.session import SessionLocal, init_db

router = APIRouter(tags=["payments"])

CREDIT_PACKS: Dict[str, Dict[str, Any]] = {
    "starter_25": {"id": "starter_25", "label": "25 AI Credits", "credits": 25, "price_usd": "3.00", "price_zar": "R55", "price_zar_cents": 5500},
    "scout_75": {"id": "scout_75", "label": "75 AI Credits", "credits": 75, "price_usd": "7.50", "price_zar": "R135", "price_zar_cents": 13500},
    "pro_200": {"id": "pro_200", "label": "200 AI Credits", "credits": 200, "price_usd": "16.00", "price_zar": "R290", "price_zar_cents": 29000},
}


def _paypal_base_url() -> str:
    mode = (os.getenv("PAYPAL_MODE") or "sandbox").strip().lower()
    return "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"


async def _get_paypal_access_token() -> str:
    cid = (os.getenv("PAYPAL_CLIENT_ID") or "").strip()
    secret = (os.getenv("PAYPAL_CLIENT_SECRET") or "").strip()
    if not cid or not secret:
        raise HTTPException(
            status_code=503,
            detail="PayPal is not configured yet (set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in api/.env).",
        )
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{_paypal_base_url()}/v1/oauth2/token",
            auth=(cid, secret),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PayPal OAuth failed: {res.text[:200]}")
        return res.json()["access_token"]


class CreatePayPalOrderRequest(BaseModel):
    pack_id: str = "starter_25"
    return_url: str = "https://knightly-za.firebaseapp.com/payment-success"
    cancel_url: str = "https://knightly-za.firebaseapp.com/payment-cancel"


class CapturePayPalOrderRequest(BaseModel):
    order_id: str
    pack_id: Optional[str] = None


@router.get("/api/payments/packs")
async def list_credit_packs():
    paypal_ok = bool((os.getenv("PAYPAL_CLIENT_ID") or "").strip() and (os.getenv("PAYPAL_CLIENT_SECRET") or "").strip())
    paystack_ok = bool((os.getenv("PAYSTACK_SECRET_KEY") or "").strip())
    return {
        "status": "success",
        "paystack_configured": paystack_ok,
        "paypal_configured": paypal_ok,
        "paypal_mode": (os.getenv("PAYPAL_MODE") or "sandbox").strip().lower(),
        "packs": list(CREDIT_PACKS.values()),
    }


class PaystackInitRequest(BaseModel):
    pack_id: str = "starter_25"
    email: Optional[str] = None
    callback_url: str = "https://knightly-za.firebaseapp.com/payment-success"


class PaystackVerifyRequest(BaseModel):
    reference: str
    pack_id: Optional[str] = None


def _paystack_secret() -> str:
    sec = (os.getenv("PAYSTACK_SECRET_KEY") or "").strip()
    if not sec:
        raise HTTPException(status_code=503, detail="Paystack is not configured yet (set PAYSTACK_SECRET_KEY in api/.env).")
    return sec


@router.post("/api/payments/paystack/initialize")
async def paystack_initialize(req: PaystackInitRequest, current_user: AuthUser = Depends(get_current_user)):
    pack = CREDIT_PACKS.get(req.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Invalid credit pack.")
    sec = _paystack_secret()
    email = (req.email or current_user.email or f"{current_user.uid}@knightly.app").strip()
    payload = {
        "email": email,
        "amount": pack["price_zar_cents"],
        "currency": "ZAR",
        "callback_url": req.callback_url,
        "metadata": {"user_id": current_user.uid, "pack_id": pack["id"]},
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            "https://api.paystack.co/transaction/initialize",
            json=payload,
            headers={"Authorization": f"Bearer {sec}", "Content-Type": "application/json"},
        )
        data = res.json()
        if res.status_code >= 400 or not data.get("status"):
            raise HTTPException(status_code=502, detail=data.get("message") or "Paystack initialization failed.")
    d = data["data"]
    return {"status": "success", "authorization_url": d["authorization_url"], "reference": d["reference"], "pack": pack}


@router.post("/api/payments/paystack/verify")
async def paystack_verify(req: PaystackVerifyRequest, current_user: AuthUser = Depends(get_current_user)):
    init_db()
    ref = (req.reference or "").strip()
    if not ref:
        raise HTTPException(status_code=400, detail="Missing Paystack reference.")
    sec = _paystack_secret()

    marker = f"ps-{ref}"
    with SessionLocal() as db:
        existing = db.query(CreditTransactionModel).filter(CreditTransactionModel.action == marker).first()
        if existing:
            raise HTTPException(status_code=409, detail="This Paystack payment was already credited.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"https://api.paystack.co/transaction/verify/{ref}",
            headers={"Authorization": f"Bearer {sec}"},
        )
        data = res.json()
        if res.status_code >= 400 or not data.get("status"):
            raise HTTPException(status_code=502, detail=data.get("message") or "Paystack verification failed.")

    tx = data.get("data") or {}
    if tx.get("status") != "success":
        raise HTTPException(status_code=400, detail=f"Payment not completed (status={tx.get('status')}).")

    meta = tx.get("metadata") or {}
    uid = meta.get("user_id") or current_user.uid
    pack_id = meta.get("pack_id") or req.pack_id or "starter_25"
    pack = CREDIT_PACKS.get(pack_id) or CREDIT_PACKS["starter_25"]
    new_bal = add_credits(uid, int(pack["credits"]), reason=marker)
    return {"status": "success", "reference": ref, "credits_added": pack["credits"], "ai_credits": new_bal}


@router.post("/api/payments/paystack/webhook")
async def paystack_webhook(request: Request):
    sec = _paystack_secret()
    raw_body = await request.body()
    sig = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(sec.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
    if not sig or not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=400, detail="Invalid Paystack webhook signature.")

    event = json.loads(raw_body.decode("utf-8"))
    if event.get("event") == "charge.success":
        tx = event.get("data") or {}
        ref = tx.get("reference") or ""
        meta = tx.get("metadata") or {}
        uid = meta.get("user_id") or ""
        pack_id = meta.get("pack_id") or ""
        pack = CREDIT_PACKS.get(pack_id)
        if uid and pack and ref:
            marker = f"ps-{ref}"
            with SessionLocal() as db:
                already = db.query(CreditTransactionModel).filter(CreditTransactionModel.action == marker).first()
            if not already:
                add_credits(uid, int(pack["credits"]), reason=marker)
    return {"status": "ok"}


@router.post("/api/payments/paypal/create-order")
async def create_paypal_order(req: CreatePayPalOrderRequest, current_user: AuthUser = Depends(get_current_user)):
    pack = CREDIT_PACKS.get(req.pack_id)
    if not pack:
        raise HTTPException(status_code=400, detail="Invalid credit pack.")
    token = await _get_paypal_access_token()
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": pack["id"],
                "custom_id": f"{current_user.uid}::{pack['id']}",
                "description": f"Knightly {pack['label']}",
                "amount": {"currency_code": "USD", "value": pack["price_usd"]},
            }
        ],
        "application_context": {
            "brand_name": "Knightly",
            "user_action": "PAY_NOW",
            "return_url": req.return_url,
            "cancel_url": req.cancel_url,
        },
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PayPal create-order failed: {res.text[:200]}")
        data = res.json()
    approve_url = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), "")
    return {"status": "success", "order_id": data["id"], "approve_url": approve_url, "pack": pack}


@router.post("/api/payments/paypal/capture-order")
async def capture_paypal_order(req: CapturePayPalOrderRequest, current_user: AuthUser = Depends(get_current_user)):
    init_db()
    order_id = (req.order_id or "").strip()
    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order_id")

    tx_marker = f"pp-{order_id}"
    with SessionLocal() as db:
        if db.get(CreditTransactionModel, tx_marker):
            raise HTTPException(status_code=409, detail="This PayPal order was already credited.")

    token = await _get_paypal_access_token()
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{_paypal_base_url()}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"PayPal capture failed: {res.text[:200]}")
        data = res.json()

    if data.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail=f"Payment not completed (status={data.get('status')}).")

    pu = (data.get("purchase_units") or [{}])[0]
    custom_id = (
        ((pu.get("payments") or {}).get("captures") or [{}])[0].get("custom_id")
        or pu.get("custom_id")
        or ""
    )
    uid = current_user.uid
    pack_id = req.pack_id or "starter_25"
    if "::" in custom_id:
        parts = custom_id.split("::", 1)
        uid = parts[0] or uid
        pack_id = parts[1] or pack_id

    pack = CREDIT_PACKS.get(pack_id) or CREDIT_PACKS["starter_25"]
    new_bal = add_credits(uid, int(pack["credits"]), reason=f"paypal:{pack['id']}:{order_id}")
    return {"status": "success", "order_id": order_id, "credits_added": pack["credits"], "ai_credits": new_bal}


@router.post("/api/payments/paypal/webhook")
async def paypal_webhook(request: Request):
    webhook_id = (os.getenv("PAYPAL_WEBHOOK_ID") or "").strip()
    if not webhook_id:
        raise HTTPException(status_code=503, detail="PAYPAL_WEBHOOK_ID not configured.")
    body = await request.json()
    token = await _get_paypal_access_token()
    verify_payload = {
        "auth_algo": request.headers.get("PAYPAL-AUTH-ALGO", ""),
        "cert_url": request.headers.get("PAYPAL-CERT-URL", ""),
        "transmission_id": request.headers.get("PAYPAL-TRANSMISSION-ID", ""),
        "transmission_sig": request.headers.get("PAYPAL-TRANSMISSION-SIG", ""),
        "transmission_time": request.headers.get("PAYPAL-TRANSMISSION-TIME", ""),
        "webhook_id": webhook_id,
        "webhook_event": body,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        vres = await client.post(
            f"{_paypal_base_url()}/v1/notifications/verify-webhook-signature",
            json=verify_payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if vres.status_code >= 400 or vres.json().get("verification_status") != "SUCCESS":
            raise HTTPException(status_code=400, detail="Invalid PayPal webhook signature.")

    if body.get("event_type") == "PAYMENT.CAPTURE.COMPLETED":
        resource = body.get("resource") or {}
        custom_id = resource.get("custom_id") or ""
        order_id = (resource.get("supplementary_data") or {}).get("related_ids", {}).get("order_id") or resource.get("id", "")
        if "::" in custom_id and order_id:
            uid, pack_id = custom_id.split("::", 1)
            pack = CREDIT_PACKS.get(pack_id)
            if pack:
                add_credits(uid, int(pack["credits"]), reason=f"paypal_webhook:{pack_id}:{order_id}")

    return {"status": "ok"}
