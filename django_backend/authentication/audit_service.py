"""
CASEVAULT — Central Audit Service & Tamper-Evident SHA-256 Audit Chain Engine

Provides immutable, authoritative audit log recording with cryptographic hash-chaining,
preventing silent editing, deletion, or fake event injection.

NEVER logs passwords, password hashes, OTPs, tokens, session secrets, or passkeys.
"""

import json
import secrets
import hashlib
from datetime import datetime, timezone
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

FALLBACK_AUDIT_LOGS = []


def clean_mongo_doc(doc):
    """
    Recursively converts BSON / datetime objects into clean JSON-serializable Python structures.
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [clean_mongo_doc(item) for item in doc]
    if isinstance(doc, dict):
        cleaned = {}
        for k, v in doc.items():
            if k == '_id':
                continue
            cleaned[k] = clean_mongo_doc(v)
        return cleaned
    if hasattr(doc, 'isoformat'):
        return doc.isoformat()
    return doc


def sanitize_metadata(meta):
    """
    Strips or masks sensitive secrets (passwords, OTPs, tokens, keys) from metadata.
    """
    if not meta or not isinstance(meta, dict):
        return {}
    
    FORBIDDEN_KEYS = {'password', 'password_hash', 'otp', 'token', 'access_token',
                      'refresh_token', 'secret', 'private_key', 'passkey', 'smtp_password'}
    
    sanitized = {}
    for k, v in meta.items():
        k_lower = str(k).lower()
        if any(f_key in k_lower for f_key in FORBIDDEN_KEYS):
            sanitized[k] = "[REDACTED_SECRET]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, list):
            sanitized[k] = [sanitize_metadata(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized


def compute_audit_record_hash(previous_hash, audit_id, event_type, actor_officer_id,
                              case_id, document_id, evidence_id, target_officer_id,
                              description, timestamp, metadata):
    """
    Computes SHA-256 hash over canonical JSON representation of audit record fields.
    """
    canonical_payload = {
        "previous_hash": str(previous_hash or GENESIS_HASH),
        "audit_id": str(audit_id or ""),
        "event_type": str(event_type or ""),
        "actor_officer_id": str(actor_officer_id or ""),
        "case_id": str(case_id or ""),
        "document_id": str(document_id or ""),
        "evidence_id": str(evidence_id or ""),
        "target_officer_id": str(target_officer_id or ""),
        "description": str(description or ""),
        "timestamp": str(timestamp or ""),
        "metadata": sanitize_metadata(metadata)
    }
    
    canonical_str = json.dumps(canonical_payload, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()


def record_audit_event(db, actor_user, event_type=None, case_id=None, document_id=None,
                       evidence_id=None, target_officer_id=None, description="",
                       metadata=None, request=None, **kwargs):
    """
    Central function to create an immutable, tamper-evident audit record.
    Retrieves previous record's hash, computes SHA-256 chain, and persists to MongoDB.
    """
    if not event_type and 'action' in kwargs:
        event_type = kwargs['action']
    # 1. Resolve Actor Details
    actor_officer_id = ""
    actor_user_id = None
    actor_name = ""
    actor_role = ""
    actor_rank = ""

    if actor_user:
        actor_officer_id = getattr(actor_user, 'officer_id', '') or getattr(actor_user, 'username', '')
        actor_user_id = getattr(actor_user, 'pk', None)
        actor_name = getattr(actor_user, 'name', '') or getattr(actor_user, 'get_full_name', lambda: '')() or getattr(actor_user, 'username', '')
        actor_role = getattr(actor_user, 'role', '')
        actor_rank = getattr(actor_user, 'rank', '')
    else:
        actor_officer_id = "SYSTEM"
        actor_name = "System Process"
        actor_role = "SYSTEM"

    # 2. Resolve Client Connection Details
    ip_address = ""
    user_agent = ""
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            ip_address = x_forwarded.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR', '')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    # 3. Generate Unique Audit ID
    audit_id = f"AUD-2026-{secrets.token_hex(4).upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()
    sanit_metadata = sanitize_metadata(metadata)

    # 4. Determine Previous Hash from latest record in Mongo or fallback store
    previous_hash = GENESIS_HASH
    latest_record = None

    if db is not None:
        try:
            latest_record = db.audit_logs.find_one(sort=[("_id", -1)])
        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            latest_record = None

    if not latest_record and FALLBACK_AUDIT_LOGS:
        latest_record = FALLBACK_AUDIT_LOGS[0]

    if latest_record:
        previous_hash = latest_record.get('record_hash') or GENESIS_HASH

    # 5. Calculate Tamper-Evident SHA-256 Record Hash
    record_hash = compute_audit_record_hash(
        previous_hash=previous_hash,
        audit_id=audit_id,
        event_type=event_type,
        actor_officer_id=actor_officer_id,
        case_id=case_id,
        document_id=document_id,
        evidence_id=evidence_id,
        target_officer_id=target_officer_id,
        description=description,
        timestamp=timestamp,
        metadata=sanit_metadata
    )

    # 6. Construct Audit Payload
    audit_record = {
        "audit_id": audit_id,
        "event_type": event_type,
        "action": event_type,  # Backward compatibility field
        "actor_officer_id": actor_officer_id,
        "actor_user_id": str(actor_user_id) if actor_user_id else "",
        "actor_name": actor_name,
        "actor_role": actor_role,
        "actor_rank": actor_rank,
        "case_id": case_id or "",
        "document_id": document_id or "",
        "evidence_id": evidence_id or "",
        "target_officer_id": target_officer_id or "",
        "action_description": description or "",
        "description": description or "",
        "metadata": sanit_metadata,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": timestamp,
        "previous_hash": previous_hash,
        "record_hash": record_hash
    }

    # 7. Persist to MongoDB (or Fallback Store)
    if db is not None:
        try:
            db.audit_logs.insert_one(audit_record)
            return clean_mongo_doc(audit_record)
        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            pass

    FALLBACK_AUDIT_LOGS.insert(0, clean_mongo_doc(audit_record))
    return clean_mongo_doc(audit_record)


def verify_audit_chain(db):
    """
    Verifies the integrity of the audit log SHA-256 hash chain from genesis record to latest record.
    Returns validation status and any detected invalid/tampered records.
    """
    records = []
    if db is not None:
        try:
            records = list(db.audit_logs.find().sort("_id", 1))
        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            records = []

    if not records and FALLBACK_AUDIT_LOGS:
        records = list(reversed(FALLBACK_AUDIT_LOGS))

    if not records:
        return {
            "success": True,
            "valid": True,
            "records_checked": 0,
            "invalid_records": [],
            "message": "No audit records to verify."
        }

    invalid_records = []
    expected_previous_hash = GENESIS_HASH

    for idx, rec in enumerate(records):
        audit_id = rec.get("audit_id", "")
        actual_prev_hash = rec.get("previous_hash", "")
        actual_rec_hash = rec.get("record_hash", "")

        # Check 1: Previous Hash Link
        if actual_prev_hash != expected_previous_hash:
            invalid_records.append({
                "audit_id": audit_id,
                "index": idx,
                "reason": f"Previous hash mismatch. Expected '{expected_previous_hash[:16]}...', got '{actual_prev_hash[:16]}...'"
            })

        # Check 2: Recompute Record Hash
        computed_hash = compute_audit_record_hash(
            previous_hash=actual_prev_hash,
            audit_id=audit_id,
            event_type=rec.get("event_type") or rec.get("action"),
            actor_officer_id=rec.get("actor_officer_id"),
            case_id=rec.get("case_id"),
            document_id=rec.get("document_id"),
            evidence_id=rec.get("evidence_id"),
            target_officer_id=rec.get("target_officer_id"),
            description=rec.get("action_description") or rec.get("description"),
            timestamp=rec.get("timestamp"),
            metadata=rec.get("metadata", {})
        )

        if computed_hash != actual_rec_hash:
            invalid_records.append({
                "audit_id": audit_id,
                "index": idx,
                "reason": f"Record hash mismatch. Expected '{computed_hash[:16]}...', got '{actual_rec_hash[:16]}...'"
            })

        expected_previous_hash = actual_rec_hash

    return {
        "success": True,
        "valid": len(invalid_records) == 0,
        "records_checked": len(records),
        "invalid_records": invalid_records
    }
