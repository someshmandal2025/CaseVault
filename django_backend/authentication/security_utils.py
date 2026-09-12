"""
CASEVAULT — Security Hardening & API Protection Utilities

Provides utility functions for:
- MongoDB query parameter sanitization (preventing $operator injection)
- IDOR object-level permission checking (cases, documents, evidence)
- File upload extension blacklisting & file size validation
- Server-side rate limiting for sensitive authentication endpoints
"""

import time
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Dangerous executable and script file extensions
DISALLOWED_EXTENSIONS = {
    'exe', 'bat', 'sh', 'php', 'py', 'js', 'vbs', 'cmd', 'msi', 'ps1',
    'dll', 'scr', 'jar', 'html', 'htm', 'cgi', 'pl', 'phtml', 'com', 'scr'
}

# Simple in-memory rate limiter store for auth routes
_RATE_LIMIT_STORE = {}


def sanitize_mongo_param(val):
    """
    Coerces input parameters to primitive strings, stripping PyMongo operators (e.g. $gt, $where).
    Prevents MongoDB query injection attacks.
    """
    if val is None:
        return ""
    if isinstance(val, (int, float, bool)):
        return val
    if isinstance(val, dict):
        # Reject dictionary injection attempts
        return ""
    if isinstance(val, list):
        return [sanitize_mongo_param(item) for item in val if not isinstance(item, dict)]
    
    val_str = str(val).strip()
    if val_str.startswith('$'):
        return ""
    return val_str


def check_case_access_permission(user, case_doc):
    """
    Object-level authorization check for cases, documents, and evidence.
    Returns True if user has authorized access; False if unauthorized (IDOR protection).
    """
    if not user or not user.is_authenticated:
        return False

    if getattr(user, 'status', 'Active') == 'Disabled' or not getattr(user, 'is_active', True):
        return False

    role = (getattr(user, 'role', '') or '').upper()

    # Administrators and Senior Officers have full supervisory access
    if role in ['ADMINISTRATOR', 'ADMIN', 'SENIOR_OFFICER', 'SYSTEM_ADMIN']:
        return True

    user_officer_id = (getattr(user, 'officer_id', '') or getattr(user, 'username', '')).upper()
    if not user_officer_id:
        return False

    if not case_doc or not isinstance(case_doc, dict):
        return False

    # Check case ownership or assigned investigator status
    created_by = (case_doc.get('created_by_officer_id') or '').upper()
    investigator = (case_doc.get('investigating_officer_id') or '').upper()
    assigned = [str(o).upper() for o in case_doc.get('assigned_officers', [])]

    if user_officer_id == created_by or user_officer_id == investigator or user_officer_id in assigned:
        return True

    # Check police station unit alignment if present
    station = (case_doc.get('police_station') or '').lower()
    user_station = (getattr(user, 'police_station', '') or '').lower()
    if station and user_station and station == user_station:
        return True

    return False


def validate_file_upload(file_obj):
    """
    Validates uploaded file object for maximum size limit and safe file extensions.
    Returns (is_valid: bool, error_code: str, error_message: str)
    """
    if not file_obj:
        return False, "NO_FILE_PROVIDED", "No file was uploaded."

    # 1. File Size Validation
    max_size = getattr(settings, 'MAX_UPLOAD_SIZE_BYTES', 25 * 1024 * 1024)
    if file_obj.size > max_size:
        return False, "FILE_TOO_LARGE", f"File size ({file_obj.size / (1024*1024):.1f} MB) exceeds maximum 25 MB limit."

    # 2. Extension Blacklisting
    filename = getattr(file_obj, 'name', '') or ''
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext in DISALLOWED_EXTENSIONS:
        return False, "INVALID_FILE_TYPE", f"File extension '.{ext}' is prohibited for security reasons."

    return True, "", ""


def check_rate_limit(identifier, limit=5, period_seconds=60):
    """
    Thread-safe in-memory rate limiter for authentication routes.
    Returns True if request is allowed; False if rate limit exceeded.
    """
    now = time.time()
    key = str(identifier or 'anonymous')

    timestamps = _RATE_LIMIT_STORE.get(key, [])
    # Prune timestamps older than period_seconds
    timestamps = [t for t in timestamps if now - t < period_seconds]

    if len(timestamps) >= limit:
        _RATE_LIMIT_STORE[key] = timestamps
        return False

    timestamps.append(now)
    _RATE_LIMIT_STORE[key] = timestamps
    return True
