import os
from typing import Optional


def _get_r2_client():
    r2_account = (os.getenv("R2_ACCOUNT_ID") or "").strip()
    r2_key = (os.getenv("R2_ACCESS_KEY_ID") or "").strip()
    r2_secret = (os.getenv("R2_SECRET_ACCESS_KEY") or "").strip()
    if not (r2_account and r2_key and r2_secret):
        return None
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{r2_account}.r2.cloudflarestorage.com",
        aws_access_key_id=r2_key,
        aws_secret_access_key=r2_secret,
        region_name="auto",
    )


def upload_media_object(
    prefix: str,
    entity_id: str,
    filename: str,
    raw_bytes: bytes,
    local_dir: str,
    content_type: str = "image/jpeg",
    fallback_url_prefix: str = "/api/inspections/photos",
) -> str:
    """
    Uploads media (inspection photos, user-generated listing photos, PDFs) to
    Cloudflare R2 (`knightly-media`), falling back to Supabase Storage or local disk.
    """
    clean_prefix = prefix.strip("/")
    obj_key = f"{clean_prefix}/{entity_id}/{filename}"
    r2_bucket = (os.getenv("R2_BUCKET") or "knightly-media").strip()
    r2_public_url = (os.getenv("R2_PUBLIC_URL") or "").strip().rstrip("/")

    s3 = _get_r2_client()
    if s3 is not None:
        try:
            s3.put_object(
                Bucket=r2_bucket,
                Key=obj_key,
                Body=raw_bytes,
                ContentType=content_type,
            )
            if r2_public_url:
                return f"{r2_public_url}/{obj_key}"
            return f"{fallback_url_prefix}/{entity_id}/{filename}"
        except Exception:
            pass

    # Supabase Storage fallback (if configured)
    supa_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    supa_key = (os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_STORAGE_KEY") or "").strip()
    supa_bucket = (os.getenv("SUPABASE_STORAGE_BUCKET") or "knightly-media").strip()
    if supa_url and supa_key:
        try:
            import httpx
            upload_url = f"{supa_url}/storage/v1/object/{supa_bucket}/{obj_key}"
            r = httpx.post(
                upload_url,
                content=raw_bytes,
                headers={
                    "Authorization": f"Bearer {supa_key}",
                    "apikey": supa_key,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                timeout=10.0,
            )
            if r.status_code in (200, 201):
                return f"{supa_url}/storage/v1/object/public/{supa_bucket}/{obj_key}"
        except Exception:
            pass

    # Local disk fallback
    folder = os.path.join(local_dir, entity_id)
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, filename), "wb") as f:
        f.write(raw_bytes)
    return f"{fallback_url_prefix}/{entity_id}/{filename}"


def upload_inspection_photo(insp_id: str, filename: str, raw_bytes: bytes, local_dir: str) -> str:
    return upload_media_object(
        prefix="inspections",
        entity_id=insp_id,
        filename=filename,
        raw_bytes=raw_bytes,
        local_dir=local_dir,
        content_type="image/jpeg",
        fallback_url_prefix="/api/inspections/photos",
    )


def fetch_r2_photo(insp_id: str, filename: str, prefix: str = "inspections") -> Optional[bytes]:
    s3 = _get_r2_client()
    if s3 is None:
        return None
    r2_bucket = (os.getenv("R2_BUCKET") or "knightly-media").strip()
    try:
        obj = s3.get_object(Bucket=r2_bucket, Key=f"{prefix.strip('/')}/{insp_id}/{filename}")
        return obj["Body"].read()
    except Exception:
        return None
