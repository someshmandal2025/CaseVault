from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from casevault_backend.mongo import get_mongo_db
from authentication.cases_views import FALLBACK_CASES, FALLBACK_AUDIT_LOGS

User = get_user_model()


def safe_count_cases():
    try:
        db = get_mongo_db()
        return db.cases.count_documents({})
    except Exception:
        return len(FALLBACK_CASES)


def safe_find_case(case_id):
    try:
        db = get_mongo_db()
        doc = db.cases.find_one({"case_id": case_id})
        if doc:
            return doc
    except Exception:
        pass
    return next((c for c in FALLBACK_CASES if c.get("case_id") == case_id), None)


def safe_find_audit(action, case_id):
    try:
        db = get_mongo_db()
        doc = db.audit_logs.find_one({"action": action, "case_id": case_id})
        if doc:
            return doc
    except Exception:
        pass
    return next((a for a in FALLBACK_AUDIT_LOGS if a.get("action") == action and a.get("case_id") == case_id), None)


class CaseManagementAPIContractTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Clear fallback memory store for reliable test isolation
        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()

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

        # Clean MongoDB cases and audit_logs collections before tests if Mongo is up
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

    def tearDown(self):
        FALLBACK_CASES.clear()
        FALLBACK_AUDIT_LOGS.clear()
        try:
            db = get_mongo_db()
            db.cases.delete_many({})
            db.audit_logs.delete_many({})
        except Exception:
            pass

    def test_01_get_cases_with_zero_records(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get('/api/cases/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertEqual(res.data.get('cases'), [])

        # Ensure NO case was automatically created by calling GET /api/cases/
        self.assertEqual(safe_count_cases(), 0)

    def test_02_unauthenticated_request_rejected(self):
        res = self.client.get('/api/cases/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(res.data.get('success'))

    def test_03_create_single_case_success(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post('/api/cases/', {
            "title": "Cyber Fraud Investigation",
            "case_type": "Cybercrime",
            "description": "Unidentified online phishing fraud reported at Siliguri.",
            "police_station": "Siliguri Police Station",
            "priority": "HIGH",
            "status": "OPEN"
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))
        self.assertIn('case', res.data)
        case_data = res.data['case']
        self.assertTrue(case_data['case_id'].startswith("CASE-WB-2026-"))
        self.assertEqual(case_data['created_by_officer_id'], "OFF-7701")
        self.assertEqual(case_data['status'], "OPEN")

        # Verify storage
        self.assertEqual(safe_count_cases(), 1)
        mongo_doc = safe_find_case(case_data['case_id'])
        self.assertIsNotNone(mongo_doc)
        self.assertNotIn('password', mongo_doc)
        self.assertNotIn('token', mongo_doc)

        # Verify Audit Log entry for CASE_CREATED
        audit_doc = safe_find_audit("CASE_CREATED", case_data['case_id'])
        self.assertIsNotNone(audit_doc)
        self.assertEqual(audit_doc['actor_officer_id'], "OFF-7701")

    def test_04_get_single_case_by_id(self):
        self.client.force_authenticate(user=self.officer)
        create_res = self.client.post('/api/cases/', {
            "title": "Property Theft FIR",
            "case_type": "Theft",
            "description": "Property theft at Market Complex.",
            "priority": "MEDIUM"
        }, format='json')
        case_id = create_res.data['case']['case_id']

        get_res = self.client.get(f'/api/cases/{case_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertTrue(get_res.data.get('success'))
        self.assertEqual(get_res.data['case']['title'], "Property Theft FIR")

        # Verify Audit Log entry for CASE_VIEWED
        audit_doc = safe_find_audit("CASE_VIEWED", case_id)
        self.assertIsNotNone(audit_doc)

    def test_05_get_nonexistent_case_returns_404(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get('/api/cases/CASE-INVALID-9999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.data.get('code'), "CASE_NOT_FOUND")

    def test_06_update_case_and_status_change(self):
        self.client.force_authenticate(user=self.officer)
        create_res = self.client.post('/api/cases/', {
            "title": "Missing Person FIR",
            "status": "OPEN"
        }, format='json')
        case_id = create_res.data['case']['case_id']

        # Update status to UNDER_INVESTIGATION
        patch_res = self.client.patch(f'/api/cases/{case_id}/', {
            "status": "UNDER_INVESTIGATION",
            "description": "Investigating team deployed."
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['case']['status'], "UNDER_INVESTIGATION")

        # Verify Audit Log entry for CASE_STATUS_CHANGED
        audit_doc = safe_find_audit("CASE_STATUS_CHANGED", case_id)
        self.assertIsNotNone(audit_doc)

    def test_07_invalid_status_rejected_400(self):
        self.client.force_authenticate(user=self.officer)
        create_res = self.client.post('/api/cases/', {
            "title": "Test Status Case",
            "status": "INVALID_STATUS_STRING"
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(create_res.data.get('code'), "INVALID_STATUS")

    def test_08_search_and_filter_cases(self):
        self.client.force_authenticate(user=self.officer)
        # Create case 1
        self.client.post('/api/cases/', {
            "title": "Cyber Robbery Incident",
            "case_type": "Cybercrime",
            "police_station": "Siliguri Police Station",
            "status": "OPEN"
        }, format='json')

        # Create case 2
        self.client.post('/api/cases/', {
            "title": "Narcotics Smuggling",
            "case_type": "Narcotics",
            "police_station": "Matigara Police Station",
            "status": "CLOSED"
        }, format='json')

        # Search for Cyber
        search_res = self.client.get('/api/cases/?search=Cyber')
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(search_res.data['cases']), 1)
        self.assertEqual(search_res.data['cases'][0]['title'], "Cyber Robbery Incident")

        # Filter by status CLOSED
        filter_res = self.client.get('/api/cases/?status=CLOSED')
        self.assertEqual(filter_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filter_res.data['cases']), 1)
        self.assertEqual(filter_res.data['cases'][0]['case_type'], "Narcotics")
