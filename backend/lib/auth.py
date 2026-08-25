"""Authentication + authorization helpers (httpOnly cookie session)."""
import base64
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from fastapi import HTTPException, Request

from lib.db import db

SECRET = os.environ.get("JWT_SECRET", "title-search-services-dev-secret")
COOKIE_NAME = "ts_session"
ROLES = ["ADMIN", "RESEARCHER", "REVIEWER", "CLIENT"]
ALL_PERMS = ["view", "edit", "upload", "download", "approve", "export"]


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, dk_b64 = stored.split(":")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt_b64), 120_000)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, samesite="lax", secure=False,
        max_age=7 * 24 * 3600, path="/",
    )


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"id": payload.get("sub"), "active": True})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def admin_user(request: Request) -> dict:
    user = await current_user(request)
    if user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


async def order_perms(order: dict, user: dict) -> set:
    """Effective permissions of `user` on `order`."""
    role = user["role"]
    if role == "ADMIN":
        return set(ALL_PERMS)
    perms: set = set()
    grant = await db.access_grants.find_one({"order_id": order["id"], "user_id": user["id"]})
    if grant:
        perms |= set(grant.get("permissions", []))
    if role == "RESEARCHER" and user["id"] in (order.get("assigned_to"), order.get("created_by")):
        perms |= {"view", "edit", "upload", "download", "export"}
    if role == "REVIEWER":
        perms |= {"view", "edit", "download", "approve", "export"}
    return perms


async def require_order(order_id: str, user: dict, perm: str = "view") -> dict:
    order = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    perms = await order_perms(order, user)
    if perm not in perms:
        raise HTTPException(status_code=403, detail=f"You do not have '{perm}' permission on this order")
    order.pop("_id", None)
    order["_perms"] = sorted(perms)
    return order


async def visible_order_filter(user: dict) -> dict:
    """Mongo filter limiting orders to those the user may see."""
    base: dict[str, Any] = {"deleted": {"$ne": True}}
    if user["role"] in ("ADMIN", "REVIEWER"):
        return base
    shared = await db.access_grants.find({"user_id": user["id"]}).to_list(2000)
    ids = [g["order_id"] for g in shared if "view" in g.get("permissions", [])]
    if user["role"] == "RESEARCHER":
        base["$or"] = [{"assigned_to": user["id"]}, {"created_by": user["id"]}, {"id": {"$in": ids}}]
    else:
        base["id"] = {"$in": ids}
    return base


async def log_activity(order_id: Optional[str], user: dict, action: str, detail: str = "") -> None:
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "action": action,
        "detail": detail,
        "created_at": datetime.now(timezone.utc),
    })
