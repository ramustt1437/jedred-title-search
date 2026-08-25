from fastapi import APIRouter, HTTPException, Request, Response

from lib.auth import (COOKIE_NAME, current_user, log_activity, make_token,
                      set_session_cookie, verify_password)
from lib.db import db
from models.schemas import LoginRequest, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=User)
async def login(payload: LoginRequest, response: Response):
    user = await db.users.find_one({"email": payload.email.strip().lower(), "active": True})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session_cookie(response, make_token(user["id"]))
    user.pop("_id", None)
    user.pop("password_hash", None)
    await log_activity(None, user, "Signed in")
    return User(**user)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=User)
async def me(request: Request):
    return User(**await current_user(request))
