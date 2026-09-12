from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from authentication.models import PasswordResetOTP

User = get_user_model()


class APIContractTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed test user (Officer)
        self.officer = User.objects.create(
            username="r.kumar",
            email="r.kumar@police.gov.in",
            name="Inspector Rajesh Kumar",
            officer_id="POL-8842",
            role="senior_officer",
            rank="Inspector",
            police_station="Central Station",
            status="Active"
        )
        self.officer.set_password("OldPassword@123")
        self.officer.save()

        # Seed test Admin user
        self.admin_user = User.objects.create(
            username="admin.user",
            email="admin@casevault.gov.in",
            name="System Admin",
            officer_id="ADM-001",
            role="administrator",
            rank="System Administrator",
            police_station="HQ",
            status="Active",
            is_staff=True
        )
        self.admin_user.set_password("AdminPassword@123")
        self.admin_user.save()

    def test_01_login_success(self):
        res = self.client.post('/api/login/', {
            "identifier": "POL-8842",
            "password": "OldPassword@123"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertIn('user', res.data)
        self.assertNotIn('password', res.data['user'])

    def test_01b_login_invalid_credentials(self):
        res = self.client.post('/api/login/', {
            "identifier": "POL-8842",
            "password": "WrongPassword"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(res.data.get('success'))

    def test_01c_login_disabled_account(self):
        self.officer.status = 'Disabled'
        self.officer.is_active = False
        self.officer.save()

        res = self.client.post('/api/login/', {
            "identifier": "POL-8842",
            "password": "OldPassword@123"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(res.data.get('success'))

    def test_02_registration_success(self):
        res = self.client.post('/api/register/', {
            "officer_id": "OFF-101",
            "badge_number": "BADGE-101",
            "full_name": "New Officer",
            "email": "new.officer@police.gov.in",
            "category": "OFFICER",
            "rank": "SI",
            "police_station": "East Station",
            "password": "SecurePassword@123"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))
        self.assertIn('user', res.data)

    def test_03_duplicate_registration_409(self):
        # Duplicate Officer ID
        res1 = self.client.post('/api/register/', {
            "officer_id": "POL-8842",
            "full_name": "Duplicate ID Officer",
            "email": "diff.email@police.gov.in",
            "category": "OFFICER",
            "rank": "SI",
            "police_station": "Station",
            "password": "SecurePassword@123"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res1.data.get('code'), 'DUPLICATE_OFFICER_ID')

        # Duplicate Email
        res2 = self.client.post('/api/register/', {
            "officer_id": "OFF-UNIQUE",
            "full_name": "Duplicate Email Officer",
            "email": "r.kumar@police.gov.in",
            "category": "OFFICER",
            "rank": "SI",
            "police_station": "Station",
            "password": "SecurePassword@123"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data.get('code'), 'DUPLICATE_EMAIL')

    def test_04_current_session(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertEqual(res.data['user']['email'], self.officer.email)

    def test_04b_current_session_unauthenticated(self):
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_05_logout(self):
        res = self.client.post('/api/logout/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))

    def test_06_admin_list_users(self):
        # Authenticated as admin
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertIn('users', res.data)

    def test_06b_admin_list_users_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get('/api/admin/users/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_admin_add_officer(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.post('/api/admin/users/', {
            "officer_id": "OFF-202",
            "full_name": "Admin Added Officer",
            "email": "added.by.admin@police.gov.in",
            "category": "SENIOR_OFFICER",
            "rank": "INSPECTOR",
            "police_station": "HQ",
            "password": "SecurePassword@123"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))

    def test_08_admin_update_officer(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/admin/users/{self.officer.id}/', {
            "full_name": "Updated Name",
            "category": "SENIOR_OFFICER",
            "rank": "INSPECTOR"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))

    def test_09_enable_disable_officer(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.patch(f'/api/admin/users/{self.officer.id}/status/', {
            "status": "disabled"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertEqual(res.data['user']['status'], 'disabled')

    def test_10_invalid_role_rank_400(self):
        res = self.client.post('/api/register/', {
            "officer_id": "OFF-INV",
            "full_name": "Invalid Role Officer",
            "email": "invalid.matrix@police.gov.in",
            "category": "OFFICER",
            "rank": "DGP",  # Invalid for OFFICER
            "police_station": "Station",
            "password": "SecurePassword@123"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data.get('code'), 'INVALID_ROLE_RANK')

    def test_11_forgot_password_and_otp_flow(self):
        # 1. Forgot password
        res1 = self.client.post('/api/auth/forgot-password/', {
            "email": self.officer.email
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        otp_rec = PasswordResetOTP.objects.filter(email=self.officer.email).first()
        self.assertIsNotNone(otp_rec)

        # 2. Verify OTP
        raw_otp = "123456"
        otp_rec.otp_hash = PasswordResetOTP.hash_otp(raw_otp)
        otp_rec.save()

        res2 = self.client.post('/api/auth/verify-otp/', {
            "email": self.officer.email,
            "otp": raw_otp
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # 3. Reset Password
        res3 = self.client.post('/api/auth/reset-password/', {
            "email": self.officer.email,
            "otp": raw_otp,
            "password": "NewSecurePassword@2026",
            "confirm_password": "NewSecurePassword@2026"
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)

