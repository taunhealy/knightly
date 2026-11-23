import os
from dataclasses import dataclass
from typing import Optional
from fastapi import Header, HTTPException
import firebase_admin
from firebase_admin import auth as fb_auth


@dataclass
class AuthUser:
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    is_authenticated: bool = False


def _ensure_firebase_app() -> bool:
    try:
        firebase_admin.get_app()
        return True
    except ValueError:
        try:
            from services.database import get_db
            get_db()
            firebase_admin.get_app()
            return True
        except Exception:
            project_id = (os.getenv("FIREBASE_PROJECT_ID") or os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") or "").strip()
            if project_id:
                try:
                    firebase_admin.initialize_app(options={"projectId": project_id})
                    return True
                except Exception:
                    return False
            return False


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
) -> AuthUser:
    """
    Verifies a Firebase Auth Google Sign-In ID token (free Spark tier).
    Falls back to X-User-Id / 'local-dev-user' in local development unless FIREBASE_AUTH_REQUIRED=true.
    """
    require_auth = os.getenv("FIREBASE_AUTH_REQUIRED", "false").lower() == "true"

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token and _ensure_firebase_app():
            try:
                decoded = fb_auth.verify_id_token(token)
                return AuthUser(
                    uid=decoded.get("uid") or decoded.get("sub") or "firebase-user",
                    email=decoded.get("email"),
                    name=decoded.get("name"),
                    is_authenticated=True,
                )
            except Exception as exc:
                raise HTTPException(status_code=401, detail=f"Invalid Firebase ID token: {exc}")
        if require_auth:
            raise HTTPException(status_code=401, detail="Firebase Auth verification not configured on server.")

    if require_auth:
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer <token> header.")

    fallback_uid = (x_user_id or "").strip() or "local-dev-user"
    return AuthUser(uid=fallback_uid, is_authenticated=False)
