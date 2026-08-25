import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from lib.auth import current_user, log_activity, require_order
from lib.db import db
from models.schemas import DocumentMetaUpdate, DocumentRecord

router = APIRouter(tags=["documents"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".tif", ".tiff"}
MAX_BYTES = 25 * 1024 * 1024


def _clean(doc: dict) -> DocumentRecord:
    return DocumentRecord(**{k: v for k, v in doc.items() if k not in ("_id", "stored_path")})


def _stored_path(doc_id: str, filename: str) -> Path:
    return UPLOAD_DIR / f"{doc_id}{Path(filename).suffix.lower()}"


async def _save(upload: UploadFile, doc_id: str) -> dict:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(status_code=422,
                            detail=f"File type '{suffix or 'unknown'}' is not allowed. Allowed: PDF, DOCX, JPG, PNG, TIFF")
    data = await upload.read()
    if len(data) == 0:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=422, detail="File exceeds the 25 MB limit")
    path = _stored_path(doc_id, upload.filename or "file")
    path.write_bytes(data)
    return {"stored_path": str(path), "file_name": upload.filename or path.name,
            "file_size": len(data), "content_type": upload.content_type or ""}


@router.get("/orders/{order_id}/documents", response_model=List[DocumentRecord])
async def list_documents(order_id: str, request: Request):
    user = await current_user(request)
    await require_order(order_id, user, "view")
    rows = await db.documents.find({"order_id": order_id, "deleted": {"$ne": True}}).to_list(500)
    rows.sort(key=lambda r: (r.get("timeline_index", 0), r.get("doc_date", "")))
    return [_clean(r) for r in rows]


@router.post("/orders/{order_id}/documents", response_model=DocumentRecord)
async def upload_document(order_id: str, request: Request, file: UploadFile = File(...),
                          doc_type: str = Form("Other"), doc_number: str = Form(""),
                          doc_date: str = Form(""), source: str = Form(""),
                          source_url: str = Form(""), registration_number: str = Form(""),
                          registration_office: str = Form(""), description: str = Form(""),
                          notes: str = Form("")):
    user = await current_user(request)
    order = await require_order(order_id, user, "upload")
    doc_id = str(uuid.uuid4())
    saved = await _save(file, doc_id)
    count = await db.documents.count_documents({"order_id": order_id})
    record = DocumentRecord(
        id=doc_id, order_id=order_id, doc_type=doc_type, doc_number=doc_number,
        doc_date=doc_date, source=source, source_url=source_url,
        registration_number=registration_number, registration_office=registration_office,
        description=description, notes=notes, uploaded_by_name=user["name"],
        uploaded_at=datetime.now(timezone.utc), timeline_index=count,
        file_name=saved["file_name"], file_size=saved["file_size"],
        content_type=saved["content_type"],
        upload_history=[f"{saved['file_name']} uploaded by {user['name']} on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"],
    )
    stored = record.model_dump()
    stored["stored_path"] = saved["stored_path"]
    await db.documents.insert_one(stored)
    await log_activity(order_id, user, "Document uploaded", f"{doc_type} — {saved['file_name']}")
    if order["status"] == "NEW":
        await db.orders.update_one({"id": order_id}, {"$set": {"status": "IN PROGRESS"}})
    return record


@router.put("/documents/{doc_id}", response_model=DocumentRecord)
async def update_document(doc_id: str, payload: DocumentMetaUpdate, request: Request):
    user = await current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await require_order(doc["order_id"], user, "edit")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "info" in update:
        update["info"] = payload.info.model_dump() if payload.info else {}
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    await log_activity(doc["order_id"], user, "Document information changed",
                       f"{doc.get('doc_type')} {doc.get('doc_number') or ''}".strip())
    fresh = await db.documents.find_one({"id": doc_id})
    return _clean(fresh or {})


@router.post("/documents/{doc_id}/replace", response_model=DocumentRecord)
async def replace_file(doc_id: str, request: Request, file: UploadFile = File(...)):
    user = await current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await require_order(doc["order_id"], user, "upload")
    saved = await _save(file, doc_id)
    history = list(doc.get("upload_history", []))
    history.append(f"{saved['file_name']} replaced by {user['name']} on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    await db.documents.update_one({"id": doc_id}, {"$set": {**saved, "upload_history": history}})
    await log_activity(doc["order_id"], user, "Document replaced", saved["file_name"])
    fresh = await db.documents.find_one({"id": doc_id})
    return _clean(fresh or {})


@router.get("/documents/{doc_id}/file")
async def download_document(doc_id: str, request: Request, inline: bool = False):
    user = await current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await require_order(doc["order_id"], user, "download")
    path = doc.get("stored_path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Stored file is missing")
    return FileResponse(path, filename=doc.get("file_name") or "document",
                        media_type=doc.get("content_type") or "application/octet-stream",
                        content_disposition_type="inline" if inline else "attachment")


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, request: Request):
    user = await current_user(request)
    doc = await db.documents.find_one({"id": doc_id, "deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await require_order(doc["order_id"], user, "edit")
    await db.documents.update_one({"id": doc_id}, {"$set": {"deleted": True}})
    await log_activity(doc["order_id"], user, "Document deleted",
                       f"{doc.get('doc_type')} — {doc.get('file_name')}")
    return {"ok": True}


@router.get("/documents", response_model=List[DocumentRecord])
async def all_documents(request: Request, search: str = ""):
    """Documents across every order the user may view."""
    from lib.auth import visible_order_filter
    user = await current_user(request)
    orders = await db.orders.find(await visible_order_filter(user)).to_list(1000)
    ids = [o["id"] for o in orders]
    query: dict = {"order_id": {"$in": ids}, "deleted": {"$ne": True}}
    if search:
        rx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [{"doc_number": rx}, {"doc_type": rx}, {"registration_number": rx},
                        {"file_name": rx}, {"description": rx}]
    rows = await db.documents.find(query).to_list(500)
    return [_clean(r) for r in rows]
