import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request

from lib.auth import (admin_user, current_user, log_activity, order_perms,
                      require_order, visible_order_filter)
from lib.dates import today_iso
from lib.db import db
from models.schemas import (AccessGrant, AccessGrantCreate, ActivityEntry, Client,
                            Dashboard, DashboardStats, Finding, FindingCreate,
                            Order, OrderCreate, StatusUpdate)

router = APIRouter(tags=["orders"])

STATUSES = ["NEW", "IN PROGRESS", "DOCUMENTS COLLECTED", "REPORT PREPARATION",
            "PENDING REVIEW", "APPROVED", "COMPLETED", "ON HOLD", "CANCELLED"]
OPEN_STATUSES = ["NEW", "IN PROGRESS", "DOCUMENTS COLLECTED", "REPORT PREPARATION", "PENDING REVIEW"]


async def _user_names() -> dict:
    users = await db.users.find().to_list(1000)
    return {u["id"]: u["name"] for u in users}


def _shape(doc: dict, names: dict, perms: Optional[List[str]] = None) -> Order:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    doc["assigned_to_name"] = names.get(doc.get("assigned_to") or "", "")
    doc["permissions"] = perms or []
    return Order(**doc)


async def _next_order_number() -> str:
    year = today_iso()[:4]
    count = await db.orders.count_documents({"order_number": {"$regex": f"^ORDER-{year}-"}})
    return f"ORDER-{year}-{count + 1:03d}"


@router.get("/orders", response_model=List[Order])
async def list_orders(request: Request, search: str = "", status: str = "",
                      client: str = "", assignee: str = "", due_before: str = "",
                      order_date_from: str = ""):
    user = await current_user(request)
    query = await visible_order_filter(user)
    if status:
        query["status"] = status
    if client:
        query["client_name"] = client
    if assignee:
        query["assigned_to"] = assignee
    if due_before:
        query["due_date"] = {"$lte": due_before, "$ne": ""}
    if order_date_from:
        query["order_date"] = {"$gte": order_date_from}
    if search:
        rx = {"$regex": search.strip(), "$options": "i"}
        fields = ["order_number", "client_name", "client_reference", "property_owner",
                  "property_address", "survey_number", "district", "village", "status"]
        matched_docs = await db.documents.find(
            {"$or": [{"doc_number": rx}, {"registration_number": rx}]}).to_list(500)
        text_or = [{f: rx} for f in fields]
        if matched_docs:
            text_or.append({"id": {"$in": [d["order_id"] for d in matched_docs]}})
        query = {"$and": [query, {"$or": text_or}]}
    docs = await db.orders.find(query).sort("created_at", -1).to_list(500)
    names = await _user_names()
    return [_shape(d, names) for d in docs]


@router.get("/dashboard", response_model=Dashboard)
async def dashboard(request: Request):
    user = await current_user(request)
    query = await visible_order_filter(user)
    docs = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    names = await _user_names()
    today = today_iso()
    orders = [_shape(d, names) for d in docs]
    active = [o for o in orders if not o.is_draft]
    stats = DashboardStats(
        total=len(active),
        new=len([o for o in active if o.status == "NEW"]),
        in_progress=len([o for o in active if o.status in ("IN PROGRESS", "DOCUMENTS COLLECTED", "REPORT PREPARATION")]),
        pending_review=len([o for o in active if o.status == "PENDING REVIEW"]),
        completed=len([o for o in active if o.status in ("COMPLETED", "APPROVED")]),
        overdue=len([o for o in active if o.due_date and o.due_date < today and o.status in OPEN_STATUSES]),
    )
    due_soon = sorted([o for o in active if o.due_date and o.status in OPEN_STATUSES],
                      key=lambda o: o.due_date)[:5]
    return Dashboard(
        stats=stats,
        recent=orders[:6],
        due_soon=due_soon,
        recently_completed=[o for o in active if o.status in ("COMPLETED", "APPROVED")][:5],
        assigned_to_me=[o for o in active if o.assigned_to == user["id"]][:5],
    )


@router.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate, request: Request):
    user = await current_user(request)
    if user["role"] not in ("ADMIN", "RESEARCHER"):
        raise HTTPException(status_code=403, detail="Only administrators and researchers can create orders")
    doc = payload.model_dump()
    doc["order_number"] = (payload.order_number or "").strip() or await _next_order_number()
    doc["id"] = str(uuid.uuid4())
    doc["created_by"] = user["id"]
    now = datetime.now(timezone.utc)
    doc["created_at"] = now
    doc["updated_at"] = now
    doc["order_date"] = doc.get("order_date") or today_iso()
    doc["is_demo"] = False
    await db.orders.insert_one(dict(doc))
    if doc["client_name"] and not await db.clients.find_one({"name": doc["client_name"]}):
        await db.clients.insert_one(Client(name=doc["client_name"]).model_dump())
    await log_activity(doc["id"], user, "Order created", doc["order_number"])
    names = await _user_names()
    return _shape(doc, names, ["view", "edit", "upload", "download", "export"])


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, request: Request):
    user = await current_user(request)
    order = await require_order(order_id, user, "view")
    names = await _user_names()
    return _shape(order, names, order["_perms"])


@router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, payload: OrderCreate, request: Request):
    user = await current_user(request)
    order = await require_order(order_id, user, "edit")
    update = payload.model_dump(exclude_none=True)
    update.pop("order_number", None)
    update["updated_at"] = datetime.now(timezone.utc)
    await db.orders.update_one({"id": order_id}, {"$set": update})
    await log_activity(order_id, user, "Order edited", order["order_number"])
    fresh = await db.orders.find_one({"id": order_id})
    names = await _user_names()
    return _shape(fresh or {}, names, order["_perms"])


@router.patch("/orders/{order_id}/status", response_model=Order)
async def update_status(order_id: str, payload: StatusUpdate, request: Request):
    user = await current_user(request)
    order = await require_order(order_id, user, "edit")
    if payload.status not in STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status")
    if payload.status in ("APPROVED", "COMPLETED") and "approve" not in order["_perms"]:
        raise HTTPException(status_code=403, detail="You are not permitted to approve this order")
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": payload.status, "is_draft": False, "updated_at": datetime.now(timezone.utc)}})
    await log_activity(order_id, user, "Status changed", f"{order['status']} -> {payload.status}")
    fresh = await db.orders.find_one({"id": order_id})
    names = await _user_names()
    return _shape(fresh or {}, names, order["_perms"])


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, request: Request):
    user = await admin_user(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"deleted": True}})
    await log_activity(order_id, user, "Order deleted (archived)", order["order_number"])
    return {"ok": True}


# ---------- findings ----------
@router.get("/orders/{order_id}/findings", response_model=List[Finding])
async def list_findings(order_id: str, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "view")
    rows = await db.findings.find({"order_id": order_id}).to_list(500)
    return [Finding(**{k: v for k, v in r.items() if k != "_id"}) for r in rows]


@router.post("/orders/{order_id}/findings", response_model=Finding)
async def add_finding(order_id: str, payload: FindingCreate, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "edit")
    finding = Finding(order_id=order_id, created_by_name=user["name"], **payload.model_dump())
    await db.findings.insert_one(finding.model_dump())
    await log_activity(order_id, user, "Search finding added", finding.finding_type)
    return finding


@router.delete("/orders/{order_id}/findings/{finding_id}")
async def delete_finding(order_id: str, finding_id: str, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "edit")
    await db.findings.delete_one({"id": finding_id, "order_id": order_id})
    await log_activity(order_id, user, "Search finding deleted", finding_id)
    return {"ok": True}


# ---------- access ----------
@router.get("/orders/{order_id}/access", response_model=List[AccessGrant])
async def list_access(order_id: str, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "view")
    grants = await db.access_grants.find({"order_id": order_id}).to_list(200)
    return [AccessGrant(**{k: v for k, v in g.items() if k != "_id"}) for g in grants]


@router.post("/orders/{order_id}/access", response_model=AccessGrant)
async def grant_access(order_id: str, payload: AccessGrantCreate, request: Request):
    admin = await admin_user(request)
    order = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    target = await db.users.find_one({"id": payload.user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    grant = AccessGrant(order_id=order_id, user_id=payload.user_id, user_name=target["name"],
                        user_email=target["email"], user_role=target["role"],
                        permissions=payload.permissions or ["view"])
    await db.access_grants.delete_many({"order_id": order_id, "user_id": payload.user_id})
    await db.access_grants.insert_one(grant.model_dump())
    await log_activity(order_id, admin, "User access changed",
                       f"{target['name']}: {', '.join(grant.permissions)}")
    return grant


@router.delete("/orders/{order_id}/access/{grant_id}")
async def revoke_access(order_id: str, grant_id: str, request: Request):
    admin = await admin_user(request)
    await db.access_grants.delete_one({"id": grant_id, "order_id": order_id})
    await log_activity(order_id, admin, "User access revoked", grant_id)
    return {"ok": True}


# ---------- activity ----------
@router.get("/orders/{order_id}/activity", response_model=List[ActivityEntry])
async def order_activity(order_id: str, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "view")
    rows = await db.activity_logs.find({"order_id": order_id}).sort("created_at", -1).to_list(300)
    return [ActivityEntry(**{k: v for k, v in r.items() if k != "_id"}) for r in rows]


@router.get("/activity", response_model=List[ActivityEntry])
async def all_activity(request: Request):
    await admin_user(request)
    rows = await db.activity_logs.find().sort("created_at", -1).to_list(200)
    return [ActivityEntry(**{k: v for k, v in r.items() if k != "_id"}) for r in rows]


@router.get("/clients", response_model=List[Client])
async def list_clients(request: Request):
    await current_user(request)
    rows = await db.clients.find().to_list(500)
    return [Client(**{k: v for k, v in r.items() if k != "_id"}) for r in rows]


@router.get("/orders/{order_id}/permissions")
async def my_permissions(order_id: str, request: Request):
    user = await current_user(request)
    order = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"permissions": sorted(await order_perms(order, user))}
