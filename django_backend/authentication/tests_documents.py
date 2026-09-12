import os
import hashlib
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from casevault_backend.mongo import get_mongo_db
from authentication.cases_views import FALLBACK_CASES, FALLBACK_AUDIT_LOGS
from authentication.documents_views import FALLBACK_CASE_DOCUMENTS

User = get_user_model()


def safe_count_documents(case_id=None):
    try:
        db = get_mongo_db()
        query = {"case_id": case_id} if case_id else {}
        return db.case_documents.count_documents(query)
    except Exception:
        if case_id:
            return len([d for d in FALLBACK_CASE_DOCUMENTS if d.get("case_id") == case_id])
        return len(FALLBACK_CASE_DOCUMENTS)


def safe_find_document(doc_id):
    try:
        db = get_mongo_db()
        doc = db.case_documents.find_one({"document_id": doc_id})
        if doc:
            return doc
    except Exception:
        pass
    return next((d for d in FALLBACK_CASE_DOCUMENTS if d.get("document_id") == doc_id or d.get("id") == doc_id), None)


def safe_find_audit(action, case_id=None):
    try:
        db = get_mongo_db()
        query = {"action": action}
        if case_id:
            query["case_id"] = case_id
        doc = db.audit_logs.find_one(query)
        if doc:
            return doc
    except Exception:
        pass
    return next((a for a in FALLBACK_AUDIT_LOGS if a.get("action") == action and (not case_id or a.get("case_id") == case_id)), None)


class DocumentManagementAPIContractTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()
        FALLBACK_CASE_DOCUMENTS.clear()

        # Seed authenticated officer
        self.officer = User.objects.create(
            username="investigator.officer",
            email="investigator@police.gov.in",
            name="SI Shivam Kumar Singh",
            officer_id="OFF-7701",
            role="police_officer",
            rank="SI",
            police_station="Siliguri Police Station",
            status="Active"
        )
        self.officer.set_password("OfficerPass@123")
        self.officer.save()

        # Clean Mongo collections before test execution if server online
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.case_documents.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

        # Create a valid case for document testing
        self.client.force_authenticate(user=self.officer)
        create_res = self.client.post('/api/cases/', {
            "title": "Armed Robbery at Mall",
            "case_type": "Robbery",
            "police_station": "Siliguri Police Station",
            "priority": "HIGH"
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.case_id = create_res.data['case']['case_id']

    def tearDown(self):
        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()
        FALLBACK_CASE_DOCUMENTS.clear()
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.case_documents.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

    def test_01_upload_valid_fir_document(self):
        self.client.force_authenticate(user=self.officer)
        content_bytes = b"GOVERNMENT OF INDIA POLICE DEPARTMENT FIR RECORD 1024"
        expected_sha256 = hashlib.sha256(content_bytes).hexdigest()

        uploaded_file = SimpleUploadedFile(
            "FIR_Certified_Copy.pdf",
            content_bytes,
            content_type="application/pdf"
        )

        res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {
                "file": uploaded_file,
                "document_type": "FIR",
                "document_name": "Initial FIR Copy",
                "classification": "Confidential"
            },
            format='multipart'
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))
        doc_data = res.data['document']

        # Check required field formats
        self.assertTrue(doc_data['document_id'].startswith("DOC-WB-2026-"))
        self.assertEqual(doc_data['case_id'], self.case_id)
        self.assertEqual(doc_data['document_type'], "FIR")
        self.assertEqual(doc_data['uploaded_by_officer_id'], "OFF-7701")
        self.assertEqual(doc_data['sha256'], expected_sha256)

        # Verify exact document count in storage
        self.assertEqual(safe_count_documents(self.case_id), 1)

        # Verify audit log recorded for DOCUMENT_UPLOADED
        audit_entry = safe_find_audit("DOCUMENT_UPLOADED", self.case_id)
        self.assertIsNotNone(audit_entry)

    def test_02_unauthenticated_upload_rejected_401(self):
        self.client.logout()
        uploaded_file = SimpleUploadedFile("Test.pdf", b"test content", content_type="application/pdf")
        res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": uploaded_file, "document_type": "FIR"},
            format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_03_invalid_case_id_returns_404(self):
        self.client.force_authenticate(user=self.officer)
        uploaded_file = SimpleUploadedFile("FIR.pdf", b"FIR data", content_type="application/pdf")
        res = self.client.post(
            '/api/cases/CASE-NONEXISTENT-9999/documents/',
            {"file": uploaded_file, "document_type": "FIR"},
            format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.data.get('code'), "CASE_NOT_FOUND")

    def test_04_invalid_document_type_rejected_400(self):
        self.client.force_authenticate(user=self.officer)
        uploaded_file = SimpleUploadedFile("FIR.pdf", b"FIR data", content_type="application/pdf")
        res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": uploaded_file, "document_type": "INVALID_CUSTOM_TYPE_XYZ"},
            format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get('code'), "INVALID_DOCUMENT_TYPE")

    def test_05_sha256_hash_verification_passed(self):
        self.client.force_authenticate(user=self.officer)
        content_bytes = b"AUTHENTIC UNALTERED CASE RECORD CONTENT"
        expected_sha256 = hashlib.sha256(content_bytes).hexdigest()

        uploaded_file = SimpleUploadedFile("Report.pdf", content_bytes, content_type="application/pdf")
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": uploaded_file, "document_type": "INVESTIGATION_REPORT"},
            format='multipart'
        )
        doc_id = create_res.data['document']['document_id']

        verify_res = self.client.get(f'/api/documents/{doc_id}/verify/')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_res.data.get('success'))
        self.assertEqual(verify_res.data.get('integrity'), "VALID")
        self.assertEqual(verify_res.data.get('sha256'), expected_sha256)

    def test_06_duplicate_file_content_detected_409(self):
        self.client.force_authenticate(user=self.officer)
        content_bytes = b"IDENTICAL REPEATED FILE CONTENT"

        # Upload first file
        file1 = SimpleUploadedFile("First.pdf", content_bytes, content_type="application/pdf")
        res1 = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": file1, "document_type": "WITNESS_STATEMENT"},
            format='multipart'
        )
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Upload duplicate content
        file2 = SimpleUploadedFile("Duplicate_First.pdf", content_bytes, content_type="application/pdf")
        res2 = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": file2, "document_type": "WITNESS_STATEMENT"},
            format='multipart'
        )
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data.get('code'), "DUPLICATE_DOCUMENT")

        # Verify audit log for duplicate upload attempt
        audit_entry = safe_find_audit("DUPLICATE_DOCUMENT_ATTEMPT", self.case_id)
        self.assertIsNotNone(audit_entry)

    def test_07_list_case_documents(self):
        self.client.force_authenticate(user=self.officer)
        # Upload doc 1
        self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": SimpleUploadedFile("Doc1.pdf", b"Content 1", content_type="application/pdf"), "document_type": "FIR"},
            format='multipart'
        )
        # Upload doc 2
        self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": SimpleUploadedFile("Doc2.pdf", b"Content 2", content_type="application/pdf"), "document_type": "CHARGE_SHEET"},
            format='multipart'
        )

        res = self.client.get(f'/api/cases/{self.case_id}/documents/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertEqual(len(res.data.get('documents')), 2)

    def test_08_get_single_document_by_id(self):
        self.client.force_authenticate(user=self.officer)
        upload_res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": SimpleUploadedFile("Forensic.pdf", b"DNA Report Data", content_type="application/pdf"), "document_type": "FORENSIC_REPORT"},
            format='multipart'
        )
        doc_id = upload_res.data['document']['document_id']

        get_res = self.client.get(f'/api/documents/{doc_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data.get('success'))
        self.assertEqual(get_res.data['document']['document_type'], "FORENSIC_REPORT")

    def test_09_download_document_binary(self):
        self.client.force_authenticate(user=self.officer)
        upload_res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": SimpleUploadedFile("LegalMemo.pdf", b"CONFIDENTIAL LEGAL MEMO", content_type="application/pdf"), "document_type": "LEGAL_DOCUMENT"},
            format='multipart'
        )
        doc_id = upload_res.data['document']['document_id']

        download_res = self.client.get(f'/api/documents/{doc_id}/download/')
        self.assertEqual(download_res.status_code, status.HTTP_200_OK)

        # Verify audit log entry for DOCUMENT_DOWNLOADED
        audit_entry = safe_find_audit("DOCUMENT_DOWNLOADED", self.case_id)
        self.assertIsNotNone(audit_entry)

    def test_10_no_password_or_token_stored_in_mongo(self):
        self.client.force_authenticate(user=self.officer)
        upload_res = self.client.post(
            f'/api/cases/{self.case_id}/documents/',
            {"file": SimpleUploadedFile("EvidenceDoc.pdf", b"Evidence Metadata", content_type="application/pdf"), "document_type": "EVIDENCE_DOCUMENT"},
            format='multipart'
        )
        doc_id = upload_res.data['document']['document_id']
        doc_record = safe_find_document(doc_id)

        self.assertIsNotNone(doc_record)
        self.assertNotIn("password", doc_record)
        self.assertNotIn("password_hash", doc_record)
        self.assertNotIn("token", doc_record)
        self.assertNotIn("otp", doc_record)
