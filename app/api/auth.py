"""
Authentication endpoints — basic email+password → JWT.
- POST /auth/login            both officers and bidders
- POST /auth/logout           204 (stateless: client drops token)
- GET  /auth/me               returns the JWT-bound profile
- POST /auth/register/bidder  self-serve bidder onboarding
- POST /auth/password/change  authed password change
"""

import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from ..auth import (
    CurrentUser,
    create_access_token,
    current_user,
    hash_password,
    verify_password,
)
from ..audit import log as audit_log
from ..db import dict_one, get_conn, with_dict_cursor

router = APIRouter()
logger = logging.getLogger(__name__)


# ---- Pydantic ---------------------------------------------------------------


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: str
    role: Literal["officer", "bidder"]
    email: str
    name: str
    designation: Optional[str] = None
    unit: Optional[str] = None
    company_name: Optional[str] = None
    gstin: Optional[str] = None
    registration_number: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class BidderRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    company_name: str
    contact_person: Optional[str] = None
    registration_number: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


# ---- Helpers ----------------------------------------------------------------


def _err(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message}},
    )


def _lookup_user_by_email(email: str) -> tuple[Optional[dict], Optional[Literal["officer", "bidder"]]]:
    """Look in users (officers) first, then bidder_users. Returns (row, role)."""
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, email, name, role, password_hash, designation, unit "
                "FROM users WHERE email = %s",
                (email,),
            )
            row = dict_one(cur)
            if row:
                return row, "officer"

            cur.execute(
                "SELECT id, email, company_name AS name, password_hash, "
                "contact_person, registration_number, gstin, phone, city, kyc_verified "
                "FROM bidder_users WHERE email = %s",
                (email,),
            )
            row = dict_one(cur)
            if row:
                return row, "bidder"
    finally:
        conn.close()
    return None, None


# ---- Endpoints --------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user_row, role = _lookup_user_by_email(payload.email)
    if not user_row or not verify_password(payload.password, user_row.get("password_hash") or ""):
        audit_log(
            actor=None, actor_role="system", actor_label=payload.email,
            action="auth.failed", target_type="user", target_id=None,
            detail={"email": payload.email, "reason": "bad_credentials"},
        )
        raise _err(401, "AUTH_INVALID", "Invalid email or password.")

    user_id = str(user_row["id"])
    name = user_row.get("name") or payload.email
    token = create_access_token(user_id=user_id, role=role, email=payload.email, name=name)

    audit_log(
        actor=None,
        actor_role=role,
        actor_label=name,
        action="auth.login",
        target_type="user",
        target_id=user_id,
    )

    user_out = UserOut(
        id=user_id,
        role=role,
        email=user_row["email"],
        name=name,
        designation=user_row.get("designation") if role == "officer" else None,
        unit=user_row.get("unit") if role == "officer" else None,
        company_name=user_row.get("name") if role == "bidder" else None,
        gstin=user_row.get("gstin") if role == "bidder" else None,
        registration_number=user_row.get("registration_number") if role == "bidder" else None,
    )
    return TokenResponse(access_token=token, user=user_out)


@router.post("/logout", status_code=204)
async def logout(user: CurrentUser = Depends(current_user)):
    audit_log(
        actor=user, actor_role=user.role, actor_label=user.name,
        action="auth.logout", target_type="user", target_id=user.id,
    )
    return None


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser = Depends(current_user)):
    """Return the canonical profile for the authenticated user.

    Officers come from `users`, bidders from `bidder_users`. We re-read so the
    UI sees fresh designation / company info even if the JWT is stale.
    """
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            if user.role == "officer":
                cur.execute(
                    "SELECT id, email, name, role, designation, unit FROM users WHERE id = %s",
                    (user.id,),
                )
                row = dict_one(cur)
                if not row:
                    raise _err(404, "USER_NOT_FOUND", "User no longer exists.")
                return UserOut(
                    id=str(row["id"]), role="officer",
                    email=row["email"], name=row.get("name") or row["email"],
                    designation=row.get("designation"), unit=row.get("unit"),
                )
            else:
                cur.execute(
                    "SELECT id, email, company_name, contact_person, registration_number, gstin "
                    "FROM bidder_users WHERE id = %s",
                    (user.id,),
                )
                row = dict_one(cur)
                if not row:
                    raise _err(404, "USER_NOT_FOUND", "User no longer exists.")
                return UserOut(
                    id=str(row["id"]), role="bidder",
                    email=row["email"], name=row.get("contact_person") or row["company_name"],
                    company_name=row["company_name"],
                    gstin=row.get("gstin"),
                    registration_number=row.get("registration_number"),
                )
    finally:
        conn.close()


@router.post("/register/bidder", response_model=TokenResponse, status_code=201)
async def register_bidder(payload: BidderRegisterRequest):
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute("SELECT 1 FROM bidder_users WHERE email = %s", (payload.email,))
            if cur.fetchone():
                raise _err(409, "EMAIL_TAKEN", "An account with this email already exists.")

            new_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO bidder_users
                    (id, email, password_hash, company_name, contact_person,
                     registration_number, gstin, phone, city, kyc_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                RETURNING id, email, company_name, contact_person, registration_number, gstin
                """,
                (
                    new_id, payload.email, hash_password(payload.password),
                    payload.company_name, payload.contact_person,
                    payload.registration_number, payload.gstin,
                    payload.phone, payload.city,
                ),
            )
            row = dict_one(cur)
            conn.commit()
    finally:
        conn.close()

    name = row.get("contact_person") or row["company_name"]
    token = create_access_token(user_id=str(row["id"]), role="bidder", email=row["email"], name=name)

    audit_log(
        actor=None, actor_role="bidder", actor_label=name,
        action="bidder.registered", target_type="bidder_user", target_id=str(row["id"]),
        detail={"email": row["email"]},
    )

    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=str(row["id"]), role="bidder",
            email=row["email"], name=name,
            company_name=row["company_name"],
            gstin=row.get("gstin"),
            registration_number=row.get("registration_number"),
        ),
    )


@router.post("/password/change", status_code=204)
async def change_password(
    payload: PasswordChangeRequest,
    user: CurrentUser = Depends(current_user),
):
    table = "users" if user.role == "officer" else "bidder_users"
    conn = get_conn()
    try:
        with with_dict_cursor(conn) as cur:
            cur.execute(f"SELECT password_hash FROM {table} WHERE id = %s", (user.id,))
            row = dict_one(cur)
            if not row or not verify_password(payload.old_password, row["password_hash"] or ""):
                raise _err(400, "WRONG_PASSWORD", "Old password does not match.")

            cur.execute(
                f"UPDATE {table} SET password_hash = %s WHERE id = %s",
                (hash_password(payload.new_password), user.id),
            )
            conn.commit()
    finally:
        conn.close()

    audit_log(
        actor=user, actor_role=user.role, actor_label=user.name,
        action="auth.password_changed", target_type="user", target_id=user.id,
    )
    return None
