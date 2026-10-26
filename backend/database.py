import os
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException
from supabase import create_client, Client

logger = logging.getLogger("brandgate.database")

def get_supabase() -> Client:
    """
    Initializes and returns the Supabase client using environment variables.
    SECRET SAFETY RULE:
    - Never logs, prints, or exposes the SUPABASE_SERVICE_KEY or SUPABASE_URL.
    - Fails with generic safe error messages if environment variables are missing.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url:
        raise HTTPException(
            status_code=500,
            detail="Database configuration error: SUPABASE_URL is not set"
        )
    if not key:
        raise HTTPException(
            status_code=500,
            detail="Database configuration error: SUPABASE_SERVICE_KEY is not set"
        )

    try:
        return create_client(url, key)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Database connection failure. Please verify backend environment configuration."
        )

def get_authenticated_user(auth_header: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Verifies Supabase JWT server-side via Supabase Auth service.
    Uses server-side service credentials only - never hard-codes a JWT secret.
    Returns user dict with 'id', 'email', and 'role' if valid; returns None for guest mode.
    """
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split("Bearer ")[1].strip()
    if not token:
        return None

    try:
        supabase = get_supabase()
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            user = user_response.user
            # Look up profile role if set in profiles table
            profile_role = "creator"
            try:
                prof_res = supabase.table("profiles").select("role").eq("id", user.id).execute()
                if prof_res.data and len(prof_res.data) > 0:
                    profile_role = prof_res.data[0].get("role", "creator")
            except Exception:
                pass

            return {
                "id": user.id,
                "email": user.email,
                "role": profile_role,
            }
    except Exception as exc:
        logger.info(f"JWT verification unauthenticated: {exc}")
        return None

    return None

