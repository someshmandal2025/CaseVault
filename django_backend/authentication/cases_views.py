import secrets
import logging
from datetime import datetime
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

from casevault_backend.mongo import get_mongo_db

logger = logging.getLogger(__name__)
User = get_user_model()

VALID_STATUSES = ['OPEN', 'UNDER_INVESTIGATION', 'CLOSED']

STATUS_NORMALIZATION = {
    'open': 'OPEN',
    'active': 'OPEN',
    'investigation': 'UNDER_INVESTIGATION',
    'under_investigation': 'UNDER_INVESTIGATION',
    'under investigation': 'UNDER_INVESTIGATION',
    'closed': 'CLOSED',
    'archived': 'CLOSED'
}

# Fallback store when MongoDB local service is offline/unreachable
FALLBACK_CASES = []
FALLBACK_AUDIT_LOGS = []


def get_authenticated_user(request):
    """
    Resolves the Django User from the request.
    Checks request.user (session/token) and custom identity headers (X-Officer-ID / X-User-Email).
    Returns None if user is unauthenticated or disabled.
    """
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        if getattr(user, 'status', 'Active') != 'Disabled' and getattr(user, 'is_active', True):
            return user
        return None

    # Header-based authentication fallback for SPA
    officer_id = (
        request.headers.get('X-Officer-ID') or
        request.headers.get('X-User-ID') or
        request.data.get('requester_officer_id') or
        request.query_params.get('requester_officer_id') or
        ''
    ).strip()

    email = (
        request.headers.get('X-User-Email') or
        ''
    ).strip().lower()

    if officer_id:
        u = User.objects.filter(officer_id__iexact=officer_id).first()
        if u and u.status != 'Disabled' and u.is_active:
            return u

    if email:
        u = User.objects.filter(email__iexact=email).first()
        if u and u.status != 'Disabled' and u.is_active:
            return u

    return None


def generate_unique_case_id(db):
    """
    Generates a unique Case ID in the format: CASE-WB-2026-XXXXXX
    Ensures uniqueness against existing MongoDB/Fallback case records.
    """
    for _ in range(50):
        rand_num = secrets.randbelow(900000) + 100000
        candidate_id = f"CASE-WB-2026-{rand_num}"
        try:
            if db and db.cases.find_one({"case_id": candidate_id}):
                continue
        except Exception:
            pass
        if any(c.get("case_id") == candidate_id for c in FALLBACK_CASES):
            continue
        return candidate_id
    return f"CASE-WB-2026-{secrets.randbelow(900000) + 100000}"


from authentication.audit_service import record_audit_event as central_record_audit_event, FALLBACK_AUDIT_LOGS


def record_audit_event(db, actor_user, action, case_id="", description="", document_id=None, evidence_id=None, request=None):
    """
    Delegates audit recording to central audit_service.
    """
    return central_record_audit_event(
        db,
        actor_user=actor_user,
        event_type=action,
        case_id=case_id,
        document_id=document_id,
        evidence_id=evidence_id,
        description=description,
        request=request
    )



from bson import ObjectId


def clean_mongo_doc(doc):
    """
    Recursively converts MongoDB BSON document (including ObjectIds and datetimes)
    to a clean, JSON-serializable Python dictionary/list.
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [clean_mongo_doc(item) for item in doc]
    if isinstance(doc, dict):
        res = {}
        for k, v in doc.items():
            if k == '_id':
                res['id'] = str(v)
            elif isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, datetime):
                res[k] = v.isoformat() + ("Z" if not v.isoformat().endswith("Z") else "")
            elif isinstance(v, (dict, list)):
                res[k] = clean_mongo_doc(v)
            else:
                res[k] = v
        return res
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat() + ("Z" if not doc.isoformat().endswith("Z") else "")
    return doc



class CaseListCreateView(APIView):
    """
    API Contract:
    GET /api/cases/  -> List Cases with Search & Filtering
    POST /api/cases/ -> Create a new Case Record
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        search_query = (request.query_params.get('search') or request.query_params.get('q') or '').strip().lower()
        status_param = (request.query_params.get('status') or 'ALL').strip().lower()
        type_param = (request.query_params.get('case_type') or request.query_params.get('type') or 'ALL').strip().lower()
        station_param = (request.query_params.get('police_station') or 'ALL').strip()
        priority_param = (request.query_params.get('priority') or 'ALL').strip().lower()
        officer_param = (request.query_params.get('investigating_officer') or 'ALL').strip()

        try:
            db = get_mongo_db()
            mongo_filter = {}

            if status_param != 'all' and status_param:
                norm_status = STATUS_NORMALIZATION.get(status_param, status_param.upper())
                mongo_filter["status"] = norm_status

            if station_param != 'ALL' and station_param:
                mongo_filter["police_station"] = station_param

            if type_param != 'all' and type_param:
                mongo_filter["case_type"] = {"$regex": type_param, "$options": "i"}

            if priority_param != 'all' and priority_param:
                mongo_filter["priority"] = {"$regex": priority_param, "$options": "i"}

            if officer_param != 'ALL' and officer_param:
                mongo_filter["$or"] = [
                    {"investigating_officer_id": {"$regex": officer_param, "$options": "i"}},
                    {"investigating_officer": {"$regex": officer_param, "$options": "i"}}
                ]

            if search_query:
                regex_obj = {"$regex": search_query, "$options": "i"}
                search_condition = {
                    "$or": [
                        {"case_id": regex_obj},
                        {"title": regex_obj},
                        {"description": regex_obj},
                        {"case_type": regex_obj},
                        {"police_station": regex_obj},
                        {"status": regex_obj},
                        {"investigating_officer_id": regex_obj},
                        {"investigating_officer": regex_obj}
                    ]
                }
                if mongo_filter:
                    mongo_filter = {"$and": [mongo_filter, search_condition]}
                else:
                    mongo_filter = search_condition

            cases_cursor = db.cases.find(mongo_filter).sort("created_at", -1)
            cases_list = [clean_mongo_doc(c) for c in cases_cursor]

            return Response({
                "success": True,
                "cases": cases_list
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError) as e:
            logger.error(f"MongoDB unavailable during case listing: {str(e)}")
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) is unavailable. Case records could not be retrieved."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def post(self, request):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({
                "success": False,
                "code": "VALIDATION_ERROR",
                "message": "Case title is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        case_type = (request.data.get('case_type') or request.data.get('caseType') or 'Investigation').strip()
        description = (request.data.get('description') or '').strip()
        police_station = (request.data.get('police_station') or request.data.get('policeStation') or getattr(user, 'police_station', 'Central Police Station')).strip()
        priority = (request.data.get('priority') or 'MEDIUM').strip().upper()

        raw_status = (request.data.get('status') or 'OPEN').strip().lower()
        norm_status = STATUS_NORMALIZATION.get(raw_status, raw_status.upper())
        if norm_status not in VALID_STATUSES:
            return Response({
                "success": False,
                "code": "INVALID_STATUS",
                "message": f"Invalid status value. Allowed: {', '.join(VALID_STATUSES)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        officer_id = getattr(user, 'officer_id', '') or getattr(user, 'username', f"OFF-{user.id}")
        officer_name = getattr(user, 'name', '') or getattr(user, 'username', 'Officer')
        investigating_officer_id = (request.data.get('investigating_officer_id') or officer_id).strip()

        now_iso = datetime.utcnow().isoformat() + "Z"

        try:
            db = get_mongo_db()
            case_id = generate_unique_case_id(db)

            case_doc = {
                "case_id": case_id,
                "title": title,
                "case_type": case_type,
                "description": description,
                "police_station": police_station,
                "investigating_officer_id": investigating_officer_id,
                "investigating_officer": investigating_officer_id,
                "created_by": officer_id,
                "created_by_officer_id": officer_id,
                "created_by_name": officer_name,
                "status": norm_status,
                "priority": priority,
                "document_count": 0,
                "evidence_count": 0,
                "created_at": now_iso,
                "updated_at": now_iso
            }

            db.cases.insert_one(case_doc)
            clean_case = clean_mongo_doc(case_doc)

            record_audit_event(
                db,
                actor_user=user,
                action="CASE_CREATED",
                case_id=case_id,
                description=f"Case '{title}' created by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Case created successfully.",
                "case": clean_case
            }, status=status.HTTP_201_CREATED)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError) as e:
            logger.error(f"MongoDB unavailable during case creation: {str(e)}")
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) is unavailable. Case could not be created."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


from authentication.security_utils import check_case_access_permission, sanitize_mongo_param


class CaseDetailView(APIView):
    """
    API Contract:
    GET /api/cases/{case_id}/   -> Retrieve single case record
    PATCH /api/cases/{case_id}/ -> Update case details or status
    """
    permission_classes = [AllowAny]

    def get(self, request, case_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        try:
            db = get_mongo_db()
            case_doc = db.cases.find_one({"case_id": case_id})
            if not case_doc:
                return Response({
                    "success": False,
                    "code": "CASE_NOT_FOUND",
                    "message": "Case not found."
                }, status=status.HTTP_404_NOT_FOUND)

            # IDOR Authorization check
            if not check_case_access_permission(user, case_doc):
                record_audit_event(
                    db,
                    actor_user=user,
                    action="UNAUTHORIZED_ACCESS_ATTEMPT",
                    case_id=case_id,
                    description=f"Unauthorized access attempt for case '{case_id}' by officer '{getattr(user, 'officer_id', user.username)}'."
                )
                return Response({
                    "success": False,
                    "code": "PERMISSION_DENIED",
                    "message": "You are not authorized to access this case."
                }, status=status.HTTP_403_FORBIDDEN)

            record_audit_event(
                db,
                actor_user=user,
                action="CASE_VIEWED",
                case_id=case_id,
                description=f"Case '{case_id}' viewed by Officer {getattr(user, 'officer_id', user.username)}."
            )

            return Response({
                "success": True,
                "case": clean_mongo_doc(case_doc)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError) as e:
            logger.error(f"MongoDB unavailable during case retrieval: {str(e)}")
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) is unavailable. Case details could not be retrieved."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def patch(self, request, case_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        status_changed = False

        if "status" in data:
            raw_st = str(data["status"]).strip().lower()
            norm_st = STATUS_NORMALIZATION.get(raw_st, raw_st.upper())
            if norm_st not in VALID_STATUSES:
                return Response({
                    "success": False,
                    "code": "INVALID_STATUS",
                    "message": f"Invalid status value. Allowed: {', '.join(VALID_STATUSES)}"
                }, status=status.HTTP_400_BAD_REQUEST)

        try:
            db = get_mongo_db()
            case_doc = db.cases.find_one({"case_id": case_id})
            if not case_doc:
                return Response({
                    "success": False,
                    "code": "CASE_NOT_FOUND",
                    "message": "Case not found."
                }, status=status.HTTP_404_NOT_FOUND)

            update_fields = {}
            old_status = case_doc.get("status", "OPEN")

            if "status" in data:
                norm_st = STATUS_NORMALIZATION.get(str(data["status"]).strip().lower(), str(data["status"]).strip().upper())
                if norm_st != old_status:
                    update_fields["status"] = norm_st
                    status_changed = True

            if "title" in data:
                update_fields["title"] = str(data["title"]).strip()
            if "case_type" in data or "caseType" in data:
                update_fields["case_type"] = str(data.get("case_type") or data.get("caseType")).strip()
            if "description" in data:
                update_fields["description"] = str(data["description"]).strip()
            if "police_station" in data or "policeStation" in data:
                update_fields["police_station"] = str(data.get("police_station") or data.get("policeStation")).strip()
            if "priority" in data:
                update_fields["priority"] = str(data["priority"]).strip().upper()
            if "investigating_officer_id" in data or "investigating_officer" in data:
                inv_id = str(data.get("investigating_officer_id") or data.get("investigating_officer")).strip()
                update_fields["investigating_officer_id"] = inv_id
                update_fields["investigating_officer"] = inv_id

            update_fields["updated_at"] = datetime.utcnow().isoformat() + "Z"

            db.cases.update_one({"case_id": case_id}, {"$set": update_fields})
            updated_doc = db.cases.find_one({"case_id": case_id})

            if status_changed:
                record_audit_event(
                    db,
                    actor_user=user,
                    action="CASE_STATUS_CHANGED",
                    case_id=case_id,
                    description=f"Status changed from '{old_status}' to '{update_fields.get('status')}' by Officer {getattr(user, 'officer_id', user.username)}."
                )
            else:
                record_audit_event(
                    db,
                    actor_user=user,
                    action="CASE_UPDATED",
                    case_id=case_id,
                    description=f"Case '{case_id}' updated by Officer {getattr(user, 'officer_id', user.username)}."
                )

            return Response({
                "success": True,
                "message": "Case updated successfully.",
                "case": clean_mongo_doc(updated_doc)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError) as e:
            logger.error(f"MongoDB unavailable during case update: {str(e)}")
            return Response({
                "success": False,
                "code": "DATABASE_UNAVAILABLE",
                "message": "Secondary database (MongoDB) is unavailable. Case could not be updated."
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
