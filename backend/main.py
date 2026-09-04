"""FastAPI business layer for the MOU Tracker.

The frontend talks to this service; this service owns multi-table writes,
status-history rules, auth attribution, and private PDF storage.
"""
from datetime import date, datetime, timezone
from enum import Enum
import base64
import hashlib
import json
import logging
import os
import secrets
from typing import Any, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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
    expired = "expired"
    renewal = "renewal"
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
    document_attached: bool
    activity_name: Optional[str] = None
    activity_notes: Optional[str] = None
    activity_date: Optional[date] = None


class CompanyUpdate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=120)
    mou_scope: str = Field(min_length=1, max_length=10000)
    deliverables: str = Field(min_length=1, max_length=10000)
    effective_date: date
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
    notes: Optional[str] = None


class StatusCorrection(BaseModel):
    status: MOUStatus
    status_date: Optional[date] = None
    notes: Optional[str] = None


class ActivityCreate(BaseModel):
    activity_name: str = Field(min_length=1, max_length=5000)
    activity_notes: Optional[str] = Field(default=None, max_length=5000)
    activity_date: date


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


app = FastAPI(title="MOU Tracker API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Optional[Client] = None
if create_client and os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

jwt_secret = os.getenv("JWT_SECRET")
jwt_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))


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
    return {key: profile.get(key) for key in ("id", "email", "display_name", "created_at")}


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


def require_supabase() -> Client:
    if not supabase:
        raise HTTPException(503, "Supabase is not configured on the API")
    return supabase


def current_user(authorization: Optional[str] = Header(default=None), db: Client = Depends(require_supabase)) -> dict:
    """Verify an app-issued JWT and return its public.users profile."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "An app JWT bearer token is required")
    token = authorization.split(" ", 1)[1]
    try:
        claims = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        profile = db.table("users").select("*").eq("id", claims["sub"]).single().execute().data
        return profile
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired app JWT") from exc


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
    return {"ok": True, "supabase_configured": supabase is not None, "timestamp": datetime.now(timezone.utc)}


@app.post("/auth/login")
def login(payload: LoginRequest, db: Client = Depends(require_supabase)) -> dict:
    if not jwt_secret:
        raise HTTPException(503, "JWT_SECRET is not configured")
    try:
        profile = db.table("users").select("*").eq("email", payload.email.strip().lower()).single().execute().data
    except Exception as exc:
        raise HTTPException(401, "Invalid email or password") from exc
    if not profile or not password_matches(payload.password, profile.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    now = datetime.now(timezone.utc)
    claims = {"sub": profile["id"], "email": profile["email"], "iat": now, "exp": now.timestamp() + (jwt_expire_minutes * 60)}
    token = jwt.encode(claims, jwt_secret, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": {"id": profile["id"], "email": profile["email"], "display_name": profile["display_name"]}}


@app.get("/users")
def list_users(db: Client = Depends(require_supabase), _: dict = Depends(current_user)) -> dict:
    return {"data": db.table("users").select("id,email,display_name,created_at").order("display_name").execute().data or []}


@app.post("/users", status_code=201)
def create_user(payload: UserCreate, db: Client = Depends(require_supabase), _: dict = Depends(current_user)) -> dict:
    email = payload.email.strip().lower()
    if db.table("users").select("id").eq("email", email).execute().data:
        raise HTTPException(409, "A user with this email already exists")
    created = db.table("users").insert({"id": str(uuid4()), "email": email, "display_name": payload.display_name.strip(), "password_hash": password_hash(payload.password)}).execute().data[0]
    return {"data": public_profile(created)}


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
def create_company(payload: CompanyCreate, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    if not payload.document_attached:
        raise HTTPException(422, "MOU signed copy is required when creating a company")
    if payload.activity_name and not payload.activity_date:
        raise HTTPException(422, "Activity date is required when a primary activity is entered")
    company = db.table("company").insert({"company_name": payload.company_name, "city": payload.city, "created_by": user["id"]}).execute().data[0]
    mou_data = {
        "company_id": company["id"], "mou_scope": payload.mou_scope, "deliverables": payload.deliverables,
        "effective_date": payload.effective_date.isoformat(), "expiring_date": payload.expiring_date.isoformat(), "current_status": payload.initial_status.value,
        "internal_spoc_name": payload.internal_spoc_name, "internal_spoc_email": payload.internal_spoc_email,
        "internal_spoc_phone": payload.internal_spoc_phone, "created_by": user["id"], "updated_by": user["id"],
    }
    try:
        mou = db.table("mou").insert(mou_data).execute().data[0]
        db.table("status_history").insert({"mou_id": mou["id"], "status": payload.initial_status.value, "status_date": payload.effective_date.isoformat(), "changed_by": user["id"], "is_initial": True}).execute()
        contact = db.table("contact_details").insert({"mou_id": mou["id"], "contact_name": payload.contact_name, "email": payload.contact_email, "phone": payload.contact_phone}).execute().data[0]
        if payload.activity_name:
            db.table("activity_log").insert({"company_id": company["id"], "activity_name": payload.activity_name, "activity_notes": payload.activity_notes, "description": payload.activity_name, "activity_date": payload.activity_date.isoformat() if payload.activity_date else None, "created_by": user["id"]}).execute()
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
        if payload.activity_name:
            audit_change(db, "company", company["id"], "activity", None, {"name": payload.activity_name, "notes": payload.activity_notes, "date": payload.activity_date}, user["id"])
    except Exception as exc:
        db.table("company").delete().eq("id", company["id"]).execute()
        logging.exception("Company creation failed for %s", company.get("id"))
        raise HTTPException(400, "Could not create the company and MOU record") from exc
    return {"data": company_payload(db, company, mou, {user["id"]: user})}


@app.patch("/companies/{company_id}")
def update_company(company_id: str, payload: CompanyUpdate, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    company = one(db, "company", id=company_id)
    mou = one(db, "mou", company_id=company_id)
    contacts = db.table("contact_details").select("*").eq("mou_id", mou["id"]).order("created_at").limit(1).execute().data or []
    updated_company = db.table("company").update({"company_name": payload.company_name, "city": payload.city}).eq("id", company_id).execute().data[0]
    updated_mou = db.table("mou").update({
        "mou_scope": payload.mou_scope,
        "deliverables": payload.deliverables,
        "effective_date": payload.effective_date.isoformat(),
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
        ("effective_date", mou.get("effective_date"), payload.effective_date), ("expiring_date", mou.get("expiring_date"), payload.expiring_date),
        ("internal_spoc_name", mou.get("internal_spoc_name"), payload.internal_spoc_name), ("internal_spoc_email", mou.get("internal_spoc_email"), payload.internal_spoc_email),
        ("internal_spoc_phone", mou.get("internal_spoc_phone"), payload.internal_spoc_phone),
    ):
        audit_change(db, "mou", mou["id"], field_name, old_value, new_value, user["id"])
    contact = contacts[0]
    for field_name, old_key, new_value in (("contact_name", "contact_name", payload.contact_name), ("email", "email", payload.contact_email), ("phone", "phone", payload.contact_phone)):
        audit_change(db, "contact", contact["id"], field_name, contact.get(old_key), new_value, user["id"])
    return {"data": company_payload(db, updated_company, updated_mou, {user["id"]: user})}


@app.post("/mous/{mou_id}/status")
def change_status(mou_id: str, payload: StatusChange, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    mou = one(db, "mou", id=mou_id)
    db.table("status_history").insert({"mou_id": mou_id, "status": payload.status.value, "status_date": payload.status_date.isoformat(), "changed_by": user["id"], "notes": payload.notes, "is_initial": False}).execute()
    result = db.table("mou").update({"current_status": payload.status.value, "updated_by": user["id"]}).eq("id", mou_id).execute()
    audit_change(db, "mou", mou_id, "status", mou.get("current_status"), {"status": payload.status.value, "date": payload.status_date}, user["id"])
    if payload.notes:
        audit_change(db, "mou", mou_id, "status_notes", None, payload.notes, user["id"])
    return {"data": result.data[0]}


@app.patch("/status-history/{history_id}")
def correct_status(history_id: str, payload: StatusCorrection, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    history = one(db, "status_history", id=history_id)
    if history["is_initial"]:
        raise HTTPException(409, "The initial status is permanently locked and cannot be edited")
    status_update = {"status": payload.status.value, "notes": payload.notes, "edited_by": user["id"], "edited_at": datetime.now(timezone.utc).isoformat()}
    if payload.status_date:
        status_update["status_date"] = payload.status_date.isoformat()
    updated = db.table("status_history").update(status_update).eq("id", history_id).execute().data[0]
    latest = db.table("status_history").select("*").eq("mou_id", history["mou_id"]).order("changed_at", desc=True).limit(1).execute().data[0]
    if latest["id"] == history_id:
        db.table("mou").update({"current_status": payload.status.value, "updated_by": user["id"]}).eq("id", history["mou_id"]).execute()
    audit_change(db, "mou", history["mou_id"], "status", history.get("status"), {"status": payload.status.value, "date": payload.status_date or history.get("status_date")}, user["id"])
    if payload.notes != history.get("notes"):
        audit_change(db, "mou", history["mou_id"], "status_notes", history.get("notes"), payload.notes, user["id"])
    return {"data": updated}


@app.post("/companies/{company_id}/activities", status_code=201)
def add_activity(company_id: str, payload: ActivityCreate, db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    one(db, "company", id=company_id)
    activity = db.table("activity_log").insert({"company_id": company_id, "activity_name": payload.activity_name, "activity_notes": payload.activity_notes, "description": payload.activity_name, "activity_date": payload.activity_date.isoformat() if payload.activity_date else None, "created_by": user["id"]}).execute().data[0]
    audit_change(db, "company", company_id, "activity", None, {"id": activity["id"], "name": payload.activity_name, "notes": payload.activity_notes, "date": payload.activity_date}, user["id"])
    return {"data": activity}


@app.post("/mous/{mou_id}/pdf", status_code=201)
async def upload_pdf(mou_id: str, file: UploadFile = File(...), db: Client = Depends(require_supabase), user: dict = Depends(current_user)) -> dict:
    if file.content_type != "application/pdf":
        raise HTTPException(415, "Only PDF files are accepted")
    mou = one(db, "mou", id=mou_id)
    path = f"{mou['company_id']}/{mou_id}/{file.filename or 'mou.pdf'}"
    db.storage.from_("mou-pdfs").upload(path, await file.read(), {"content-type": "application/pdf", "upsert": "true"})
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
