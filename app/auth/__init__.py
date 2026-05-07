"""
Basic JWT auth — email + password → access token.
No SSO, no OTP, no DSC PKI: hackathon-grade by design.

Use:
    from app.auth import current_user, require_role
    @router.get("/something", dependencies=[Depends(require_role("officer"))])
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from ..config import JWT_ALGORITHM, JWT_SECRET, JWT_TTL_HOURS

Role = Literal["officer", "bidder"]


@dataclass(frozen=True)
class CurrentUser:
    id: str
    role: Role
    email: str
    name: str


# -- password hashing --------------------------------------------------------
# Tiny salted-hash impl so we don't pull bcrypt into the wheel for the hackathon.
# PBKDF2-HMAC-SHA256 is in stdlib and good enough.

_PBKDF2_ROUNDS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    try:
        algo, rounds_str, salt_hex, hash_hex = stored.split("$", 3)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    try:
        rounds = int(rounds_str)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return hmac.compare_digest(dk.hex(), hash_hex)


# -- JWT ---------------------------------------------------------------------

def create_access_token(*, user_id: str, role: Role, email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# -- FastAPI dependencies ---------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


def _unauth(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": {"code": code, "message": message}},
    )


def _forbid(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": {"code": code, "message": message}},
    )


def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise _unauth("AUTH_REQUIRED", "Authorization header is required.")
    try:
        payload = decode_token(creds.credentials)
    except JWTError as e:
        raise _unauth("AUTH_INVALID", f"Invalid token: {e}")
    if "sub" not in payload or "role" not in payload:
        raise _unauth("AUTH_INVALID", "Malformed token payload.")
    return CurrentUser(
        id=str(payload["sub"]),
        role=payload["role"],
        email=payload.get("email", ""),
        name=payload.get("name", ""),
    )


def current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[CurrentUser]:
    """Same as current_user but returns None if no/invalid token (for read endpoints
    that are publicly visible but adapt their response when authenticated)."""
    if creds is None or not creds.credentials:
        return None
    try:
        payload = decode_token(creds.credentials)
    except JWTError:
        return None
    if "sub" not in payload or "role" not in payload:
        return None
    return CurrentUser(
        id=str(payload["sub"]),
        role=payload["role"],
        email=payload.get("email", ""),
        name=payload.get("name", ""),
    )


def require_role(*allowed_roles: Role):
    """Dependency factory: returns a dependency that 403s if the role doesn't match."""

    def _dep(user: CurrentUser = Depends(current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise _forbid(
                "AUTH_FORBIDDEN",
                f"Endpoint requires role(s): {', '.join(allowed_roles)}.",
            )
        return user

    return _dep


require_officer = require_role("officer")
require_bidder = require_role("bidder")
