import os
from fastapi import HTTPException
from supabase import create_client, Client

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
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Database connection failure. Please verify backend environment configuration."
        )
