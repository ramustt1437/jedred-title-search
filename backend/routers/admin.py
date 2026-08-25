from typing import List

from fastapi import APIRouter, HTTPException, Request

from lib.auth import admin_user, current_user, hash_password, log_activity
from lib.db import db
from models.schemas import AppSettings, User, UserCreate, UserUpdate

router = APIRouter(tags=["admin"])

DEFAULT_DOC_TYPES = ["Sale Deed", "Gift Deed", "Mortgage", "Release Deed", "Partition Deed",
                     "Agreement", "Encumbrance Certificate", "Mutation Record",
                     "RTC / Revenue Record", "Tax Record", "Court Document", "Other"]


@router.get("/users", response_model=List[User])
async def list_users(request: Request):
    user = await current_user(request)
    if user["role"] == "CLIENT":
        raise HTTPException(status_code=403, detail="Not permitted")
    rows = await db.users.find().to_list(500)
    return [User(**{k: v for k, v in r.items() if k not in ("_id", "password_hash")}) for r in rows]


@router.post("/users", response_model=User)
async def create_user(payload: UserCreate, request: Request):
    admin = await admin_user(request)
    email = payload.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    if payload.role not in ("ADMIN", "RESEARCHER", "REVIEWER", "CLIENT"):
        raise HTTPException(status_code=422, detail="Unknown role")
    user = User(name=payload.name, email=email, role=payload.role)
    stored = user.model_dump()
    stored["password_hash"] = hash_password(payload.password)
    await db.users.insert_one(stored)
    await log_activity(None, admin, "User created", f"{user.name} ({user.role})")
    return user


@router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, payload: UserUpdate, request: Request):
    admin = await admin_user(request)
    row = await db.users.find_one({"id": user_id})
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    update = payload.model_dump(exclude_none=True)
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
    await db.users.update_one({"id": user_id}, {"$set": update})
    await log_activity(None, admin, "User updated", row["email"])
    fresh = await db.users.find_one({"id": user_id})
    return User(**{k: v for k, v in (fresh or {}).items() if k not in ("_id", "password_hash")})


@router.get("/settings", response_model=AppSettings)
async def get_settings(request: Request):
    await current_user(request)
    row = await db.settings.find_one({"id": "app"})
    if not row:
        return AppSettings(document_types=DEFAULT_DOC_TYPES)
    return AppSettings(**{k: v for k, v in row.items() if k not in ("_id", "id")})


@router.put("/settings", response_model=AppSettings)
async def put_settings(payload: AppSettings, request: Request):
    admin = await admin_user(request)
    data = payload.model_dump()
    if not data["document_types"]:
        data["document_types"] = DEFAULT_DOC_TYPES
    await db.settings.update_one({"id": "app"}, {"$set": {**data, "id": "app"}}, upsert=True)
    await log_activity(None, admin, "Settings updated", payload.company_name)
    return AppSettings(**data)
