"""Idempotent demo data seeder.  Run:  cd /app/backend && python seed.py
All demo records carry is_demo=True so they can be removed later."""
import asyncio
import io
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from lib.auth import hash_password
from lib.db import db
from routers.admin import DEFAULT_DOC_TYPES
from routers.documents import UPLOAD_DIR

USERS = [
    ("Asha Menon", "admin@titlesearch.com", "ADMIN", "Admin@123"),
    ("Ravi Kumar", "researcher@titlesearch.com", "RESEARCHER", "Research@123"),
    ("Priya Nair", "reviewer@titlesearch.com", "REVIEWER", "Review@123"),
    ("Client User", "client@titlesearch.com", "CLIENT", "Client@123"),
]
CLIENTS = ["Meridian Legal LLP (Demo)", "Southbank Housing Finance (Demo)", "Verma & Associates (Demo)"]


def make_pdf(title: str, lines: list) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    buf = io.BytesIO()
    st = getSampleStyleSheet()
    story = [Paragraph(title, st["Title"]), Spacer(1, 10)]
    for ln in lines:
        story.append(Paragraph(ln, st["Normal"]))
        story.append(Spacer(1, 4))
    SimpleDocTemplate(buf, pagesize=A4).build(story)
    return buf.getvalue()


async def main() -> None:
    today = datetime.now(timezone.utc).date()
    await db.settings.update_one({"id": "app"}, {"$set": {
        "id": "app", "company_name": "Jed Red Solutions Pvt Ltd",
        "company_address": "www.jedredsolutions.in",
        "company_contact": "www.jedredsolutions.in",
        "report_footer": "This report is a summary of documents supplied to Jed Red Solutions Pvt Ltd. It is not a legal opinion.",
        "document_types": DEFAULT_DOC_TYPES}}, upsert=True)

    ids = {}
    for name, email, role, pwd in USERS:
        existing = await db.users.find_one({"email": email})
        if existing:
            ids[role] = existing["id"]
            continue
        uid = str(uuid.uuid4())
        await db.users.insert_one({"id": uid, "name": name, "email": email, "role": role,
                                   "active": True, "is_demo": True,
                                   "password_hash": hash_password(pwd)})
        ids[role] = uid

    for c in CLIENTS:
        if not await db.clients.find_one({"name": c}):
            await db.clients.insert_one({"id": str(uuid.uuid4()), "name": c,
                                         "contact_email": "orders@example.com", "is_demo": True})

    if await db.orders.count_documents({"is_demo": True}) > 0:
        print("Demo orders already present — nothing to do.")
        return

    specs = [
        ("ORDER-2026-001", CLIENTS[0], "NEW", "High", -2, 5, "Ganesh Iyer", "No. 42, 5th Cross, Jayanagar, Bengaluru", "Bengaluru Urban", "Karnataka", "112/3"),
        ("ORDER-2026-002", CLIENTS[1], "IN PROGRESS", "Normal", -8, 3, "Lakshmi Devi", "Plot 18, Sector 4, Whitefield, Bengaluru", "Bengaluru Urban", "Karnataka", "77/1"),
        ("ORDER-2026-003", CLIENTS[2], "PENDING REVIEW", "Urgent", -14, -1, "Mohan Rao", "Survey 208, Kadugodi Village, Bengaluru East", "Bengaluru Urban", "Karnataka", "208"),
        ("ORDER-2026-004", CLIENTS[0], "COMPLETED", "Normal", -30, -12, "Sunita Shetty", "Door No. 9, Car Street, Mangaluru", "Dakshina Kannada", "Karnataka", "56/2A"),
        ("ORDER-2026-005", CLIENTS[1], "ON HOLD", "Low", -20, 10, "Anwar Sheikh", "Khata 431, Hoskote Town", "Bengaluru Rural", "Karnataka", "431"),
    ]
    order_ids = {}
    for num, cl, status, prio, made, due, owner, addr, district, state, survey in specs:
        oid = str(uuid.uuid4())
        order_ids[num] = oid
        await db.orders.insert_one({
            "id": oid, "order_number": num, "client_name": cl,
            "client_reference": f"REF/{num[-3:]}/2026",
            "order_date": str(today + timedelta(days=made)), "due_date": str(today + timedelta(days=due)),
            "priority": prio, "assigned_to": ids["RESEARCHER"], "status": status, "is_draft": False,
            "property_owner": owner, "applicant_name": f"{owner.split()[0]} (applicant)",
            "property_address": addr, "village": addr.split(",")[-1].strip(), "taluk": "North Taluk",
            "district": district, "state": state, "survey_number": survey,
            "sub_division_number": "2", "plot_number": "18", "khata_number": f"KH-{survey}",
            "registration_district": district, "registration_office": f"Sub-Registrar, {district}",
            "search_period": "1994 - 2026", "other_identifying_info": "Corner site, east facing",
            "client_instructions": ("DEMO: Please conduct a 30 year title search for the above property. "
                                   "Confirm the chain of title, verify encumbrances and report any pending litigation. "
                                   "Client reference must appear on the report."),
            "internal_notes": "DEMO order — safe to delete.",
            "additional_search_info": "Netro Online records checked for the search period.",
            "created_by": ids["ADMIN"], "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc), "is_demo": True})
        await db.activity_logs.insert_one({"id": str(uuid.uuid4()), "order_id": oid,
                                           "user_id": ids["ADMIN"], "user_name": "Asha Menon",
                                           "action": "Order created", "detail": num,
                                           "created_at": datetime.now(timezone.utc)})

    doc_specs = [
        ("ORDER-2026-002", "Sale Deed", "SD-1487/2011", "2011-06-14", "Ganesh Iyer", "Lakshmi Devi", "24,50,000"),
        ("ORDER-2026-002", "Encumbrance Certificate", "EC-9921/2026", "2026-01-08", "", "", ""),
        ("ORDER-2026-003", "Gift Deed", "GD-233/2004", "2004-11-02", "Mohan Rao Sr.", "Mohan Rao", "Nil"),
        ("ORDER-2026-004", "Sale Deed", "SD-771/1998", "1998-03-21", "K. Shetty", "Sunita Shetty", "3,20,000"),
        ("ORDER-2026-004", "Mutation Record", "MR-55/1999", "1999-01-15", "", "", ""),
    ]
    for i, (onum, dtype, dnum, ddate, seller, buyer, amount) in enumerate(doc_specs):
        did = str(uuid.uuid4())
        pdf = make_pdf(f"{dtype} — {dnum} (DEMO DOCUMENT)", [
            f"Document number: {dnum}", f"Document date: {ddate}",
            f"Transferor: {seller or 'Not applicable'}", f"Transferee: {buyer or 'Not applicable'}",
            f"Consideration: {amount or 'Not applicable'}",
            "This is a demo document generated for testing the Title Search workspace."])
        path = Path(UPLOAD_DIR) / f"{did}.pdf"
        path.write_bytes(pdf)
        await db.documents.insert_one({
            "id": did, "order_id": order_ids[onum], "doc_type": dtype, "doc_number": dnum,
            "doc_date": ddate, "source": "Netro Online (demo)",
            "source_url": "https://www.netro-online.example/records", "registration_number": dnum,
            "registration_office": "Sub-Registrar, Bengaluru Urban",
            "description": f"DEMO {dtype} obtained from public records",
            "notes": "Demo document.", "file_name": f"{dtype.replace(' ', '_')}_{dnum}.pdf",
            "file_size": len(pdf), "content_type": "application/pdf", "stored_path": str(path),
            "uploaded_by_name": "Ravi Kumar", "uploaded_at": datetime.now(timezone.utc),
            "timeline_index": i, "is_demo": True,
            "upload_history": ["Uploaded by Ravi Kumar (demo seed)"],
            "info": {"registration_date": ddate, "seller": seller, "buyer": buyer,
                     "donor": seller if dtype == "Gift Deed" else "", "donee": buyer if dtype == "Gift Deed" else "",
                     "mortgagor": "", "mortgagee": "", "other_parties": "",
                     "prop_address": "As per order property details", "survey_number": "112/3",
                     "sub_division_number": "2", "plot_number": "18", "extent_area": "2400 sq ft",
                     "boundaries": "East: Road, West: Site 41, North: Site 43, South: Park",
                     "village": "Jayanagar", "taluk": "North Taluk", "district": "Bengaluru Urban",
                     "state": "Karnataka",
                     "transaction_type": dtype, "consideration_amount": amount,
                     "execution_date": ddate, "nature_of_transaction": "Absolute transfer" if "Sale" in dtype else dtype,
                     "important_info": f"DEMO: {dtype} {dnum} dated {ddate} records the transfer described above. "
                                        "Schedule of property matches the order property details.",
                     "researcher_notes": "Demo notes entered by the researcher.",
                     "potential_issues": "None observed in this demo document."
                                          if dtype != "Encumbrance Certificate" else "EC covers 2011-2026 only.",
                     "source_reference": "Netro Online demo record"}})

    for onum, ftype, desc, imp in [
        ("ORDER-2026-002", "Encumbrance", "Mortgage of 2014 appears released in 2019 (demo).", "High"),
        ("ORDER-2026-003", "Litigation", "No pending suits found in the district court index (demo).", "Medium"),
        ("ORDER-2026-004", "Revenue Record", "Khata transferred to current owner in 1999 (demo).", "High"),
    ]:
        await db.findings.insert_one({"id": str(uuid.uuid4()), "order_id": order_ids[onum],
                                      "finding_type": ftype, "description": desc,
                                      "source": "Netro Online (demo)",
                                      "source_url": "https://www.netro-online.example/search",
                                      "date_found": str(today - timedelta(days=3)),
                                      "related_document_id": None,
                                      "researcher_notes": "Demo finding.", "importance": imp,
                                      "created_by_name": "Ravi Kumar", "is_demo": True})

    # one completed, approved report on ORDER-2026-004
    from routers.reports import _build_sections
    order4 = await db.orders.find_one({"order_number": "ORDER-2026-004"})
    sections = [s.model_dump() for s in await _build_sections(order4)]
    for v, (status, note, who) in enumerate([
            ("Draft", "Draft generated from entered data", "Ravi Kumar"),
            ("Revised", "Revised after internal check", "Ravi Kumar"),
            ("Approved", "Approved by reviewer", "Priya Nair")], start=1):
        await db.report_versions.insert_one({
            "id": str(uuid.uuid4()), "order_id": order4["id"], "version": v, "status": status,
            "ai_generated": v == 1, "sections": sections, "created_by_name": who,
            "created_at": datetime.now(timezone.utc), "change_note": note})

    await db.access_grants.insert_one({
        "id": str(uuid.uuid4()), "order_id": order4["id"], "user_id": ids["CLIENT"],
        "user_name": "Client User", "user_email": "client@titlesearch.com", "user_role": "CLIENT",
        "permissions": ["view", "download", "export"]})

    print("Demo data seeded: 4 users, 3 clients, 5 orders, 5 documents, 3 findings, 3 report versions.")


if __name__ == "__main__":
    asyncio.run(main())
