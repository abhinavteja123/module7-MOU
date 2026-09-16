"""FastAPI business layer for the MOU Tracker.

The frontend talks to this service; this service owns multi-table writes,
status-history rules, auth attribution, and private PDF storage.
"""
from datetime import date, datetime, time, timezone
from enum import Enum
import base64
import hashlib
import json
import logging
import os
import re
import secrets
from typing import Any, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, ConfigDict, Field
import jwt
from dotenv import load_dotenv

load_dotenv()

try:
    from supabase import Client, create_client
except ImportError:  # Allows linting the file before backend deps are installed.
    Client = Any  # type: ignore[misc,assignment]
    create_client = None


class MOUStatus(str, Enum):
    proposed = "proposed"
    under_discussion = "under_discussion"
    drafted = "drafted"
    legal_review = "legal_review"
    approval_pending = "approval_pending"
    approved = "approved"
    signed_by_client = "signed_by_client"
    signed_by_university = "signed_by_university"
    signed_by_both = "signed_by_both"
    active = "active"
    expected_renewal = "expected_renewal"
    expired = "expired"
    renewal = "renewal"
    closed = "closed"
    terminated = "terminated"


class CompanyCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=120)
    mou_scope: str = Field(min_length=1, max_length=10000)
    deliverables: str = Field(min_length=1, max_length=10000)
    effective_date: date
    expiring_date: date
    initial_status: MOUStatus
    internal_spoc_name: str = Field(min_length=1, max_length=200)
    internal_spoc_email: str = Field(min_length=3, max_length=320)
    internal_spoc_phone: str = Field(min_length=3, max_length=50)
    contact_name: str = Field(min_length=1, max_length=200)
    contact_email: str = Field(min_length=3, max_length=320)
    contact_phone: str = Field(min_length=3, max_length=50)
    document_filename: str = Field(min_length=1, max_length=255)
    document_content_type: str = Field(default="application/pdf")
    document_base64: str = Field(min_length=1)
    activity_name: Optional[str] = None
    activity_notes: Optional[str] = None
    activity_date: Optional[date] = None
    activity_time: Optional[time] = None


class CompanyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=120)
    mou_scope: str = Field(min_length=1, max_length=10000)
    deliverables: str = Field(min_length=1, max_length=10000)
    expiring_date: date
    internal_spoc_name: str = Field(min_length=1, max_length=200)
    internal_spoc_email: str = Field(min_length=3, max_length=320)
    internal_spoc_phone: str = Field(min_length=3, max_length=50)
    contact_name: str = Field(min_length=1, max_length=200)
    contact_email: str = Field(min_length=3, max_length=320)
    contact_phone: str = Field(min_length=3, max_length=50)


class StatusChange(BaseModel):
    status: MOUStatus
    status_date: date
    status_time: time
    notes: Optional[str] = None


class StatusCorrection(BaseModel):
    status: MOUStatus
    status_date: Optional[date] = None
    status_time: Optional[time] = None
    notes: Optional[str] = None


class ActivityCreate(BaseModel):
    activity_name: str = Field(min_length=1, max_length=5000)
    activity_notes: Optional[str] = Field(default=None, max_length=5000)
    activity_date: date
    activity_time: time


class LoginRequest(BaseModel):
    email: str
    password: str


class AccessLevel(str, Enum):
    view = "view"
    edit = "edit"


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)
    access_level: AccessLevel = AccessLevel.view


class UserAccessUpdate(BaseModel):
    access_level: AccessLevel


class OwnPasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)


app = FastAPI(title="MOU Tracker API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase_url = os.getenv("SUPABASE_URL")
supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_configured = bool(create_client and supabase_url and supabase_service_role_key)

jwt_secret = os.getenv("JWT_SECRET")
jwt_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
max_pdf_bytes = int(os.getenv("MAX_PDF_BYTES", str(10 * 1024 * 1024)))


def validate_company_dates(effective_date: date, expiring_date: date) -> None:
    if expiring_date < effective_date:
        raise HTTPException(422, "Expiry date must be on or after the effective / signed date")


def safe_pdf_filename(filename: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", os.path.basename(filename)).strip(". ")
    if not name.lower().endswith(".pdf"):
        name = f"{name or 'mou-signed-copy'}.pdf"
    return name[:255]


def decode_pdf(document_base64: str, content_type: str) -> bytes:
    if content_type.lower() != "application/pdf":
        raise HTTPException(415, "Only PDF files are accepted")
    try:
        document = base64.b64decode(document_base64, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "The MOU signed copy is not valid PDF data") from exc
    if not document.startswith(b"%PDF-"):
        raise HTTPException(422, "The MOU signed copy must be a valid PDF file")
    if len(document) > max_pdf_bytes:
        raise HTTPException(413, f"PDF files must be {max_pdf_bytes // 1024 // 1024} MB or smaller")
    return document


def password_hash(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def password_matches(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, encoded_salt, encoded_digest = stored.split("$")
        if algorithm != "pbkdf2_sha256": return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode())
        expected = base64.urlsafe_b64decode(encoded_digest.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def public_profile(profile: Optional[dict]) -> Optional[dict]:
    if not profile: return None
    return {key: profile.get(key) for key in ("id", "email", "display_name", "role", "access_level", "is_active", "created_at")}


def audit_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str, sort_keys=True)
    return str(value)


def audit_change(db: Client, entity_type: str, entity_id: str, field_name: str, old_value: Any, new_value: Any, user_id: str) -> None:
    old_text = audit_value(old_value)
    new_text = audit_value(new_value)
    if old_text == new_text:
        return
    db.table("audit_log").insert({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "field_name": field_name,
        "old_value": old_text,
        "new_value": new_text,
        "changed_by": user_id,
    }).execute()


@app.on_event("startup")
def startup() -> None:
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET must be configured")
    if not supabase_configured:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")


def require_supabase() -> Client:
    if not supabase_configured or not create_client:
        raise HTTPException(503, "Supabase is not configured on the API")
    # The synchronous Supabase client maintains an HTTP connection pool. A fresh
    # client for each FastAPI request avoids shared-client HTTP/2 read errors
    # when the browser polls companies and users concurrently.
    return create_client(supabase_url, supabase_service_role_key)


@app.exception_handler(httpx.HTTPError)
async def supabase_transport_error(_: Request, exc: httpx.HTTPError) -> JSONResponse:
    logging.exception("Supabase transport error", exc_info=exc)
    return JSONResponse(status_code=503, content={"detail": "The database is temporarily unavailable. Please retry."})


def current_user(authorization: Optional[str] = Header(default=None), db: Client = Depends(require_supabase)) -> dict:
    """Verify an app-issued JWT and return its public.users profile."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "An app JWT bearer token is required")
    token = authorization.split(" ", 1)[1]
    try:
        claims = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        user_id = claims["sub"]
    except (jwt.PyJWTError, KeyError, TypeError) as exc:
        raise HTTPException(401, "Invalid or expired app JWT") from exc
    try:
        profiles = db.table("users").select("*").eq("id", user_id).limit(1).execute().data or []
    except httpx.HTTPError:
        raise
    except Exception as exc:
        logging.exception("Could not load app JWT user profile")
        raise HTTPException(503, "The database is temporarily unavailable. Please retry.") from exc
    if not profiles:
        raise HTTPException(401, "Invalid or expired app JWT")
    profile = profiles[0]
    if not profile.get("is_active", True):
        raise HTTPException(401, "This tracker account has been removed")
    return profile


def require_edit_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "super_admin" and user.get("access_level", "view") != "edit":
        raise HTTPException(403, "Edit access is required for this action")
    return user


def require_super_admin(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Super-admin access is required for user management")
    return user


def one(db: Client, table: str, **filters: str) -> dict:
    query = db.table(table).select("*")
    for key, value in filters.items():
        query = query.eq(key, value)
    result = query.single().execute().data
    if not result:
        raise HTTPException(404, f"{table} record not found")
    return result


def company_payload(db: Client, company: dict, mou: dict, user_map: dict[str, dict]) -> dict:
    contacts = db.table("contact_details").select("*").eq("mou_id", mou["id"]).order("created_at").execute().data or []
    history = db.table("status_history").select("*").eq("mou_id", mou["id"]).order("changed_at").execute().data or []
    activities = db.table("activity_log").select("*").eq("company_id", company["id"]).order("created_at", desc=True).execute().data or []
    audit_ids = [company["id"], mou["id"], *(contact["id"] for contact in contacts)]
    audit_entries = db.table("audit_log").select("*").in_("entity_id", audit_ids).order("changed_at", desc=True).execute().data or []
    history = [{**entry, "changed_by_user": public_profile(user_map.get(entry.get("changed_by"))), "edited_by_user": public_profile(user_map.get(entry.get("edited_by")))} for entry in history]
    activities = [{**entry, "created_by_user": public_profile(user_map.get(entry.get("created_by")))} for entry in activities]
    audit_entries = [{**entry, "changed_by_user": public_profile(user_map.get(entry.get("changed_by")))} for entry in audit_entries]
    return {
        "id": company["id"], "company_name": company["company_name"], "city": company.get("city"), "created_by": public_profile(user_map.get(company["created_by"])), "created_at": company["created_at"],
        "mou": {**mou, "created_by_user": public_profile(user_map.get(mou["created_by"])), "updated_by_user": public_profile(user_map.get(mou.get("updated_by")))},
        "contact_details": contacts, "status_history": history, "activities": activities, "audit_log": audit_entries,
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True, "supabase_configured": supabase_configured, "timestamp": datetime.now(timezone.utc)}


@app.post("/auth/login")
def login(payload: LoginRequest, db: Client = Depends(require_supabase)) -> dict:
    if not jwt_secret:
        raise HTTPException(503, "JWT_SECRET is not configured")
    try:
        profiles = db.table("users").select("*").eq("email", payload.email.strip().lower()).limit(1).execute().data or []
    except httpx.HTTPError:
        raise
    except Exception as exc:
        logging.exception("Could not load login profile")
        raise HTTPException(503, "The database is temporarily unavailable. Please retry.") from exc
    if not profiles or not profiles[0].get("is_active", True) or not password_matches(payload.password, profiles[0].get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    profile = profiles[0]
    now = datetime.now(timezone.utc)
    claims = {"sub": profile["id"], "email": profile["email"], "iat": now, "exp": now.timestamp() + (jwt_expire_minutes * 60)}
    token = jwt.encode(claims, jwt_secret, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": public_profile(profile)}


@app.get("/users")
def list_users(db: Client = Depends(require_supabase), _: dict = Depends(require_super_admin)) -> dict:
    return {"data": db.table("users").select("id,email,display_name,role,access_level,is_active,created_at").eq("is_active", True).order("display_name").execute().data or []}


@app.post("/users", status_code=201)
def create_user(payload: UserCreate, db: Client = Depends(require_supabase), user: dict = Depends(require_super_admin)) -> dict:
    email = payload.email.strip().lower()
    if db.table("users").select("id").eq("email", email).execute().data:
        raise HTTPException(409, "A user with this email already exists")
    created = db.table("users").insert({"id": str(uuid4()), "email": email, "display_name": payload.display_name.strip(), "password_hash": password_hash(payload.password), "role": "user", "access_level": payload.access_level.value, "is_active": True}).execute().data[0]
    audit_change(db, "user", created["id"], "account_created", None, {"email": email, "access_level": payload.access_level.value}, user["id"])
    return {"data": public_profile(created)}


@app.patch("/users/{user_id}/access")
def update_user_access(user_id: str, payload: UserAccessUpdate, db: Client = Depends(require_supabase), user: dict = Depends(require_super_admin)) -> dict:
    target = one(db, "users", id=user_id)
    if target.get("role") == "super_admin":
        raise HTTPException(409, "The super admin always has full access and cannot be changed here")
    updated = db.table("users").update({"access_level": payload.access_level.value}).eq("id", user_id).execute().data[0]
    audit_change(db, "user", user_id, "access_level", target.get("access_level"), payload.access_level.value, user["id"])
    return {"data": public_profile(updated)}


@app.delete("/users/{user_id}")
def remove_user(user_id: str, db: Client = Depends(require_supabase), user: dict = Depends(require_super_admin)) -> dict:
    target = one(db, "users", id=user_id)
    if target["id"] == user["id"] or target.get("role") == "super_admin":
        raise HTTPException(409, "The super-admin account cannot be removed")
    if not target.get("is_active", True):
        raise HTTPException(409, "This user has already been removed")
    updated = db.table("users").update({"is_active": False}).eq("id", user_id).execute().data[0]
    audit_change(db, "user", user_id, "access_removed", "active", "removed", user["id"])
    return {"data": public_profile(updated)}


@app.put("/users/{user_id}/password")
def reset_user_password(user_id: str, payload: AdminPasswordReset, db: Client = Depends(require_supabase), user: dict = Depends(require_super_admin)) -> dict:
    target = one(db, "users", id=user_id)
    if not target.get("is_active", True):
        raise HTTPException(409, "A removed account cannot receive a new password")
    db.table("users").update({"password_hash": password_hash(payload.new_password)}).eq("id", user_id).execute()
    audit_change(db, "user", user_id, "password_reset", None, "super-admin reset", user["id"])
    return {"ok": True}


@app.put("/auth/password")
def change_own_password(payload: OwnPasswordChange, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    if not password_matches(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(401, "Your current password is incorrect")
    db.table("users").update({"password_hash": password_hash(payload.new_password)}).eq("id", user["id"]).execute()
    audit_change(db, "user", user["id"], "password_changed", None, "self-service", user["id"])
    return {"ok": True}


@app.get("/companies")
def list_companies(db: Client = Depends(require_supabase), _: dict = Depends(current_user)) -> dict:
    companies = db.table("company").select("*").order("created_at", desc=True).execute().data or []
    mous = db.table("mou").select("*").execute().data or []
    users = db.table("users").select("*").execute().data or []
    user_map = {user["id"]: user for user in users}
    mou_map = {mou["company_id"]: mou for mou in mous}
    return {"data": [company_payload(db, company, mou_map[company["id"]], user_map) for company in companies if company["id"] in mou_map]}


@app.get("/companies/{company_id}")
def get_company(company_id: str, db: Client = Depends(require_supabase), _: dict = Depends(current_user)) -> dict:
    company = one(db, "company", id=company_id)
    mou = one(db, "mou", company_id=company_id)
    users = db.table("users").select("*").execute().data or []
    return {"data": company_payload(db, company, mou, {user["id"]: user for user in users})}


@app.post("/companies", status_code=201)
def create_company(payload: CompanyCreate, db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    validate_company_dates(payload.effective_date, payload.expiring_date)
    if payload.activity_name and (payload.activity_date is None or payload.activity_time is None):
        raise HTTPException(422, "Activity date and time are required when a primary activity is entered")
    if (payload.activity_date is not None or payload.activity_time is not None) and not payload.activity_name:
        raise HTTPException(422, "A primary activity is required when an activity date or time is entered")
    document = decode_pdf(payload.document_base64, payload.document_content_type)
    filename = safe_pdf_filename(payload.document_filename)
    company: Optional[dict] = None
    document_path: Optional[str] = None
    mou_data = {
        "mou_scope": payload.mou_scope, "deliverables": payload.deliverables,
        "effective_date": payload.effective_date.isoformat(), "expiring_date": payload.expiring_date.isoformat(),
        "current_status": payload.initial_status.value,
        "internal_spoc_name": payload.internal_spoc_name, "internal_spoc_email": payload.internal_spoc_email,
        "internal_spoc_phone": payload.internal_spoc_phone, "created_by": user["id"], "updated_by": user["id"],
    }
    try:
        company = db.table("company").insert({"company_name": payload.company_name, "city": payload.city, "created_by": user["id"]}).execute().data[0]
        mou_data["company_id"] = company["id"]
        mou = db.table("mou").insert(mou_data).execute().data[0]
        db.table("status_history").insert({"mou_id": mou["id"], "status": payload.initial_status.value, "status_date": payload.effective_date.isoformat(), "status_time": datetime.now().time().replace(microsecond=0).isoformat(), "changed_by": user["id"], "is_initial": True}).execute()
        contact = db.table("contact_details").insert({"mou_id": mou["id"], "contact_name": payload.contact_name, "email": payload.contact_email, "phone": payload.contact_phone}).execute().data[0]
        document_path = f"{company['id']}/{mou['id']}/{filename}"
        db.storage.from_("mou-pdfs").upload(document_path, document, {"content-type": "application/pdf", "upsert": "false"})
        mou = db.table("mou").update({"pdf_url": document_path, "updated_by": user["id"]}).eq("id", mou["id"]).execute().data[0]
        if payload.activity_name:
            db.table("activity_log").insert({"company_id": company["id"], "activity_name": payload.activity_name, "activity_notes": payload.activity_notes, "description": payload.activity_name, "activity_date": payload.activity_date.isoformat() if payload.activity_date else None, "activity_time": payload.activity_time.isoformat() if payload.activity_time else None, "created_by": user["id"]}).execute()
        for field_name, value in (("company_name", payload.company_name), ("city", payload.city)):
            audit_change(db, "company", company["id"], field_name, None, value, user["id"])
        for field_name, value in (
            ("mou_scope", payload.mou_scope), ("deliverables", payload.deliverables),
            ("effective_date", payload.effective_date), ("expiring_date", payload.expiring_date),
            ("internal_spoc_name", payload.internal_spoc_name), ("internal_spoc_email", payload.internal_spoc_email),
            ("internal_spoc_phone", payload.internal_spoc_phone), ("status", payload.initial_status.value),
        ):
            audit_change(db, "mou", mou["id"], field_name, None, value, user["id"])
        for field_name, value in (("contact_name", payload.contact_name), ("email", payload.contact_email), ("phone", payload.contact_phone)):
            audit_change(db, "contact", contact["id"], field_name, None, value, user["id"])
        audit_change(db, "mou", mou["id"], "signed_copy", None, document_path, user["id"])
        if payload.activity_name:
            audit_change(db, "company", company["id"], "activity", None, {"name": payload.activity_name, "notes": payload.activity_notes, "date": payload.activity_date, "time": payload.activity_time}, user["id"])
    except Exception as exc:
        if document_path:
            try:
                db.storage.from_("mou-pdfs").remove([document_path])
            except Exception:
                logging.exception("Could not remove failed MOU PDF upload")
        if company:
            db.table("company").delete().eq("id", company["id"]).execute()
        logging.exception("Company creation failed")
        raise HTTPException(400, "Could not create the company and MOU record") from exc
    return {"data": company_payload(db, company, mou, {user["id"]: user})}


@app.patch("/companies/{company_id}")
def update_company(company_id: str, payload: CompanyUpdate, db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    company = one(db, "company", id=company_id)
    mou = one(db, "mou", company_id=company_id)
    effective_date = date.fromisoformat(str(mou["effective_date"]))
    validate_company_dates(effective_date, payload.expiring_date)
    contacts = db.table("contact_details").select("*").eq("mou_id", mou["id"]).order("created_at").limit(1).execute().data or []
    updated_company = db.table("company").update({"company_name": payload.company_name, "city": payload.city}).eq("id", company_id).execute().data[0]
    updated_mou = db.table("mou").update({
        "mou_scope": payload.mou_scope,
        "deliverables": payload.deliverables,
        "expiring_date": payload.expiring_date.isoformat(),
        "internal_spoc_name": payload.internal_spoc_name,
        "internal_spoc_email": payload.internal_spoc_email,
        "internal_spoc_phone": payload.internal_spoc_phone,
        "updated_by": user["id"],
    }).eq("id", mou["id"]).execute().data[0]
    contact_payload = {"contact_name": payload.contact_name, "email": payload.contact_email, "phone": payload.contact_phone}
    if contacts:
        db.table("contact_details").update(contact_payload).eq("id", contacts[0]["id"]).execute()
    else:
        contacts = db.table("contact_details").insert({"mou_id": mou["id"], **contact_payload}).execute().data
    for field_name, old_value, new_value in (("company_name", company.get("company_name"), payload.company_name), ("city", company.get("city"), payload.city)):
        audit_change(db, "company", company_id, field_name, old_value, new_value, user["id"])
    for field_name, old_value, new_value in (
        ("mou_scope", mou.get("mou_scope"), payload.mou_scope), ("deliverables", mou.get("deliverables"), payload.deliverables),
        ("expiring_date", mou.get("expiring_date"), payload.expiring_date),
        ("internal_spoc_name", mou.get("internal_spoc_name"), payload.internal_spoc_name), ("internal_spoc_email", mou.get("internal_spoc_email"), payload.internal_spoc_email),
        ("internal_spoc_phone", mou.get("internal_spoc_phone"), payload.internal_spoc_phone),
    ):
        audit_change(db, "mou", mou["id"], field_name, old_value, new_value, user["id"])
    contact = contacts[0]
    for field_name, old_key, new_value in (("contact_name", "contact_name", payload.contact_name), ("email", "email", payload.contact_email), ("phone", "phone", payload.contact_phone)):
        audit_change(db, "contact", contact["id"], field_name, contact.get(old_key), new_value, user["id"])
    return {"data": company_payload(db, updated_company, updated_mou, {user["id"]: user})}


@app.post("/mous/{mou_id}/status")
def change_status(mou_id: str, payload: StatusChange, db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    mou = one(db, "mou", id=mou_id)
    if mou.get("current_status") == payload.status.value:
        raise HTTPException(409, "This status is already current. Choose a different status before saving.")

    same_status_on_date = (
        db.table("status_history")
        .select("id")
        .eq("mou_id", mou_id)
        .eq("status", payload.status.value)
        .eq("status_date", payload.status_date.isoformat())
        .eq("status_time", payload.status_time.isoformat())
        .limit(1)
        .execute()
        .data
        or []
    )
    if same_status_on_date:
        raise HTTPException(409, "This status has already been recorded for the selected date and time.")

    # Conditional update makes the current status an optimistic concurrency
    # guard: only one simultaneous request can move the MOU out of its current
    # state. This prevents duplicate history rows even before the database
    # unique-index migration is applied.
    result = (
        db.table("mou")
        .update({"current_status": payload.status.value, "updated_by": user["id"]})
        .eq("id", mou_id)
        .eq("current_status", mou["current_status"])
        .execute()
    )
    if not result.data:
        raise HTTPException(409, "This MOU was updated by another admin. Refresh and try again.")
    try:
        db.table("status_history").insert({"mou_id": mou_id, "status": payload.status.value, "status_date": payload.status_date.isoformat(), "status_time": payload.status_time.isoformat(), "changed_by": user["id"], "notes": payload.notes, "is_initial": False}).execute()
    except Exception as exc:
        # Keep the current state consistent with history if its insert fails.
        db.table("mou").update({"current_status": mou["current_status"], "updated_by": user["id"]}).eq("id", mou_id).eq("current_status", payload.status.value).execute()
        raise HTTPException(503, "Could not record the status change. Please retry.") from exc
    try:
        audit_change(db, "mou", mou_id, "status", mou.get("current_status"), {"status": payload.status.value, "date": payload.status_date, "time": payload.status_time}, user["id"])
        if payload.notes:
            audit_change(db, "mou", mou_id, "status_notes", None, payload.notes, user["id"])
    except Exception:
        # The status and its immutable history are the source of truth. Keep
        # a successful change rather than inviting a retry that could repeat it
        # if an ancillary audit write has a transient transport failure.
        logging.exception("Could not append audit entries for MOU %s", mou_id)
    return {"data": result.data[0]}


@app.patch("/status-history/{history_id}")
def correct_status(history_id: str, payload: StatusCorrection, db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    history = one(db, "status_history", id=history_id)
    if history["is_initial"]:
        raise HTTPException(409, "The initial status is permanently locked and cannot be edited")
    status_date = payload.status_date or date.fromisoformat(history["status_date"])
    status_time = payload.status_time or time.fromisoformat(str(history["status_time"]))
    status_changed = payload.status.value != history["status"] or status_date.isoformat() != history["status_date"] or status_time.isoformat() != history["status_time"]
    if status_changed:
        duplicate = (
            db.table("status_history")
            .select("id")
            .eq("mou_id", history["mou_id"])
            .eq("status", payload.status.value)
            .eq("status_date", status_date.isoformat())
            .eq("status_time", status_time.isoformat())
            .neq("id", history_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if duplicate:
            raise HTTPException(409, "This status has already been recorded for the selected date and time.")
    status_update = {"status": payload.status.value, "notes": payload.notes, "edited_by": user["id"], "edited_at": datetime.now(timezone.utc).isoformat()}
    if payload.status_date:
        status_update["status_date"] = payload.status_date.isoformat()
    if payload.status_time:
        status_update["status_time"] = payload.status_time.isoformat()
    updated = db.table("status_history").update(status_update).eq("id", history_id).execute().data[0]
    latest = db.table("status_history").select("*").eq("mou_id", history["mou_id"]).order("changed_at", desc=True).limit(1).execute().data[0]
    if latest["id"] == history_id:
        db.table("mou").update({"current_status": payload.status.value, "updated_by": user["id"]}).eq("id", history["mou_id"]).execute()
    if status_changed:
        audit_change(db, "mou", history["mou_id"], "status", {"status": history.get("status"), "date": history.get("status_date"), "time": history.get("status_time")}, {"status": payload.status.value, "date": status_date, "time": status_time}, user["id"])
    if payload.notes != history.get("notes"):
        audit_change(db, "mou", history["mou_id"], "status_notes", history.get("notes"), payload.notes, user["id"])
    return {"data": updated}


@app.post("/companies/{company_id}/activities", status_code=201)
def add_activity(company_id: str, payload: ActivityCreate, db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    one(db, "company", id=company_id)
    activity = db.table("activity_log").insert({"company_id": company_id, "activity_name": payload.activity_name, "activity_notes": payload.activity_notes, "description": payload.activity_name, "activity_date": payload.activity_date.isoformat(), "activity_time": payload.activity_time.isoformat(), "created_by": user["id"]}).execute().data[0]
    audit_change(db, "company", company_id, "activity", None, {"id": activity["id"], "name": payload.activity_name, "notes": payload.activity_notes, "date": payload.activity_date, "time": payload.activity_time}, user["id"])
    return {"data": activity}


@app.post("/mous/{mou_id}/pdf", status_code=201)
async def upload_pdf(mou_id: str, file: UploadFile = File(...), db: Client = Depends(require_supabase), user: dict = Depends(require_edit_user)) -> dict:
    if file.content_type != "application/pdf":
        raise HTTPException(415, "Only PDF files are accepted")
    mou = one(db, "mou", id=mou_id)
    document = await file.read()
    if not document.startswith(b"%PDF-"):
        raise HTTPException(422, "The MOU signed copy must be a valid PDF file")
    if len(document) > max_pdf_bytes:
        raise HTTPException(413, f"PDF files must be {max_pdf_bytes // 1024 // 1024} MB or smaller")
    path = f"{mou['company_id']}/{mou_id}/{safe_pdf_filename(file.filename or 'mou-signed-copy.pdf')}"
    db.storage.from_("mou-pdfs").upload(path, document, {"content-type": "application/pdf", "upsert": "true"})
    db.table("mou").update({"pdf_url": path, "updated_by": user["id"]}).eq("id", mou_id).execute()
    audit_change(db, "mou", mou_id, "signed_copy", mou.get("pdf_url"), path, user["id"])
    return {"data": {"path": path, "filename": file.filename}}


@app.get("/mous/{mou_id}/pdf-url")
def signed_pdf_url(mou_id: str, db: Client = Depends(require_supabase), _: dict = Depends(current_user)) -> dict:
    mou = one(db, "mou", id=mou_id)
    if not mou.get("pdf_url"):
        raise HTTPException(404, "This MOU has no PDF attached")
    signed = db.storage.from_("mou-pdfs").create_signed_url(mou["pdf_url"], 3600)
    return {"data": {"url": signed.get("signedURL") or signed.get("signedUrl")}}
