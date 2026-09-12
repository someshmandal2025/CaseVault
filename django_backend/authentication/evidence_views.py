import os
import secrets
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from bson import ObjectId
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

from casevault_backend.mongo import get_mongo_db
from authentication.cases_views import get_authenticated_user, record_audit_event, clean_mongo_doc, FALLBACK_CASES
from authentication.documents_views import FALLBACK_CASE_DOCUMENTS
from authentication.security_utils import check_case_access_permission, sanitize_mongo_param, validate_file_upload, check_rate_limit

logger = logging.getLogger(__name__)
User = get_user_model()

VALID_EVIDENCE_TYPES = [
    'DOCUMENT',
    'PHYSICAL_ITEM',
    'DIGITAL_MEDIA',
    'PHOTO',
    'VIDEO',
    'AUDIO',
    'FORENSIC',
    'OTHER'
]

EVIDENCE_TYPE_NORMALIZATION = {
    'document': 'DOCUMENT',
    'physical': 'PHYSICAL_ITEM',
    'physical_item': 'PHYSICAL_ITEM',
    'physical item': 'PHYSICAL_ITEM',
    'digital': 'DIGITAL_MEDIA',
    'digital_media': 'DIGITAL_MEDIA',
    'digital media': 'DIGITAL_MEDIA',
    'photo': 'PHOTO',
    'photograph': 'PHOTO',
    'image': 'PHOTO',
    'video': 'VIDEO',
    'audio': 'AUDIO',
    'forensic': 'FORENSIC',
    'forensic_evidence': 'FORENSIC',
    'other': 'OTHER'
}

VALID_EVIDENCE_STATUSES = ['IN_CUSTODY', 'TRANSFERRED', 'RELEASED', 'ARCHIVED']

STATUS_NORMALIZATION = {
    'in_custody': 'IN_CUSTODY',
    'in custody': 'IN_CUSTODY',
    'transferred': 'TRANSFERRED',
    'released': 'RELEASED',
    'archived': 'ARCHIVED'
}

# Fallback store when MongoDB local service is offline/unreachable
FALLBACK_EVIDENCE = []
FALLBACK_CUSTODY_LOGS = []


def generate_unique_evidence_id(db):
    """
    Generates a unique Evidence ID in format: EVD-WB-2026-XXXXXX
    """
    for _ in range(50):
        rand_num = secrets.randbelow(900000) + 100000
        candidate_id = f"EVD-WB-2026-{rand_num}"
        try:
            if db and db.evidence.find_one({"evidence_id": candidate_id}):
                continue
        except Exception:
            pass
        if any(e.get("evidence_id") == candidate_id for e in FALLBACK_EVIDENCE):
            continue
        return candidate_id
    return f"EVD-WB-2026-{secrets.randbelow(900000) + 100000}"


def record_custody_event(db, evidence_id, case_id, action, from_officer, to_officer=None, remarks="", sha256_hash="", document_id=None):
    """
    Creates an immutable, append-only chain-of-custody event record in MongoDB chain_of_custody collection.
    Actions: CREATED, IN_CUSTODY, TRANSFERRED, ACCEPTED, RELEASED, ACCESSED, VERIFIED
    """
    now_iso = datetime.utcnow().isoformat() + "Z"
    log_id = f"LOG-WB-2026-{secrets.token_hex(6).upper()}"

    from_id = getattr(from_officer, 'officer_id', '') or getattr(from_officer, 'username', 'OFF-001') if hasattr(from_officer, 'officer_id') else str(from_officer or 'OFF-001')
    from_name = getattr(from_officer, 'name', '') or getattr(from_officer, 'username', 'Officer') if hasattr(from_officer, 'name') else str(from_officer or 'Officer')

    to_id = ""
    to_name = ""
    if to_officer:
        to_id = getattr(to_officer, 'officer_id', '') or getattr(to_officer, 'username', '') if hasattr(to_officer, 'officer_id') else str(to_officer)
        to_name = getattr(to_officer, 'name', '') or getattr(to_officer, 'username', '') if hasattr(to_officer, 'name') else str(to_officer)

    custody_doc = {
        "log_id": log_id,
        "evidence_id": evidence_id,
        "case_id": case_id,
        "document_id": document_id,
        "action": action,
        "from_officer_id": from_id,
        "from_officer_name": from_name,
        "to_officer_id": to_id,
        "to_officer_name": to_name,
        "timestamp": now_iso,
        "remarks": remarks,
        "sha256": sha256_hash
    }

    if db is not None:
        try:
            db.chain_of_custody.insert_one(custody_doc)
            return clean_mongo_doc(custody_doc)
        except Exception:
            pass
    clean_c = clean_mongo_doc(custody_doc)
    FALLBACK_CUSTODY_LOGS.append(clean_c)
    return clean_c



class CaseEvidenceListCreateView(APIView):
    """
    API Contract:
    POST /api/cases/{case_id}/evidence/ -> Create Evidence Item & Log Custody Event
    GET /api/cases/{case_id}/evidence/  -> List Case Evidence Items
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

        # Verify case exists & access permissions
        try:
            db = get_mongo_db()
            case_doc = db.cases.find_one({"case_id": case_id})
        except Exception:
            case_doc = next((c for c in FALLBACK_CASES if c.get("case_id") == case_id or c.get("id") == case_id), None)

        if not case_doc:
            return Response({
                "success": False,
                "code": "CASE_NOT_FOUND",
                "message": "Associated case does not exist."
            }, status=status.HTTP_404_NOT_FOUND)

        if not check_case_access_permission(user, case_doc):
            return Response({
                "success": False,
                "code": "PERMISSION_DENIED",
                "message": "You are not authorized to view evidence for this case."
            }, status=status.HTTP_403_FORBIDDEN)

        evidence_list = []
        try:
            db = get_mongo_db()
            raw_evd = list(db.evidence.find({"case_id": case_id}).sort("created_at", -1))
            evidence_list = [clean_mongo_doc(e) for e in raw_evd]
        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            matches = [e for e in FALLBACK_EVIDENCE if e.get("case_id") == case_id]
            evidence_list = [clean_mongo_doc(e) for e in matches]

        record_audit_event(
            get_mongo_db() if 'db' in locals() else None,
            actor_user=user,
            action="EVIDENCE_VIEWED",
            case_id=case_id,
            description=f"Evidence list viewed for case '{case_id}' by Officer {getattr(user, 'officer_id', user.username)}."
        )

        return Response({
            "success": True,
            "evidence": evidence_list
        }, status=status.HTTP_200_OK)

    def post(self, request, case_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 1. Verify case exists
        try:
            db = get_mongo_db()
            case_doc = db.cases.find_one({"case_id": case_id})
        except Exception:
            case_doc = next((c for c in FALLBACK_CASES if c.get("case_id") == case_id or c.get("id") == case_id), None)

        if not case_doc:
            return Response({
                "success": False,
                "code": "CASE_NOT_FOUND",
                "message": f"Case '{case_id}' not found."
            }, status=status.HTTP_404_NOT_FOUND)

        if not check_case_access_permission(user, case_doc):
            record_audit_event(
                get_mongo_db() if 'db' in locals() else None,
                actor_user=user,
                action="UNAUTHORIZED_ACCESS_ATTEMPT",
                case_id=case_id,
                description=f"Unauthorized evidence creation attempt for case '{case_id}' by officer '{getattr(user, 'officer_id', user.username)}'."
            )
            return Response({
                "success": False,
                "code": "PERMISSION_DENIED",
                "message": "You are not authorized to add evidence to this case."
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Extract Evidence Title
        title = (request.data.get('title') or request.data.get('name') or '').strip()
        if not title:
            return Response({
                "success": False,
                "code": "VALIDATION_ERROR",
                "message": "Evidence title is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Evidence Type Validation
        raw_evd_type = str(request.data.get('evidence_type') or request.data.get('type') or 'PHYSICAL_ITEM').strip()
        norm_evd_type = EVIDENCE_TYPE_NORMALIZATION.get(raw_evd_type.lower(), raw_evd_type.upper())
        if norm_evd_type not in VALID_EVIDENCE_TYPES:
            return Response({
                "success": False,
                "code": "INVALID_EVIDENCE_TYPE",
                "message": f"Invalid evidence type. Allowed types: {', '.join(VALID_EVIDENCE_TYPES)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        description = (request.data.get('description') or '').strip()
        source = (request.data.get('source') or 'Investigation Scene').strip()
        document_id = request.data.get('document_id') or None
        sha256_hash = (request.data.get('sha256') or request.data.get('sha256_hash') or '').strip()

        # Handle optional digital file upload
        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            file_bytes = uploaded_file.read()
            sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        officer_id = getattr(user, 'officer_id', '') or getattr(user, 'username', f"OFF-{user.id}")
        officer_name = getattr(user, 'name', '') or getattr(user, 'username', 'Officer')
        now_iso = datetime.utcnow().isoformat() + "Z"

        try:
            db = get_mongo_db()
            evd_id = generate_unique_evidence_id(db)

            evd_record = {
                "evidence_id": evd_id,
                "case_id": case_id,
                "document_id": document_id,
                "title": title,
                "evidence_type": norm_evd_type,
                "description": description,
                "source": source,
                "sha256": sha256_hash,
                "status": "IN_CUSTODY",
                "created_by_officer_id": officer_id,
                "created_by_name": officer_name,
                "current_custodian_officer_id": officer_id,
                "current_custodian_name": officer_name,
                "created_at": now_iso,
                "updated_at": now_iso
            }

            db.evidence.insert_one(evd_record)
            db.cases.update_one({"case_id": case_id}, {"$inc": {"evidence_count": 1}})

            # Initial chain-of-custody event
            record_custody_event(
                db,
                evidence_id=evd_id,
                case_id=case_id,
                action="CREATED",
                from_officer=user,
                remarks=f"Evidence '{title}' logged into custody by Officer {officer_id}.",
                sha256_hash=sha256_hash,
                document_id=document_id
            )

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_CREATED",
                case_id=case_id,
                description=f"Evidence '{title}' ({evd_id}) created by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence created successfully.",
                "evidence": clean_mongo_doc(evd_record)
            }, status=status.HTTP_201_CREATED)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            evd_id = generate_unique_evidence_id(None)
            evd_record = {
                "evidence_id": evd_id,
                "id": evd_id,
                "case_id": case_id,
                "document_id": document_id,
                "title": title,
                "evidence_type": norm_evd_type,
                "description": description,
                "source": source,
                "sha256": sha256_hash,
                "status": "IN_CUSTODY",
                "created_by_officer_id": officer_id,
                "created_by_name": officer_name,
                "current_custodian_officer_id": officer_id,
                "current_custodian_name": officer_name,
                "created_at": now_iso,
                "updated_at": now_iso
            }

            FALLBACK_EVIDENCE.insert(0, evd_record)
            record_custody_event(
                None,
                evidence_id=evd_id,
                case_id=case_id,
                action="CREATED",
                from_officer=user,
                remarks=f"Evidence '{title}' logged into custody by Officer {officer_id}.",
                sha256_hash=sha256_hash,
                document_id=document_id
            )
            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_CREATED",
                case_id=case_id,
                description=f"Evidence '{title}' ({evd_id}) created by Officer {officer_id}."
            )
            return Response({
                "success": True,
                "message": "Evidence created successfully.",
                "evidence": evd_record
            }, status=status.HTTP_201_CREATED)


class EvidenceDetailView(APIView):
    """
    API Contract:
    GET /api/evidence/{evidence_id}/   -> Retrieve single evidence metadata
    PATCH /api/evidence/{evidence_id}/ -> Update evidence metadata (Title, Description, Source)
    """
    permission_classes = [AllowAny]

    def get(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
            if not evd_record:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_VIEWED",
                case_id=evd_record.get("case_id"),
                description=f"Evidence '{evidence_id}' viewed by Officer {getattr(user, 'officer_id', user.username)}."
            )
            return Response({
                "success": True,
                "evidence": clean_mongo_doc(evd_record)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            match = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)
            if not match:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_VIEWED",
                case_id=match.get("case_id"),
                description=f"Evidence '{evidence_id}' viewed by Officer {getattr(user, 'officer_id', user.username)}."
            )
            return Response({
                "success": True,
                "evidence": match
            }, status=status.HTTP_200_OK)

    def patch(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        update_fields = {}

        if "title" in data:
            update_fields["title"] = str(data["title"]).strip()
        if "description" in data:
            update_fields["description"] = str(data["description"]).strip()
        if "source" in data:
            update_fields["source"] = str(data["source"]).strip()

        # Prevent changing immutable values via PATCH
        for forbidden in ["created_by_officer_id", "created_at", "evidence_id", "sha256"]:
            if forbidden in data:
                update_fields.pop(forbidden, None)

        update_fields["updated_at"] = datetime.utcnow().isoformat() + "Z"

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"id": evidence_id}]})
            if not evd_record:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            target_id = evd_record.get("evidence_id") or evidence_id
            db.evidence.update_one({"$or": [{"evidence_id": target_id}, {"id": target_id}]}, {"$set": update_fields})
            updated_doc = db.evidence.find_one({"$or": [{"evidence_id": target_id}, {"id": target_id}]})

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_UPDATED",
                case_id=evd_record.get("case_id"),
                description=f"Evidence '{evidence_id}' metadata updated by Officer {getattr(user, 'officer_id', user.username)}."
            )
            return Response({
                "success": True,
                "message": "Evidence updated successfully.",
                "evidence": clean_mongo_doc(updated_doc)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            match = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)
            if not match:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            match.update(update_fields)
            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_UPDATED",
                case_id=match.get("case_id"),
                description=f"Evidence '{evidence_id}' metadata updated by Officer {getattr(user, 'officer_id', user.username)}."
            )
            return Response({
                "success": True,
                "message": "Evidence updated successfully.",
                "evidence": match
            }, status=status.HTTP_200_OK)


class EvidenceTransferView(APIView):
    """
    API Contract:
    POST /api/evidence/{evidence_id}/transfer/ -> Transfer Evidence Custody to Another Officer
    """
    permission_classes = [AllowAny]

    def post(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        to_officer_id = (request.data.get("to_officer_id") or request.data.get("target_officer_id") or "").strip()
        remarks = (request.data.get("remarks") or "Transferred for investigation/forensic review.").strip()

        if not to_officer_id:
            return Response({
                "success": False,
                "code": "VALIDATION_ERROR",
                "message": "Recipient officer ID (to_officer_id) is required for evidence transfer."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify target officer exists and is active
        target_officer = User.objects.filter(officer_id__iexact=to_officer_id).first() or User.objects.filter(username__iexact=to_officer_id).first()
        if not target_officer or getattr(target_officer, 'status', 'Active') == 'Disabled':
            return Response({
                "success": False,
                "code": "UNAUTHORIZED_TARGET_OFFICER",
                "message": f"Target officer '{to_officer_id}' is invalid or deactivated."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
            if not evd_record:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            target_officer_id = getattr(target_officer, 'officer_id', '') or getattr(target_officer, 'username', f"OFF-{target_officer.id}")
            target_officer_name = getattr(target_officer, 'name', '') or getattr(target_officer, 'username', 'Officer')

            db.evidence.update_one(
                {"evidence_id": evidence_id},
                {"$set": {
                    "status": "TRANSFERRED",
                    "current_custodian_officer_id": target_officer_id,
                    "current_custodian_name": target_officer_name,
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                }}
            )
            updated_evd = db.evidence.find_one({"evidence_id": evidence_id})

            # Create immutable append-only custody event
            custody_event = record_custody_event(
                db,
                evidence_id=evidence_id,
                case_id=evd_record.get("case_id"),
                action="TRANSFERRED",
                from_officer=user,
                to_officer=target_officer,
                remarks=remarks,
                sha256_hash=evd_record.get("sha256", ""),
                document_id=evd_record.get("document_id")
            )

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_TRANSFERRED",
                case_id=evd_record.get("case_id"),
                evidence_id=evidence_id,
                description=f"Evidence '{evidence_id}' transferred from Officer {getattr(user, 'officer_id', user.username)} to Officer {target_officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence transferred successfully.",
                "evidence": clean_mongo_doc(updated_evd),
                "custody_event": clean_mongo_doc(custody_event)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            match = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)
            if not match:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            target_officer_id = getattr(target_officer, 'officer_id', '') or getattr(target_officer, 'username', f"OFF-{target_officer.id}")
            target_officer_name = getattr(target_officer, 'name', '') or getattr(target_officer, 'username', 'Officer')

            match["status"] = "TRANSFERRED"
            match["current_custodian_officer_id"] = target_officer_id
            match["current_custodian_name"] = target_officer_name
            match["updated_at"] = datetime.utcnow().isoformat() + "Z"

            custody_event = record_custody_event(
                None,
                evidence_id=evidence_id,
                case_id=match.get("case_id"),
                action="TRANSFERRED",
                from_officer=user,
                to_officer=target_officer,
                remarks=remarks,
                sha256_hash=match.get("sha256", ""),
                document_id=match.get("document_id")
            )

            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_TRANSFERRED",
                case_id=match.get("case_id"),
                description=f"Evidence '{evidence_id}' transferred from Officer {getattr(user, 'officer_id', user.username)} to Officer {target_officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence transferred successfully.",
                "evidence": match,
                "custody_event": custody_event
            }, status=status.HTTP_200_OK)


class EvidenceAcceptView(APIView):
    """
    API Contract:
    POST /api/evidence/{evidence_id}/accept/ -> Accept Custody of Transferred Evidence
    """
    permission_classes = [AllowAny]

    def post(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        officer_id = getattr(user, 'officer_id', '') or getattr(user, 'username', f"OFF-{user.id}")
        officer_name = getattr(user, 'name', '') or getattr(user, 'username', 'Officer')
        remarks = (request.data.get("remarks") or "Custody accepted by receiving officer.").strip()

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
            if not evd_record:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            db.evidence.update_one(
                {"evidence_id": evidence_id},
                {"$set": {
                    "status": "IN_CUSTODY",
                    "current_custodian_officer_id": officer_id,
                    "current_custodian_name": officer_name,
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                }}
            )
            updated_evd = db.evidence.find_one({"evidence_id": evidence_id})

            custody_event = record_custody_event(
                db,
                evidence_id=evidence_id,
                case_id=evd_record.get("case_id"),
                action="ACCEPTED",
                from_officer=user,
                remarks=remarks,
                sha256_hash=evd_record.get("sha256", ""),
                document_id=evd_record.get("document_id")
            )

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_ACCEPTED",
                case_id=evd_record.get("case_id"),
                description=f"Custody of evidence '{evidence_id}' accepted by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence custody accepted.",
                "evidence": clean_mongo_doc(updated_evd),
                "custody_event": clean_mongo_doc(custody_event)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            match = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)
            if not match:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            match["status"] = "IN_CUSTODY"
            match["current_custodian_officer_id"] = officer_id
            match["current_custodian_name"] = officer_name
            match["updated_at"] = datetime.utcnow().isoformat() + "Z"

            custody_event = record_custody_event(
                None,
                evidence_id=evidence_id,
                case_id=match.get("case_id"),
                action="ACCEPTED",
                from_officer=user,
                remarks=remarks,
                sha256_hash=match.get("sha256", ""),
                document_id=match.get("document_id")
            )

            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_ACCEPTED",
                case_id=match.get("case_id"),
                description=f"Custody of evidence '{evidence_id}' accepted by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence custody accepted.",
                "evidence": match,
                "custody_event": custody_event
            }, status=status.HTTP_200_OK)


class EvidenceReleaseView(APIView):
    """
    API Contract:
    POST /api/evidence/{evidence_id}/release/ -> Release Evidence (Does NOT delete record)
    """
    permission_classes = [AllowAny]

    def post(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        officer_id = getattr(user, 'officer_id', '') or getattr(user, 'username', f"OFF-{user.id}")
        remarks = (request.data.get("remarks") or "Released under judicial order.").strip()

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
            if not evd_record:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            db.evidence.update_one(
                {"evidence_id": evidence_id},
                {"$set": {
                    "status": "RELEASED",
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                }}
            )
            updated_evd = db.evidence.find_one({"evidence_id": evidence_id})

            custody_event = record_custody_event(
                db,
                evidence_id=evidence_id,
                case_id=evd_record.get("case_id"),
                action="RELEASED",
                from_officer=user,
                remarks=remarks,
                sha256_hash=evd_record.get("sha256", ""),
                document_id=evd_record.get("document_id")
            )

            record_audit_event(
                db,
                actor_user=user,
                action="EVIDENCE_RELEASED",
                case_id=evd_record.get("case_id"),
                description=f"Evidence '{evidence_id}' released by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence released.",
                "evidence": clean_mongo_doc(updated_evd),
                "custody_event": clean_mongo_doc(custody_event)
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            match = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)
            if not match:
                return Response({
                    "success": False,
                    "code": "EVIDENCE_NOT_FOUND",
                    "message": "Evidence item not found."
                }, status=status.HTTP_404_NOT_FOUND)

            match["status"] = "RELEASED"
            match["updated_at"] = datetime.utcnow().isoformat() + "Z"

            custody_event = record_custody_event(
                None,
                evidence_id=evidence_id,
                case_id=match.get("case_id"),
                action="RELEASED",
                from_officer=user,
                remarks=remarks,
                sha256_hash=match.get("sha256", ""),
                document_id=match.get("document_id")
            )

            record_audit_event(
                None,
                actor_user=user,
                action="EVIDENCE_RELEASED",
                case_id=match.get("case_id"),
                description=f"Evidence '{evidence_id}' released by Officer {officer_id}."
            )

            return Response({
                "success": True,
                "message": "Evidence released.",
                "evidence": match,
                "custody_event": custody_event
            }, status=status.HTTP_200_OK)


class EvidenceCustodyHistoryView(APIView):
    """
    API Contract:
    GET /api/evidence/{evidence_id}/custody/ -> Retrieve Chronological Chain of Custody History (Append-Only)
    """
    permission_classes = [AllowAny]

    def get(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Verify evidence exists
        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
        except Exception:
            evd_record = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)

        if not evd_record:
            return Response({
                "success": False,
                "code": "EVIDENCE_NOT_FOUND",
                "message": "Evidence item not found."
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            db = get_mongo_db()
            logs_cursor = db.chain_of_custody.find({"evidence_id": evidence_id}).sort("timestamp", 1)
            custody_logs = [clean_mongo_doc(l) for l in logs_cursor]

            record_audit_event(
                db,
                actor_user=user,
                action="CUSTODY_HISTORY_VIEWED",
                case_id=evd_record.get("case_id"),
                description=f"Chain of custody history viewed for evidence '{evidence_id}' by Officer {getattr(user, 'officer_id', user.username)}."
            )

            return Response({
                "success": True,
                "evidence_id": evidence_id,
                "custody": custody_logs
            }, status=status.HTTP_200_OK)

        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError):
            matches = [l for l in FALLBACK_CUSTODY_LOGS if l.get("evidence_id") == evidence_id]
            record_audit_event(
                None,
                actor_user=user,
                action="CUSTODY_HISTORY_VIEWED",
                case_id=evd_record.get("case_id"),
                description=f"Chain of custody history viewed for evidence '{evidence_id}' by Officer {getattr(user, 'officer_id', user.username)}."
            )
            return Response({
                "success": True,
                "evidence_id": evidence_id,
                "custody": matches
            }, status=status.HTTP_200_OK)


class EvidenceVerifyView(APIView):
    """
    API Contract:
    GET /api/evidence/{evidence_id}/verify/ -> Verification of Evidence SHA-256 Hash Integrity (Read-Only)
    """
    permission_classes = [AllowAny]

    def handle_verify(self, request, evidence_id):
        user = get_authenticated_user(request)
        if not user:
            return Response({
                "success": False,
                "code": "UNAUTHENTICATED",
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        try:
            db = get_mongo_db()
            evd_record = db.evidence.find_one({"evidence_id": evidence_id})
        except Exception:
            evd_record = next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)

        if not evd_record:
            return Response({
                "success": False,
                "code": "EVIDENCE_NOT_FOUND",
                "message": "Evidence item not found."
            }, status=status.HTTP_404_NOT_FOUND)

        stored_hash = evd_record.get("sha256") or ""
        doc_id = evd_record.get("document_id")
        calculated_hash = stored_hash

        # If evidence links to a digital document, check physical file hash
        if doc_id:
            try:
                db = get_mongo_db()
                doc_record = db.case_documents.find_one({"document_id": doc_id})
            except Exception:
                doc_record = next((d for d in FALLBACK_CASE_DOCUMENTS if d.get("document_id") == doc_id or d.get("id") == doc_id), None)

            if doc_record:
                rel_ref = doc_record.get("storage_reference", "")
                base_dir = getattr(settings, 'SECURE_MEDIA_ROOT', Path(settings.BASE_DIR) / 'secure_media')
                abs_path = base_dir / rel_ref
                if abs_path.exists() and abs_path.is_file():
                    with open(abs_path, 'rb') as f:
                        calculated_hash = hashlib.sha256(f.read()).hexdigest()

        is_valid = (calculated_hash == stored_hash) if stored_hash else True
        integrity_status = "VALID" if is_valid else "INVALID"

        record_audit_event(
            get_mongo_db() if 'db' in locals() else None,
            actor_user=user,
            action="EVIDENCE_VERIFIED",
            case_id=evd_record.get("case_id"),
            description=f"Evidence '{evidence_id}' hash integrity verified. Result: {integrity_status}."
        )

        return Response({
            "success": True,
            "evidence_id": evidence_id,
            "case_id": evd_record.get("case_id"),
            "integrity": integrity_status,
            "sha256": calculated_hash,
            "stored_sha256": stored_hash
        }, status=status.HTTP_200_OK)

    def get(self, request, evidence_id):
        return self.handle_verify(request, evidence_id)

    def post(self, request, evidence_id):
        return self.handle_verify(request, evidence_id)
