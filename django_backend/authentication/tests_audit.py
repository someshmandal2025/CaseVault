"""
CASEVAULT — Automated Test Suite for Step 10: Audit Trail & Tamper-Evident SHA-256 Audit Integrity
"""

import json
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from casevault_backend.mongo import get_mongo_db
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError
from authentication.audit_service import (
    record_audit_event,
    verify_audit_chain,
    GENESIS_HASH,
    FALLBACK_AUDIT_LOGS,
    compute_audit_record_hash
)

User = get_user_model()


_mongo_available = None

def safe_get_db():
    global _mongo_available
    if _mongo_available is False:
        return None
    try:
        db = get_mongo_db()
        db.command('ping')
        _mongo_available = True
        return db
    except Exception:
        _mongo_available = False
        return None


class AuditTrailAndTamperEvidentIntegrityTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Clean fallback and Mongo audit collections before tests
        FALLBACK_AUDIT_LOGS.clear()
        try:
            db = safe_get_db()
            if db is not None:
                db.audit_logs.delete_many({})
                db.cases.delete_many({})
                db.evidence.delete_many({})
                db.case_documents.delete_many({})
        except Exception:
            pass

        # Create Admin Officer
        self.admin_user = User.objects.create_user(
            username="admin_audit",
            email="admin.audit@casevault.gov.in",
            password="AdminPassword123!",
            name="Admin Auditor",
            officer_id="OFF-AUD-ADMIN",
            role="ADMINISTRATOR",
            rank="System Administrator",
            police_station="HQ Crime Branch",
            status="Active"
        )

        # Create Standard Officer
        self.officer_user = User.objects.create_user(
            username="officer_audit",
            email="officer.audit@casevault.gov.in",
            password="OfficerPassword123!",
            name="Sub-Inspector Rahul",
            officer_id="OFF-AUD-001",
            role="POLICE_OFFICER",
            rank="SI",
            police_station="Kolkata Central PS",
            status="Active"
        )

        # Create Target Transfer Officer
        self.target_officer = User.objects.create_user(
            username="officer_audit_target",
            email="officer.target@casevault.gov.in",
            password="OfficerPassword123!",
            name="Inspector Karan",
            officer_id="OFF-AUD-002",
            role="SENIOR_OFFICER",
            rank="Inspector",
            police_station="Kolkata Cyber Cell",
            status="Active"
        )

        # Create Disabled Officer
        self.disabled_user = User.objects.create_user(
            username="disabled_audit",
            email="disabled.audit@casevault.gov.in",
            password="DisabledPassword123!",
            name="Disabled Officer",
            officer_id="OFF-AUD-DIS",
            role="POLICE_OFFICER",
            rank="Constable",
            police_station="HQ",
            status="Disabled",
            is_active=False
        )

    def test_01_successful_login_creates_audit_event(self):
        res = self.client.post('/api/login/', {
            "identifier": "officer.audit@casevault.gov.in",
            "password": "OfficerPassword123!"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "LOGIN_SUCCESS"})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)
        self.assertEqual(logs[0]["actor_officer_id"], "OFF-AUD-001")

    def test_02_failed_login_creates_audit_event(self):
        res = self.client.post('/api/login/', {
            "identifier": "officer.audit@casevault.gov.in",
            "password": "WrongPassword123!"
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        
        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "LOGIN_FAILED"})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_03_logout_creates_audit_event(self):
        res = self.client.post('/api/logout/', headers={
            'X-Officer-ID': 'OFF-AUD-001'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "LOGOUT"})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_04_officer_registration_creates_audit_event(self):
        reg_payload = {
            "officer_id": "OFF-AUD-999",
            "full_name": "New Registered Officer",
            "email": "new.reg@casevault.gov.in",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "category": "POLICE_OFFICER",
            "rank": "SI",
            "police_station": "South PS"
        }
        res = self.client.post('/api/register/', reg_payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "OFFICER_CREATED"})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_05_case_creation_creates_audit_event(self):
        case_res = self.client.post('/api/cases/', {
            "title": "Audit Test Cyber Crime",
            "case_type": "CYBER_CRIME",
            "description": "Cyber crime investigation for audit trail.",
            "police_station": "Kolkata Cyber Cell"
        }, headers={'X-Officer-ID': 'OFF-AUD-001', 'X-User-Role': 'POLICE_OFFICER'})
        self.assertEqual(case_res.status_code, status.HTTP_201_CREATED)

        case_id = case_res.data["case"]["case_id"]
        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "CASE_CREATED", "case_id": case_id})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_06_document_upload_creates_audit_event(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        case_res = self.client.post('/api/cases/', {
            "title": "Document Test Case",
            "case_type": "THEFT"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        case_id = case_res.data["case"]["case_id"]

        dummy_file = SimpleUploadedFile("FIR_Audit.pdf", b"FIR Content Bytes", content_type="application/pdf")
        doc_res = self.client.post(
            f'/api/cases/{case_id}/documents/',
            {"file": dummy_file, "document_type": "FIR"},
            headers={'X-Officer-ID': 'OFF-AUD-001'},
            format='multipart'
        )
        self.assertEqual(doc_res.status_code, status.HTTP_201_CREATED)

        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "DOCUMENT_UPLOADED", "case_id": case_id})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_07_evidence_creation_creates_audit_event(self):
        case_res = self.client.post('/api/cases/', {
            "title": "Evidence Test Case",
            "case_type": "CYBER_CRIME"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        case_id = case_res.data["case"]["case_id"]

        evd_res = self.client.post(f'/api/cases/{case_id}/evidence/', {
            "title": "Seized Phone",
            "evidence_type": "DIGITAL_MEDIA",
            "description": "Mobile device"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        self.assertEqual(evd_res.status_code, status.HTTP_201_CREATED)

        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "EVIDENCE_CREATED", "case_id": case_id})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_08_evidence_transfer_creates_audit_event(self):
        case_res = self.client.post('/api/cases/', {
            "title": "Transfer Case",
            "case_type": "FINANCIAL_FRAUD"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        case_id = case_res.data["case"]["case_id"]

        evd_res = self.client.post(f'/api/cases/{case_id}/evidence/', {
            "title": "Bank Passbook",
            "evidence_type": "DOCUMENT"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        evidence_id = evd_res.data["evidence"]["evidence_id"]

        transfer_res = self.client.post(f'/api/evidence/{evidence_id}/transfer/', {
            "to_officer_id": "OFF-AUD-002",
            "remarks": "Transferring for investigation"
        }, headers={'X-Officer-ID': 'OFF-AUD-001'})
        self.assertEqual(transfer_res.status_code, status.HTTP_200_OK)

        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "EVIDENCE_TRANSFERRED", "evidence_id": evidence_id})) if db is not None else FALLBACK_AUDIT_LOGS
        self.assertGreaterEqual(len(logs), 1)

    def test_09_unique_audit_ids_assigned(self):
        db = safe_get_db()
        r1 = record_audit_event(db, self.officer_user, "TEST_EVENT_1", description="Event 1")
        r2 = record_audit_event(db, self.officer_user, "TEST_EVENT_2", description="Event 2")
        
        self.assertTrue(r1["audit_id"].startswith("AUD-2026-"))
        self.assertTrue(r2["audit_id"].startswith("AUD-2026-"))
        self.assertNotEqual(r1["audit_id"], r2["audit_id"])

    def test_10_record_hash_calculated_from_canonical_json(self):
        db = safe_get_db()
        rec = record_audit_event(db, self.officer_user, "CANONICAL_TEST", description="Canonical check")
        
        expected_hash = compute_audit_record_hash(
            previous_hash=rec["previous_hash"],
            audit_id=rec["audit_id"],
            event_type=rec["event_type"],
            actor_officer_id=rec["actor_officer_id"],
            case_id=rec["case_id"],
            document_id=rec["document_id"],
            evidence_id=rec["evidence_id"],
            target_officer_id=rec["target_officer_id"],
            description=rec["action_description"],
            timestamp=rec["timestamp"],
            metadata=rec["metadata"]
        )
        self.assertEqual(rec["record_hash"], expected_hash)

    def test_11_previous_hash_links_chronologically(self):
        db = safe_get_db()
        r1 = record_audit_event(db, self.officer_user, "CHAIN_1", description="First")
        r2 = record_audit_event(db, self.officer_user, "CHAIN_2", description="Second")

        self.assertEqual(r2["previous_hash"], r1["record_hash"])

    def test_12_genesis_hash_used_for_first_record(self):
        db = safe_get_db()
        FALLBACK_AUDIT_LOGS.clear()
        if db is not None:
            db.audit_logs.delete_many({})
        r1 = record_audit_event(db, self.officer_user, "GENESIS_TEST", description="First record")
        self.assertEqual(r1["previous_hash"], GENESIS_HASH)

    def test_13_audit_chain_verification_succeeds_for_valid_chain(self):
        db = safe_get_db()
        record_audit_event(db, self.officer_user, "EVENT_A", description="A")
        record_audit_event(db, self.officer_user, "EVENT_B", description="B")

        res = self.client.get('/api/audit/verify/', headers={
            'X-Officer-ID': 'OFF-AUD-ADMIN',
            'X-User-Role': 'ADMINISTRATOR'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertTrue(res.data["valid"])
        self.assertEqual(len(res.data["invalid_records"]), 0)

    def test_14_tampering_record_causes_verification_failure(self):
        db = safe_get_db()
        r1 = record_audit_event(db, self.officer_user, "EVENT_OK", description="Pristine record")

        # Mutate the record directly in DB to simulate tampering
        if db is not None:
            db.audit_logs.update_one({"audit_id": r1["audit_id"]}, {"$set": {"action_description": "TAMPERED CONTENT"}})
        else:
            FALLBACK_AUDIT_LOGS[0]["action_description"] = "TAMPERED CONTENT"

        res = self.client.get('/api/audit/verify/', headers={
            'X-Officer-ID': 'OFF-AUD-ADMIN',
            'X-User-Role': 'ADMINISTRATOR'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["valid"])
        self.assertGreaterEqual(len(res.data["invalid_records"]), 1)

    def test_15_unauthorized_post_audit_rejected(self):
        res = self.client.post('/api/audit/', {"fake": "event"})
        self.assertIn(res.status_code, [status.HTTP_405_METHOD_NOT_ALLOWED, status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_16_non_admin_cannot_access_audit_verify(self):
        res = self.client.get('/api/audit/verify/', headers={
            'X-Officer-ID': 'OFF-AUD-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data["code"], "AUDIT_ACCESS_DENIED")

    def test_17_disabled_officer_cannot_create_audit_actions(self):
        res = self.client.post('/api/cases/', {
            "title": "Disabled Officer Case",
            "case_type": "THEFT"
        }, headers={'X-Officer-ID': 'OFF-AUD-DIS', 'X-User-Role': 'POLICE_OFFICER'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_18_no_sensitive_secrets_in_audit_records(self):
        db = safe_get_db()
        rec = record_audit_event(
            db,
            self.officer_user,
            "SENSITIVE_TEST",
            metadata={"password": "MySecretPassword123!", "otp": "123456", "token": "jwt-token-val"}
        )
        self.assertEqual(rec["metadata"]["password"], "[REDACTED_SECRET]")
        self.assertEqual(rec["metadata"]["otp"], "[REDACTED_SECRET]")
        self.assertEqual(rec["metadata"]["token"], "[REDACTED_SECRET]")

    def test_19_empty_database_returns_empty_list_without_mock_data(self):
        res = self.client.get('/api/audit/', headers={'X-Officer-ID': 'OFF-AUD-ADMIN', 'X-User-Role': 'ADMINISTRATOR'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 0)
        self.assertEqual(res.data["audit_logs"], [])

    def test_20_navigation_does_not_create_audit_events(self):
        db = safe_get_db()
        before_count = db.audit_logs.count_documents({}) if db is not None else len(FALLBACK_AUDIT_LOGS)

        self.client.get('/api/cases/', headers={'X-Officer-ID': 'OFF-AUD-ADMIN', 'X-User-Role': 'ADMINISTRATOR'})
        self.client.get('/api/audit/', headers={'X-Officer-ID': 'OFF-AUD-ADMIN', 'X-User-Role': 'ADMINISTRATOR'})

        after_count = db.audit_logs.count_documents({}) if db is not None else len(FALLBACK_AUDIT_LOGS)
        self.assertEqual(before_count, after_count)
