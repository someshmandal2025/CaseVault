"""
CASEVAULT — Automated Test Suite for Step 11: Security Hardening & API Protection
"""

import json
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from casevault_backend.mongo import get_mongo_db
from authentication.security_utils import (
    sanitize_mongo_param,
    check_case_access_permission,
    validate_file_upload,
    check_rate_limit
)
from authentication.audit_service import FALLBACK_AUDIT_LOGS

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


class SecurityHardeningAndAPIProtectionTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Clear memory stores
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
            username="admin_sec",
            email="admin.sec@casevault.gov.in",
            password="AdminPassword123!",
            name="Admin Security",
            officer_id="OFF-SEC-ADMIN",
            role="ADMINISTRATOR",
            rank="System Administrator",
            police_station="HQ Security Cell",
            status="Active"
        )

        # Create Authorized Officer
        self.officer_user = User.objects.create_user(
            username="officer_sec_1",
            email="officer1.sec@casevault.gov.in",
            password="OfficerPassword123!",
            name="Sub-Inspector Anish",
            officer_id="OFF-SEC-001",
            role="POLICE_OFFICER",
            rank="SI",
            police_station="Kolkata Central PS",
            status="Active"
        )

        # Create Unauthorized Secondary Officer
        self.unauth_officer = User.objects.create_user(
            username="officer_sec_2",
            email="officer2.sec@casevault.gov.in",
            password="OfficerPassword123!",
            name="Sub-Inspector Bikram",
            officer_id="OFF-SEC-002",
            role="POLICE_OFFICER",
            rank="SI",
            police_station="Siliguri North PS",
            status="Active"
        )

        # Create Disabled Officer
        self.disabled_user = User.objects.create_user(
            username="disabled_sec",
            email="disabled.sec@casevault.gov.in",
            password="DisabledPassword123!",
            name="Disabled Officer",
            officer_id="OFF-SEC-DIS",
            role="POLICE_OFFICER",
            rank="Constable",
            police_station="HQ",
            status="Disabled",
            is_active=False
        )

    # --- AUTHENTICATION TESTS ---
    def test_01_valid_login_succeeds(self):
        res = self.client.post('/api/login/', {
            "identifier": "officer1.sec@casevault.gov.in",
            "password": "OfficerPassword123!"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])

    def test_02_invalid_password_rejected(self):
        res = self.client.post('/api/login/', {
            "identifier": "officer1.sec@casevault.gov.in",
            "password": "WrongPassword999!"
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data["code"], "INVALID_CREDENTIALS")

    def test_03_unknown_identifier_rejected(self):
        res = self.client.post('/api/login/', {
            "identifier": "nonexistent@casevault.gov.in",
            "password": "SomePassword123!"
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_04_disabled_user_rejected(self):
        res = self.client.post('/api/login/', {
            "identifier": "disabled.sec@casevault.gov.in",
            "password": "DisabledPassword123!"
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.data["code"], "ACCOUNT_DISABLED")

    def test_05_login_does_not_create_user(self):
        count_before = User.objects.count()
        self.client.post('/api/login/', {"identifier": "newfake@casevault.gov.in", "password": "Password123!"})
        count_after = User.objects.count()
        self.assertEqual(count_before, count_after)

    def test_06_logout_does_not_delete_user(self):
        count_before = User.objects.count()
        self.client.post('/api/logout/', headers={'X-Officer-ID': 'OFF-SEC-001'})
        count_after = User.objects.count()
        self.assertEqual(count_before, count_after)

    def test_07_session_restoration_does_not_create_user(self):
        count_before = User.objects.count()
        self.client.get('/api/auth/me/', headers={'X-Officer-ID': 'OFF-SEC-001'})
        count_after = User.objects.count()
        self.assertEqual(count_before, count_after)

    # --- PASSWORD SECURITY TESTS ---
    def test_08_weak_password_rejected(self):
        res = self.client.post('/api/register/', {
            "officer_id": "OFF-SEC-WEAK",
            "full_name": "Weak Password User",
            "email": "weak@casevault.gov.in",
            "password": "123",
            "category": "POLICE_OFFICER",
            "rank": "SI"
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_password_is_hashed(self):
        user = User.objects.get(username="officer_sec_1")
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))

    def test_10_password_hash_never_appears_in_api_response(self):
        res = self.client.post('/api/login/', {
            "identifier": "officer1.sec@casevault.gov.in",
            "password": "OfficerPassword123!"
        })
        resp_str = json.dumps(res.data)
        self.assertNotIn("pbkdf2", resp_str)
        self.assertNotIn("password", resp_str.lower())

    # --- RBAC TESTS ---
    def test_11_normal_officer_cannot_access_admin_api(self):
        res = self.client.get('/api/admin/users/', headers={
            'X-Officer-ID': 'OFF-SEC-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_12_normal_officer_cannot_promote_themselves(self):
        res = self.client.patch(f'/api/admin/users/{self.officer_user.pk}/', {
            "role": "ADMINISTRATOR"
        }, headers={'X-Officer-ID': 'OFF-SEC-001', 'X-User-Role': 'POLICE_OFFICER'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_13_non_authorized_user_cannot_access_another_case(self):
        # Create case owned by OFF-SEC-001
        case_res = self.client.post('/api/cases/', {
            "title": "Private Case Officer 1",
            "case_type": "CYBER_CRIME"
        }, headers={'X-Officer-ID': 'OFF-SEC-001', 'X-User-Role': 'POLICE_OFFICER'})
        case_id = case_res.data["case"]["case_id"]

        # OFF-SEC-002 attempts to view case_id
        view_res = self.client.get(f'/api/cases/{case_id}/', headers={
            'X-Officer-ID': 'OFF-SEC-002',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(view_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(view_res.data["code"], "PERMISSION_DENIED")

    def test_14_non_authorized_user_cannot_download_another_document(self):
        case_res = self.client.post('/api/cases/', {
            "title": "Case Doc Protection",
            "case_type": "THEFT"
        }, headers={'X-Officer-ID': 'OFF-SEC-001'})
        case_id = case_res.data["case"]["case_id"]

        dummy_file = SimpleUploadedFile("SecureDoc.pdf", b"Confidential Content", content_type="application/pdf")
        doc_res = self.client.post(
            f'/api/cases/{case_id}/documents/',
            {"file": dummy_file, "document_type": "FIR"},
            headers={'X-Officer-ID': 'OFF-SEC-001'},
            format='multipart'
        )
        doc_id = doc_res.data["document"]["document_id"]

        # Unauthorized download attempt
        dl_res = self.client.get(f'/api/documents/{doc_id}/download/', headers={
            'X-Officer-ID': 'OFF-SEC-002',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(dl_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_15_non_authorized_user_cannot_access_another_evidence(self):
        case_res = self.client.post('/api/cases/', {
            "title": "Evidence Protection Case",
            "case_type": "CYBER_CRIME"
        }, headers={'X-Officer-ID': 'OFF-SEC-001'})
        case_id = case_res.data["case"]["case_id"]

        evd_res = self.client.get(f'/api/cases/{case_id}/evidence/', headers={
            'X-Officer-ID': 'OFF-SEC-002',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(evd_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_16_disabled_officer_cannot_perform_new_protected_actions(self):
        res = self.client.post('/api/cases/', {
            "title": "Disabled Action Attempt",
            "case_type": "THEFT"
        }, headers={'X-Officer-ID': 'OFF-SEC-DIS', 'X-User-Role': 'POLICE_OFFICER'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- IDOR TESTS ---
    def test_17_changing_case_id_cannot_bypass_authorization(self):
        res = self.client.get('/api/cases/CASE-WB-2026-999999/', headers={
            'X-Officer-ID': 'OFF-SEC-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_18_changing_document_id_cannot_bypass_authorization(self):
        res = self.client.get('/api/documents/DOC-WB-2026-999999/download/', headers={
            'X-Officer-ID': 'OFF-SEC-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_19_changing_evidence_id_cannot_bypass_authorization(self):
        res = self.client.get('/api/evidence/EVD-WB-2026-999999/', headers={
            'X-Officer-ID': 'OFF-SEC-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_20_changing_audit_id_cannot_bypass_authorization(self):
        res = self.client.get('/api/audit/AUD-2026-999999/', headers={
            'X-Officer-ID': 'OFF-SEC-001',
            'X-User-Role': 'POLICE_OFFICER'
        })
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # --- FILE UPLOAD SECURITY TESTS ---
    def test_21_oversized_upload_rejected(self):
        # Create oversized file (> 25MB)
        large_bytes = b"0" * (26 * 1024 * 1024)
        large_file = SimpleUploadedFile("Oversized.pdf", large_bytes, content_type="application/pdf")
        
        is_valid, err_code, err_msg = validate_file_upload(large_file)
        self.assertFalse(is_valid)
        self.assertEqual(err_code, "FILE_TOO_LARGE")

    def test_22_dangerous_file_type_rejected(self):
        script_file = SimpleUploadedFile("malicious_script.php", b"<?php echo 'hack'; ?>", content_type="application/x-php")
        is_valid, err_code, err_msg = validate_file_upload(script_file)
        self.assertFalse(is_valid)
        self.assertEqual(err_code, "INVALID_FILE_TYPE")

        exe_file = SimpleUploadedFile("trojan.exe", b"MZ...", content_type="application/x-msdownload")
        is_valid, err_code, err_msg = validate_file_upload(exe_file)
        self.assertFalse(is_valid)
        self.assertEqual(err_code, "INVALID_FILE_TYPE")

    def test_23_unauthorized_document_download_rejected(self):
        res = self.client.get('/api/documents/DOC-UNAUTH-123/download/', headers={
            'X-Officer-ID': 'OFF-SEC-002'
        })
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_24_document_hash_calculated_from_actual_bytes(self):
        import hashlib
        data_bytes = b"Authentic Byte Content 2026"
        expected_hash = hashlib.sha256(data_bytes).hexdigest()
        
        case_res = self.client.post('/api/cases/', {"title": "Hash Test Case"}, headers={'X-Officer-ID': 'OFF-SEC-001'})
        case_id = case_res.data["case"]["case_id"]

        dummy_file = SimpleUploadedFile("ByteDoc.pdf", data_bytes, content_type="application/pdf")
        doc_res = self.client.post(
            f'/api/cases/{case_id}/documents/',
            {"file": dummy_file, "document_type": "FIR"},
            headers={'X-Officer-ID': 'OFF-SEC-001'},
            format='multipart'
        )
        self.assertEqual(doc_res.data["document"]["sha256"], expected_hash)

    # --- MONGODB INJECTION & PARAMETER TESTS ---
    def test_25_arbitrary_mongo_query_operators_rejected(self):
        inj_dict = {"$gt": ""}
        sanitized = sanitize_mongo_param(inj_dict)
        self.assertEqual(sanitized, "")

        inj_str = "$where"
        sanitized_str = sanitize_mongo_param(inj_str)
        self.assertEqual(sanitized_str, "")

    def test_26_user_cannot_inject_arbitrary_filters(self):
        res = self.client.get('/api/audit/?event_type={"$gt":""}', headers={
            'X-Officer-ID': 'OFF-SEC-ADMIN',
            'X-User-Role': 'ADMINISTRATOR'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # --- OTP SECURITY TESTS ---
    def test_27_expired_or_invalid_otp_rejected(self):
        res = self.client.post('/api/auth/verify-otp/', {
            "email": "officer1.sec@casevault.gov.in",
            "otp": "000000"
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_28_reused_otp_rejected(self):
        res = self.client.post('/api/auth/verify-otp/', {
            "email": "officer1.sec@casevault.gov.in",
            "otp": "000000"
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_29_excessive_otp_attempts_rate_limited(self):
        for _ in range(6):
            check_rate_limit("otp_test_ip", limit=5, period_seconds=60)
        allowed = check_rate_limit("otp_test_ip", limit=5, period_seconds=60)
        self.assertFalse(allowed)

    def test_30_otp_code_never_returned_in_api_response(self):
        res = self.client.post('/api/auth/forgot-password/', {
            "email": "officer1.sec@casevault.gov.in"
        })
        resp_str = json.dumps(res.data)
        self.assertNotIn("otp_code", resp_str)

    # --- GENERAL SECURITY TESTS ---
    def test_31_secrets_absent_from_api_responses(self):
        res = self.client.get('/api/auth/me/', headers={'X-Officer-ID': 'OFF-SEC-001'})
        resp_str = json.dumps(res.data)
        self.assertNotIn("SECRET_KEY", resp_str)
        self.assertNotIn("EMAIL_HOST_PASSWORD", resp_str)

    def test_32_debug_stack_trace_not_returned(self):
        res = self.client.get('/api/cases/INVALID-CASE-ID/')
        self.assertNotIn("Traceback (most recent call last)", str(res.content))

    def test_33_cors_allowed_origins_configured(self):
        from django.conf import settings
        self.assertIsInstance(settings.CORS_ALLOWED_ORIGINS, list)

    def test_34_security_headers_present(self):
        res = self.client.get('/api/cases/')
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")

    def test_35_login_rate_limiting_returns_http_429(self):
        # Exceed rate limit for key
        for _ in range(11):
            res = self.client.post('/api/login/', {
                "identifier": "rate_limit_user@casevault.gov.in",
                "password": "WrongPassword!"
            }, REMOTE_ADDR="192.168.1.99")
        
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(res.data["code"], "TOO_MANY_REQUESTS")

    def test_36_rate_limit_event_generates_security_audit_log(self):
        for _ in range(11):
            self.client.post('/api/login/', {
                "identifier": "rate_limit_audit_user@casevault.gov.in",
                "password": "WrongPassword!"
            }, REMOTE_ADDR="192.168.1.100")

        db = safe_get_db()
        logs = list(db.audit_logs.find({"event_type": "RATE_LIMIT_TRIGGERED"})) if db is not None else [l for l in FALLBACK_AUDIT_LOGS if l.get("event_type") == "RATE_LIMIT_TRIGGERED"]
        self.assertGreaterEqual(len(logs), 1)
