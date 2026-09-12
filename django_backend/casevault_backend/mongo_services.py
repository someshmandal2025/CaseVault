"""
CASEVAULT - MongoDB Data Architecture & Service Layer
Provides backend service helpers for secondary document/evidence storage.

STRICT RELATIONSHIP RULE:
User objects from Django ORM (SQLite) are referenced ONLY by stable identifiers:
{
    "user_id": 123,
    "officer_id": "POL-8842",
    "name": "SI Shivam Kumar Singh"
}
Passwords, password hashes, OTPs, session tokens, and RBAC definitions are NEVER stored in MongoDB.
"""

from datetime import datetime
from casevault_backend.mongo import get_mongo_db


def build_user_ref(user):
    """
    Creates a minimal, stable reference object from a Django User instance.
    Prevents leaking passwords, tokens, or sensitive credentials.
    """
    if not user:
        return {"user_id": None, "officer_id": None, "name": "System"}
    return {
        "user_id": getattr(user, 'id', None),
        "officer_id": getattr(user, 'officer_id', None),
        "name": getattr(user, 'name', '') or getattr(user, 'username', 'Unknown Officer')
    }


# ==============================================================================
# 1. CASES SERVICE
# ==============================================================================

def get_cases_collection():
    return get_mongo_db().cases


def format_case_document(case_data, user=None):
    """
    Sanitizes case record payload for insertion into MongoDB cases collection.
    """
    now = datetime.utcnow()
    user_ref = build_user_ref(user)
    return {
        "case_id": case_data.get("case_id"),
        "fir_number": case_data.get("fir_number"),
        "title": case_data.get("title"),
        "case_type": case_data.get("case_type", "General Investigation"),
        "description": case_data.get("description", ""),
        "status": case_data.get("status", "Investigation"),
        "priority": case_data.get("priority", "Medium"),
        "police_station_unit": case_data.get("police_station_unit", "Siliguri Police Station"),
        "created_by": user_ref,
        "assigned_officers": case_data.get("assigned_officers", [user_ref]),
        "incident_date": case_data.get("incident_date"),
        "document_count": case_data.get("document_count", 0),
        "evidence_count": case_data.get("evidence_count", 0),
        "created_at": case_data.get("created_at") or now,
        "updated_at": now
    }


# ==============================================================================
# 2. CASE DOCUMENTS SERVICE
# ==============================================================================

def get_documents_collection():
    return get_mongo_db().case_documents


def format_case_document_metadata(doc_data, user=None):
    """
    Sanitizes document metadata payload for MongoDB case_documents collection.
    """
    now = datetime.utcnow()
    user_ref = build_user_ref(user)
    return {
        "document_id": doc_data.get("document_id"),
        "case_id": doc_data.get("case_id"),
        "document_type": doc_data.get("document_type", "FIR"),
        "document_name": doc_data.get("document_name"),
        "file_name": doc_data.get("file_name"),
        "mime_type": doc_data.get("mime_type", "application/pdf"),
        "file_size": doc_data.get("file_size", "0 KB"),
        "storage_reference": doc_data.get("storage_reference", ""),
        "sha256_hash": doc_data.get("sha256_hash"),
        "uploaded_by": user_ref,
        "uploaded_at": doc_data.get("uploaded_at") or now,
        "classification": doc_data.get("classification", "Confidential"),
        "description": doc_data.get("description", ""),
        "version": doc_data.get("version", 1),
        "status": doc_data.get("status", "Verified")
    }


# ==============================================================================
# 3. EVIDENCE SERVICE
# ==============================================================================

def get_evidence_collection():
    return get_mongo_db().evidence


def format_evidence_record(evidence_data, user=None):
    """
    Sanitizes evidence payload for MongoDB evidence collection.
    """
    now = datetime.utcnow()
    user_ref = build_user_ref(user)
    return {
        "evidence_id": evidence_data.get("evidence_id"),
        "case_id": evidence_data.get("case_id"),
        "evidence_type": evidence_data.get("evidence_type", "Physical"),
        "description": evidence_data.get("description", ""),
        "file_name": evidence_data.get("file_name"),
        "mime_type": evidence_data.get("mime_type", "application/octet-stream"),
        "storage_reference": evidence_data.get("storage_reference", ""),
        "sha256_hash": evidence_data.get("sha256_hash"),
        "collected_by": user_ref,
        "collected_at": evidence_data.get("collected_at") or now,
        "current_custodian": evidence_data.get("current_custodian") or user_ref,
        "status": evidence_data.get("status", "Secured"),
        "created_at": now,
        "updated_at": now
    }


# ==============================================================================
# 4. CHAIN OF CUSTODY SERVICE
# ==============================================================================

def get_chain_of_custody_collection():
    return get_mongo_db().chain_of_custody


def format_custody_event(custody_data, user=None):
    """
    Sanitizes chain of custody event for MongoDB chain_of_custody collection.
    Actions: COLLECTED, UPLOADED, VERIFIED, TRANSFERRED, ACCESSED, DOWNLOADED, MODIFIED, ARCHIVED
    """
    now = datetime.utcnow()
    user_ref = build_user_ref(user)
    return {
        "log_id": custody_data.get("log_id"),
        "case_id": custody_data.get("case_id"),
        "evidence_id": custody_data.get("evidence_id"),
        "document_id": custody_data.get("document_id"),
        "action": custody_data.get("action", "COLLECTED"),
        "performed_by": user_ref,
        "performed_at": custody_data.get("performed_at") or now,
        "source": custody_data.get("source", "Field Investigation"),
        "destination": custody_data.get("destination", "CaseVault Vault"),
        "previous_hash": custody_data.get("previous_hash", ""),
        "current_hash": custody_data.get("current_hash", ""),
        "remarks": custody_data.get("remarks", "")
    }


# ==============================================================================
# 5. AUDIT LOGS SERVICE
# ==============================================================================

def get_audit_logs_collection():
    return get_mongo_db().audit_logs


def format_audit_log_event(event_data, user=None):
    """
    Sanitizes audit log event payload for MongoDB audit_logs collection.
    """
    now = datetime.utcnow()
    user_ref = build_user_ref(user)
    return {
        "event_id": event_data.get("event_id"),
        "actor_user_id": user_ref.get("user_id"),
        "actor_officer_id": user_ref.get("officer_id"),
        "actor_name": user_ref.get("name"),
        "action": event_data.get("action"),
        "resource_type": event_data.get("resource_type", "CASE"),
        "resource_id": event_data.get("resource_id"),
        "timestamp": event_data.get("timestamp") or now,
        "ip_address": event_data.get("ip_address", "127.0.0.1"),
        "user_agent": event_data.get("user_agent", "Django REST API"),
        "description": event_data.get("description", ""),
        "metadata": event_data.get("metadata", {}),
        "previous_event_hash": event_data.get("previous_event_hash", ""),
        "event_hash": event_data.get("event_hash", "")
    }
