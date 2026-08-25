# Jed Red Solutions Pvt Ltd — Title Search Workspace (Living Spec)

Branding: company name "Jed Red Solutions Pvt Ltd", website www.jedredsolutions.in,
logo at `frontend/public/jedred-logo.png` (shown in sidebar + login). The name used on exported
reports comes from the `settings` collection (`company_name`), editable in Settings by an admin —
never hardcode it in report code.

## What the app does
Workspace for managing **Title Search Orders** and producing **Title Search Summary Reports**.
Manual research workflow (no Gmail/scraping in V1): create order → upload raw documents →
enter document information → record search findings → timeline → generate report (deterministic
draft, optionally polished by Gemini 3 Flash) → edit → save version → approve → export PDF/DOCX →
export order package ZIP → share with authorized users.

## Stack
- Backend: FastAPI, all routes on `api_router` (`/api`), Mongo via motor.
  - `routers/auth.py` (login/logout/me), `routers/orders.py` (orders, dashboard, findings,
    access, activity, clients), `routers/documents.py` (upload/download/replace/delete + metadata),
    `routers/reports.py` (generate/versions/approve/export/package), `routers/admin.py` (users, settings).
  - `lib/auth.py` — pbkdf2 password hashing, JWT in httpOnly cookie `ts_session`, `order_perms`,
    `require_order(order_id, user, perm)`, `visible_order_filter`, `log_activity`.
  - Raw files: `backend/uploads/<doc_uuid><ext>`; only metadata in Mongo; downloads gated by
    `download` permission. Allowed: pdf/docx/doc/jpg/jpeg/png/tif/tiff, max 25 MB.
- Frontend: Vite + React 19 + Tailwind v4. Pages: Login, Dashboard, OrdersList, CreateOrder,
  OrderWorkspace (8 tabs), DocumentsAll, Users, Settings. Types mirrored in `src/lib/types.ts`.

## Collections (entities)
users, clients, orders, documents (embeds `info` = Document Information),
findings, report_versions (each with `sections`), access_grants, activity_logs, settings.

## Roles
- ADMIN: everything, manages users/settings/order sharing.
- RESEARCHER: view/edit/upload/download/export on orders assigned to or created by them.
- REVIEWER: view/edit/download/approve/export on all orders.
- CLIENT: only orders explicitly shared via access_grants, with the granted permissions
  (report export limited to the latest **Approved** version).

## Order statuses
NEW, IN PROGRESS, DOCUMENTS COLLECTED, REPORT PREPARATION, PENDING REVIEW, APPROVED, COMPLETED,
ON HOLD, CANCELLED. Approve/complete requires the `approve` permission.

## Demo/seed facts (`cd /app/backend && python seed.py`, idempotent)
- 3 demo clients: "Meridian Legal LLP (Demo)", "Southbank Housing Finance (Demo)", "Verma & Associates (Demo)".
- 5 orders ORDER-2026-001..005 (NEW, IN PROGRESS, PENDING REVIEW, COMPLETED, ON HOLD), all assigned
  to Ravi Kumar (researcher), created by admin.
- 5 demo documents (real generated PDFs) on orders 002, 003, 004; 3 findings; 3 report versions on
  ORDER-2026-004 (v1 Draft, v2 Revised, v3 Approved).
- ORDER-2026-004 is shared with the CLIENT demo user (view/download/export). No other order is shared,
  so the client must not be able to open ORDER-2026-001.
- Everything seeded carries `is_demo: true`.

## Deliberate V1 scope notes
- Mongo (document DB) is used instead of a relational DB; structured data is kept in separate
  collections with id references rather than one JSON blob.
- Report editor is a section-based editor (heading + body textarea per section), not a WYSIWYG.
- Document Index in the ZIP is a .txt file, not a PDF.
- AI polish only rewrites narrative sections and falls back silently to the deterministic draft.
