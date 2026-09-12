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
from authentication.evidence_views import FALLBACK_EVIDENCE, FALLBACK_CUSTODY_LOGS

User = get_user_model()


def safe_count_evidence(case_id=None):
    try:
        db = get_mongo_db()
        query = {"case_id": case_id} if case_id else {}
        return db.evidence.count_documents(query)
    except Exception:
        if case_id:
            return len([e for e in FALLBACK_EVIDENCE if e.get("case_id") == case_id])
        return len(FALLBACK_EVIDENCE)


def safe_find_evidence(evidence_id):
    try:
        db = get_mongo_db()
        doc = db.evidence.find_one({"evidence_id": evidence_id})
        if doc:
            return doc
    except Exception:
        pass
    return next((e for e in FALLBACK_EVIDENCE if e.get("evidence_id") == evidence_id or e.get("id") == evidence_id), None)


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


class EvidenceManagementAPIContractTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()
        FALLBACK_CASE_DOCUMENTS.clear()
        FALLBACK_EVIDENCE.clear()
        FALLBACK_CUSTODY_LOGS.clear()

        # Seed primary investigating officer
        self.officer1 = User.objects.create(
            username="investigator.primary",
            email="primary@police.gov.in",
            name="SI Shivam Kumar Singh",
            officer_id="OFF-7701",
            role="police_officer",
            rank="SI",
            police_station="Siliguri Police Station",
            status="Active"
        )
        self.officer1.set_password("OfficerPass@123")
        self.officer1.save()

        # Seed secondary receiving officer
        self.officer2 = User.objects.create(
            username="forensic.expert",
            email="forensic@police.gov.in",
            name="Insp. Karan Kumar",
            officer_id="OFF-8802",
            role="senior_officer",
            rank="Inspector",
            police_station="Cyber Division",
            status="Active"
        )
        self.officer2.set_password("OfficerPass@123")
        self.officer2.save()

        # Seed disabled officer
        self.disabled_officer = User.objects.create(
            username="disabled.officer",
            email="disabled@police.gov.in",
            name="Ex-Officer Ramesh",
            officer_id="OFF-9999",
            role="police_officer",
            rank="Constable",
            status="Disabled"
        )
        self.disabled_officer.set_password("OfficerPass@123")
        self.disabled_officer.save()

        # Clean Mongo collections before test execution if server online
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.case_documents.delete_many({})
            db.evidence.delete_many({})
            db.chain_of_custody.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

        # Create a valid case for evidence testing
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post('/api/cases/', {
            "title": "Bank Raid Financial Fraud",
            "case_type": "Cybercrime",
            "police_station": "Siliguri Police Station",
            "priority": "HIGH"
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.case_id = create_res.data['case']['case_id']

    def tearDown(self):
        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()
        FALLBACK_CASE_DOCUMENTS.clear()
        FALLBACK_EVIDENCE.clear()
        FALLBACK_CUSTODY_LOGS.clear()
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.case_documents.delete_many({})
            db.evidence.delete_many({})
            db.chain_of_custody.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

    def test_01_create_single_evidence_item_success(self):
        self.client.force_authenticate(user=self.officer1)
        res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {
                "title": "Seized Encrypted Hard Drive",
                "evidence_type": "DIGITAL_MEDIA",
                "description": "1TB Western Digital SATA Hard Drive seized from office premises.",
                "source": "Office Raid - Desk 4"
            },
            format='json'
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))
        evd_data = res.data['evidence']

        self.assertTrue(evd_data['evidence_id'].startswith("EVD-WB-2026-"))
        self.assertEqual(evd_data['case_id'], self.case_id)
        self.assertEqual(evd_data['evidence_type'], "DIGITAL_MEDIA")
        self.assertEqual(evd_data['created_by_officer_id'], "OFF-7701")
        self.assertEqual(evd_data['status'], "IN_CUSTODY")

        # Verify exactly one record in storage
        self.assertEqual(safe_count_evidence(self.case_id), 1)

        # Verify audit log recorded for EVIDENCE_CREATED
        audit_entry = safe_find_audit("EVIDENCE_CREATED", self.case_id)
        self.assertIsNotNone(audit_entry)

    def test_02_unauthenticated_evidence_creation_rejected_401(self):
        self.client.logout()
        res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Unauthenticated Evidence", "evidence_type": "PHYSICAL_ITEM"},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_03_invalid_evidence_type_rejected_400(self):
        self.client.force_authenticate(user=self.officer1)
        res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Test Item", "evidence_type": "INVALID_CUSTOM_EVIDENCE"},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get('code'), "INVALID_EVIDENCE_TYPE")

    def test_04_list_case_evidence(self):
        self.client.force_authenticate(user=self.officer1)
        # Create evidence 1
        self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Mobile Phone", "evidence_type": "DIGITAL_MEDIA"},
            format='json'
        )
        # Create evidence 2
        self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Seizure Memo Document", "evidence_type": "DOCUMENT"},
            format='json'
        )

        res = self.client.get(f'/api/cases/{self.case_id}/evidence/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertEqual(len(res.data.get('evidence')), 2)

    def test_05_get_single_evidence_by_id(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "CCTV Footage SD Card", "evidence_type": "VIDEO"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        get_res = self.client.get(f'/api/evidence/{evd_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data.get('success'))
        self.assertEqual(get_res.data['evidence']['title'], "CCTV Footage SD Card")

    def test_06_update_permitted_evidence_metadata(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Draft Evidence Label", "evidence_type": "PHYSICAL_ITEM"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        patch_res = self.client.patch(f'/api/evidence/{evd_id}/', {
            "title": "Finalized Seized Knife",
            "description": "Recovered weapon from crime scene."
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['evidence']['title'], "Finalized Seized Knife")

    def test_07_transfer_evidence_custody(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Forensic Hard Drive", "evidence_type": "DIGITAL_MEDIA"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        transfer_res = self.client.post(f'/api/evidence/{evd_id}/transfer/', {
            "to_officer_id": "OFF-8802",
            "remarks": "Transferred for deep forensic analysis."
        }, format='json')

        self.assertEqual(transfer_res.status_code, status.HTTP_200_OK)
        self.assertTrue(transfer_res.data.get('success'))
        self.assertEqual(transfer_res.data['evidence']['status'], "TRANSFERRED")
        self.assertEqual(transfer_res.data['evidence']['current_custodian_officer_id'], "OFF-8802")

        # Verify audit log for EVIDENCE_TRANSFERRED
        audit_entry = safe_find_audit("EVIDENCE_TRANSFERRED", self.case_id)
        self.assertIsNotNone(audit_entry)

    def test_08_transfer_to_disabled_officer_rejected(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Restricted Sample", "evidence_type": "PHYSICAL_ITEM"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        transfer_res = self.client.post(f'/api/evidence/{evd_id}/transfer/', {
            "to_officer_id": "OFF-9999",
            "remarks": "Invalid transfer attempt to deactivated user."
        }, format='json')
        self.assertEqual(transfer_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(transfer_res.data.get('code'), "UNAUTHORIZED_TARGET_OFFICER")

    def test_09_accept_and_release_custody(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Seized Vehicle Key", "evidence_type": "PHYSICAL_ITEM"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        # Officer 2 accepts custody
        self.client.force_authenticate(user=self.officer2)
        accept_res = self.client.post(f'/api/evidence/{evd_id}/accept/', {
            "remarks": "Received in secure forensic locker."
        }, format='json')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data['evidence']['status'], "IN_CUSTODY")

        # Officer 2 releases evidence
        release_res = self.client.post(f'/api/evidence/{evd_id}/release/', {
            "remarks": "Released to court registry."
        }, format='json')
        self.assertEqual(release_res.status_code, status.HTTP_200_OK)
        self.assertEqual(release_res.data['evidence']['status'], "RELEASED")

    def test_10_custody_history_chronological_append_only(self):
        self.client.force_authenticate(user=self.officer1)
        create_res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Trace Forensic Swab", "evidence_type": "FORENSIC"},
            format='json'
        )
        evd_id = create_res.data['evidence']['evidence_id']

        # Transfer
        self.client.post(f'/api/evidence/{evd_id}/transfer/', {"to_officer_id": "OFF-8802"}, format='json')

        # Accept
        self.client.force_authenticate(user=self.officer2)
        self.client.post(f'/api/evidence/{evd_id}/accept/', {}, format='json')

        custody_res = self.client.get(f'/api/evidence/{evd_id}/custody/')
        self.assertEqual(custody_res.status_code, status.HTTP_200_OK)
        custody_logs = custody_res.data['custody']

        # Verify chronological order & action chain
        self.assertGreaterEqual(len(custody_logs), 3)
        self.assertEqual(custody_logs[0]['action'], "CREATED")
        self.assertEqual(custody_logs[1]['action'], "TRANSFERRED")
        self.assertEqual(custody_logs[2]['action'], "ACCEPTED")

    def test_11_sha256_generated_from_actual_file_bytes(self):
        self.client.force_authenticate(user=self.officer1)
        file_bytes = b"PHYSICAL DIGITAL MEDIA RECOVERED DATA"
        expected_sha256 = hashlib.sha256(file_bytes).hexdigest()

        uploaded_file = SimpleUploadedFile("Media.iso", file_bytes, content_type="application/octet-stream")
        res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {
                "file": uploaded_file,
                "title": "Digital Evidence Disk Image",
                "evidence_type": "DIGITAL_MEDIA"
            },
            format='multipart'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['evidence']['sha256'], expected_sha256)

    def test_12_no_passwords_or_tokens_stored_in_evidence_data(self):
        self.client.force_authenticate(user=self.officer1)
        res = self.client.post(
            f'/api/cases/{self.case_id}/evidence/',
            {"title": "Clean Record Item", "evidence_type": "DOCUMENT"},
            format='json'
        )
        evd_id = res.data['evidence']['evidence_id']
        evd_doc = safe_find_evidence(evd_id)

        self.assertIsNotNone(evd_doc)
        self.assertNotIn("password", evd_doc)
        self.assertNotIn("password_hash", evd_doc)
        self.assertNotIn("token", evd_doc)
        self.assertNotIn("otp", evd_doc)
