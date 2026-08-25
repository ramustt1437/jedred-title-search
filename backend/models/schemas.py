"""Pydantic v2 request/response models. Mirrored by TS interfaces in frontend/src/lib/types.ts."""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


def _id() -> str:
    return str(uuid.uuid4())


# ---------- users ----------
class User(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    email: str
    role: str = "RESEARCHER"
    active: bool = True
    is_demo: bool = False


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "RESEARCHER"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------- clients ----------
class Client(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    contact_email: str = ""
    is_demo: bool = False


# ---------- orders ----------
class OrderBase(BaseModel):
    client_name: str = ""
    client_reference: str = ""
    order_date: str = ""
    due_date: str = ""
    priority: str = "Normal"
    assigned_to: Optional[str] = None
    status: str = "NEW"
    # property / search
    property_owner: str = ""
    applicant_name: str = ""
    property_address: str = ""
    village: str = ""
    taluk: str = ""
    district: str = ""
    state: str = ""
    survey_number: str = ""
    sub_division_number: str = ""
    plot_number: str = ""
    khata_number: str = ""
    registration_district: str = ""
    registration_office: str = ""
    search_period: str = ""
    other_identifying_info: str = ""
    # instructions
    client_instructions: str = ""
    internal_notes: str = ""
    additional_search_info: str = ""


class OrderCreate(OrderBase):
    order_number: Optional[str] = None
    is_draft: bool = False


class Order(OrderBase):
    id: str = Field(default_factory=_id)
    order_number: str
    is_draft: bool = False
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    assigned_to_name: str = ""
    is_demo: bool = False
    permissions: List[str] = []


class StatusUpdate(BaseModel):
    status: str


# ---------- documents ----------
class DocumentInfo(BaseModel):
    registration_date: str = ""
    seller: str = ""
    buyer: str = ""
    donor: str = ""
    donee: str = ""
    mortgagor: str = ""
    mortgagee: str = ""
    other_parties: str = ""
    prop_address: str = ""
    survey_number: str = ""
    sub_division_number: str = ""
    plot_number: str = ""
    extent_area: str = ""
    boundaries: str = ""
    village: str = ""
    taluk: str = ""
    district: str = ""
    state: str = ""
    transaction_type: str = ""
    consideration_amount: str = ""
    execution_date: str = ""
    nature_of_transaction: str = ""
    important_info: str = ""
    researcher_notes: str = ""
    potential_issues: str = ""
    source_reference: str = ""


class DocumentRecord(BaseModel):
    id: str = Field(default_factory=_id)
    order_id: str
    doc_type: str = "Other"
    doc_number: str = ""
    doc_date: str = ""
    source: str = ""
    source_url: str = ""
    registration_number: str = ""
    registration_office: str = ""
    description: str = ""
    notes: str = ""
    file_name: str = ""
    file_size: int = 0
    content_type: str = ""
    uploaded_by_name: str = ""
    uploaded_at: Optional[datetime] = None
    timeline_index: int = 0
    info: DocumentInfo = Field(default_factory=DocumentInfo)
    upload_history: List[str] = []
    is_demo: bool = False


class DocumentMetaUpdate(BaseModel):
    doc_type: Optional[str] = None
    doc_number: Optional[str] = None
    doc_date: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    registration_number: Optional[str] = None
    registration_office: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    timeline_index: Optional[int] = None
    info: Optional[DocumentInfo] = None


# ---------- findings ----------
class Finding(BaseModel):
    id: str = Field(default_factory=_id)
    order_id: str
    finding_type: str = ""
    description: str = ""
    source: str = ""
    source_url: str = ""
    date_found: str = ""
    related_document_id: Optional[str] = None
    researcher_notes: str = ""
    importance: str = "Medium"
    created_by_name: str = ""
    is_demo: bool = False


class FindingCreate(BaseModel):
    finding_type: str = ""
    description: str = ""
    source: str = ""
    source_url: str = ""
    date_found: str = ""
    related_document_id: Optional[str] = None
    researcher_notes: str = ""
    importance: str = "Medium"


# ---------- reports ----------
class ReportSection(BaseModel):
    heading: str
    body: str


class ReportVersion(BaseModel):
    id: str = Field(default_factory=_id)
    order_id: str
    version: int
    status: str = "Draft"
    ai_generated: bool = False
    sections: List[ReportSection] = []
    created_by_name: str = ""
    created_at: Optional[datetime] = None
    change_note: str = ""


class ReportSave(BaseModel):
    sections: List[ReportSection]
    change_note: str = "Revised"


class GenerateRequest(BaseModel):
    use_ai: bool = True


# ---------- access ----------
class AccessGrant(BaseModel):
    id: str = Field(default_factory=_id)
    order_id: str
    user_id: str
    user_name: str = ""
    user_email: str = ""
    user_role: str = ""
    permissions: List[str] = []


class AccessGrantCreate(BaseModel):
    user_id: str
    permissions: List[str] = ["view"]


# ---------- activity ----------
class ActivityEntry(BaseModel):
    id: str
    order_id: Optional[str] = None
    user_name: str = ""
    action: str
    detail: str = ""
    created_at: Optional[datetime] = None


# ---------- settings ----------
class AppSettings(BaseModel):
    company_name: str = "Title Search Services"
    company_address: str = ""
    company_contact: str = ""
    report_footer: str = ""
    document_types: List[str] = []


# ---------- dashboard ----------
class DashboardStats(BaseModel):
    total: int
    new: int
    in_progress: int
    pending_review: int
    completed: int
    overdue: int


class Dashboard(BaseModel):
    stats: DashboardStats
    recent: List[Order]
    due_soon: List[Order]
    recently_completed: List[Order]
    assigned_to_me: List[Order]


class PackageRequest(BaseModel):
    document_ids: List[str] = []
    include_index: bool = True
