"""
CASEVAULT — Audit REST API Views

Implements REST API endpoints for:
- GET /api/audit/ (List & Search Audit Logs with Pagination & RBAC)
- GET /api/audit/{audit_id}/ (Single Audit Log Detail View)
- GET /api/audit/verify/ (SHA-256 Tamper-Evident Audit Chain Integrity Verification)
"""

import math
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

from casevault_backend.mongo import get_mongo_db
from authentication.cases_views import get_authenticated_user
from authentication.audit_service import (
    record_audit_event,
    verify_audit_chain,
    clean_mongo_doc,
    FALLBACK_AUDIT_LOGS
)

logger = logging.getLogger(__name__)


_mongo_status_cache = {"available": None, "last_check": 0}

def safe_get_db():
    import time
    now = time.time()
    if _mongo_status_cache["available"] is False and (now - _mongo_status_cache["last_check"]) < 5:
        return None
    try:
        db = get_mongo_db()
        db.command('ping')
        _mongo_status_cache["available"] = True
        _mongo_status_cache["last_check"] = now
        return db
    except Exception:
        _mongo_status_cache["available"] = False
        _mongo_status_cache["last_check"] = now
        return None


class AuditLogListView(APIView):
    """
    API Contract:
    GET /api/audit/
    Requires authentication. Returns paginated & filtered audit logs.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required to view audit logs."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Pagination params
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 25))
            if page < 1:
                page = 1
            if page_size < 1 or page_size > 200:
                page_size = 25
        except ValueError:
            page = 1
            page_size = 25

        # Query Filters
        event_type = request.query_params.get('event_type', '').strip()
        officer_id = request.query_params.get('officer_id', '').strip()
        case_id = request.query_params.get('case_id', '').strip()
        document_id = request.query_params.get('document_id', '').strip()
        evidence_id = request.query_params.get('evidence_id', '').strip()
        date_from = request.query_params.get('date_from', '').strip()
        date_to = request.query_params.get('date_to', '').strip()
        search_query = request.query_params.get('search', '').strip().lower()

        user_role = getattr(user, 'role', '').upper()
        user_officer_id = getattr(user, 'officer_id', '') or getattr(user, 'username', '')

        db = safe_get_db()
        if db is None:
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) is unavailable. Audit logs could not be retrieved."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        logs = []
        try:
            mongo_filter = {}
            if event_type and event_type.upper() != 'ALL':
                mongo_filter['$or'] = [
                    {'event_type': {'$regex': f"^{event_type}$", '$options': 'i'}},
                    {'action': {'$regex': f"^{event_type}$", '$options': 'i'}}
                ]
            if officer_id and officer_id.upper() != 'ALL':
                mongo_filter['actor_officer_id'] = officer_id
            if case_id:
                mongo_filter['case_id'] = case_id
            if document_id:
                mongo_filter['document_id'] = document_id
            if evidence_id:
                mongo_filter['evidence_id'] = evidence_id

            if date_from or date_to:
                date_query = {}
                if date_from:
                    date_query['$gte'] = date_from
                if date_to:
                    date_query['$lte'] = date_to
                mongo_filter['timestamp'] = date_query

            # Non-admins restricted to their own officer ID or authorized case activities
            if user_role not in ['ADMINISTRATOR', 'ADMIN', 'SYSTEM_ADMIN']:
                rbac_clause = {'$or': [
                    {'actor_officer_id': user_officer_id},
                    {'target_officer_id': user_officer_id}
                ]}
                if 'case_id' in mongo_filter:
                    pass  # Explicit case filter requested
                else:
                    if '$or' in mongo_filter:
                        mongo_filter['$and'] = [mongo_filter.pop('$or'), rbac_clause]
                    else:
                        mongo_filter.update(rbac_clause)

            raw_logs = list(db.audit_logs.find(mongo_filter).sort("timestamp", -1))
            logs = [clean_mongo_doc(l) for l in raw_logs]
        except Exception as e:
            logger.error(f"Mongo audit log search error: {str(e)}")
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) error encountered."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # In-memory search filtering if text search requested
        if search_query:
            logs = [
                l for l in logs
                if search_query in str(l.get('audit_id', '')).lower()
                or search_query in str(l.get('event_type', '')).lower()
                or search_query in str(l.get('action', '')).lower()
                or search_query in str(l.get('actor_name', '')).lower()
                or search_query in str(l.get('actor_officer_id', '')).lower()
                or search_query in str(l.get('case_id', '')).lower()
                or search_query in str(l.get('document_id', '')).lower()
                or search_query in str(l.get('evidence_id', '')).lower()
                or search_query in str(l.get('description', '')).lower()
                or search_query in str(l.get('action_description', '')).lower()
            ]

        # Apply Pagination
        total_count = len(logs)
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_logs = logs[start_idx:end_idx]

        return Response({
            "success": True,
            "count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "audit_logs": paginated_logs
        }, status=status.HTTP_200_OK)


class AuditDetailView(APIView):
    """
    API Contract:
    GET /api/audit/{audit_id}/
    Requires authentication. Returns details for a single audit log record.
    """
    permission_classes = [AllowAny]

    def get(self, request, audit_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required to view audit log record."
            }, status=status.HTTP_401_UNAUTHORIZED)

        db = safe_get_db()
        record = None

        if db is not None:
            try:
                record = db.audit_logs.find_one({"$or": [{"audit_id": audit_id}, {"event_id": audit_id}]})
            except Exception:
                record = None

        if not record:
            for fallback in FALLBACK_AUDIT_LOGS:
                if fallback.get('audit_id') == audit_id or fallback.get('event_id') == audit_id:
                    record = fallback
                    break

        if not record:
            return Response({
                "success": False,
                "code": "AUDIT_LOG_NOT_FOUND",
                "message": f"Audit record '{audit_id}' not found."
            }, status=status.HTTP_404_NOT_FOUND)

        cleaned_rec = clean_mongo_doc(record)
        return Response({
            "success": True,
            "audit": cleaned_rec
        }, status=status.HTTP_200_OK)


class AuditVerifyView(APIView):
    """
    API Contract:
    GET /api/audit/verify/
    Requires Administrator / Security authorization. Recalculates the SHA-256 chain from genesis to latest.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required to run audit verification."
            }, status=status.HTTP_401_UNAUTHORIZED)

        user_role = getattr(user, 'role', '').upper()
        if user_role not in ['ADMINISTRATOR', 'ADMIN', 'SENIOR_OFFICER', 'SYSTEM_ADMIN']:
            return Response({
                "success": False,
                "code": "AUDIT_ACCESS_DENIED",
                "message": "Only Administrators and Security Officers can verify audit chain integrity."
            }, status=status.HTTP_403_FORBIDDEN)

        db = safe_get_db()
        verification_result = verify_audit_chain(db)

        # Log verification audit event
        record_audit_event(
            db,
            actor_user=user,
            event_type="AUDIT_VERIFIED",
            description=f"Ran SHA-256 audit chain verification. Result: {'VALID' if verification_result.get('valid') else 'INVALID'}",
            metadata={"records_checked": verification_result.get("records_checked")},
            request=request
        )

        return Response(verification_result, status=status.HTTP_200_OK)
