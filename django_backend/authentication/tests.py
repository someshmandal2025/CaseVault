from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from authentication.models import PasswordResetOTP

User = get_user_model()


class OTPPasswordResetTestSuite(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register'
        self.login_url = '/api/auth/login'
        self.forgot_url = '/api/auth/forgot-password'
        self.verify_url = '/api/auth/verify-reset-otp'
        self.reset_url = '/api/auth/reset-password'

        # Seed test user
        self.test_user = User.objects.create(
            username="r.kumar",
            email="r.kumar@police.gov.in",
            name="Inspector Rajesh Kumar",
            officer_id="POL-8842"
        )
        self.test_user.set_password("OldPassword@123")
        self.test_user.save()

    def test_1_forgot_password_generates_otp_and_sends_email(self):
        response = self.client.post(self.forgot_url, {
            "email": "r.kumar@police.gov.in"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(response.data.get('message'), "OTP sent successfully.")
        
        # Verify OTP record in DB
        otp_record = PasswordResetOTP.objects.filter(email="r.kumar@police.gov.in", is_used=False).first()
        self.assertIsNotNone(otp_record)
        # Ensure OTP is NOT in the response JSON
        self.assertNotIn('otp', response.data)

    def test_2_unknown_email(self):
        response = self.client.post(self.forgot_url, {
            "email": "unknown.officer@police.gov.in"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('success'))
        self.assertEqual(response.data.get('message'), "Officer account with this email not found.")

    def test_3_cooldown_60_seconds(self):
        # First request
        self.client.post(self.forgot_url, {"email": "r.kumar@police.gov.in"}, format='json')
        # Immediate second request must trigger cooldown error
        res_cooldown = self.client.post(self.forgot_url, {"email": "r.kumar@police.gov.in"}, format='json')
        self.assertEqual(res_cooldown.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Please wait", res_cooldown.data.get('message', ''))

    def test_4_wrong_otp(self):
        otp_hash = PasswordResetOTP.hash_otp("123456")
        PasswordResetOTP.objects.create(
            user=self.test_user,
            email=self.test_user.email,
            otp_hash=otp_hash,
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        res = self.client.post(self.verify_url, {
            "email": self.test_user.email,
            "otp": "999999"  # Wrong OTP
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data.get('success'))
        self.assertIn("Invalid OTP", res.data.get('message', ''))

    def test_5_max_5_attempts_exceeded(self):
        otp_hash = PasswordResetOTP.hash_otp("123456")
        otp_record = PasswordResetOTP.objects.create(
            user=self.test_user,
            email=self.test_user.email,
            otp_hash=otp_hash,
            expires_at=timezone.now() + timedelta(minutes=10),
            attempt_count=5  # Already 5 failed attempts
        )

        res = self.client.post(self.verify_url, {
            "email": self.test_user.email,
            "otp": "123456"
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeded", res.data.get('message', ''))

    def test_6_expired_otp(self):
        otp_hash = PasswordResetOTP.hash_otp("123456")
        PasswordResetOTP.objects.create(
            user=self.test_user,
            email=self.test_user.email,
            otp_hash=otp_hash,
            expires_at=timezone.now() - timedelta(minutes=1)  # Expired
        )

        res = self.client.post(self.verify_url, {
            "email": self.test_user.email,
            "otp": "123456"
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", res.data.get('message', ''))

    def test_7_successful_otp_verify_and_password_reset(self):
        raw_otp = "849201"
        otp_hash = PasswordResetOTP.hash_otp(raw_otp)
        PasswordResetOTP.objects.create(
            user=self.test_user,
            email=self.test_user.email,
            otp_hash=otp_hash,
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        # 1. Verify OTP
        verify_res = self.client.post(self.verify_url, {
            "email": self.test_user.email,
            "otp": raw_otp
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        # 2. Reset Password
        reset_res = self.client.post(self.reset_url, {
            "email": self.test_user.email,
            "otp": raw_otp,
            "password": "NewSecurePassword@2026",
            "confirm_password": "NewSecurePassword@2026"
        }, format='json')
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)

        # 3. Old password fails
        old_login = self.client.post(self.login_url, {
            "email": self.test_user.email,
            "password": "OldPassword@123"
        }, format='json')
        self.assertEqual(old_login.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. New password succeeds
        new_login = self.client.post(self.login_url, {
            "email": self.test_user.email,
            "password": "NewSecurePassword@2026"
        }, format='json')
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertTrue(new_login.data.get('success'))

    def test_8_reused_otp(self):
        raw_otp = "654321"
        otp_hash = PasswordResetOTP.hash_otp(raw_otp)
        otp_rec = PasswordResetOTP.objects.create(
            user=self.test_user,
            email=self.test_user.email,
            otp_hash=otp_hash,
            expires_at=timezone.now() + timedelta(minutes=10),
            is_used=True  # Already used
        )

        res = self.client.post(self.verify_url, {
            "email": self.test_user.email,
            "otp": raw_otp
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_9_valid_category_and_rank_combinations(self):
        res1 = self.client.post('/api/register/', {
            "name": "Officer Sub-Inspector",
            "email": "si.officer@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "POL-9901",
            "role": "police_officer",
            "rank": "SI"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        res2 = self.client.post('/api/register/', {
            "name": "Senior Inspector",
            "email": "insp.senior@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "POL-9902",
            "role": "senior_officer",
            "rank": "Inspector"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

        res3 = self.client.post('/api/register/', {
            "name": "Public Prosecutor",
            "email": "prosecutor@legal.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "LEG-9903",
            "role": "legal_officer",
            "rank": "Public Prosecutor"
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

        res4 = self.client.post('/api/register/', {
            "name": "System Admin",
            "email": "sysadmin@casevault.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "ADM-9904",
            "role": "administrator",
            "rank": "System Administrator"
        }, format='json')
        self.assertEqual(res4.status_code, status.HTTP_201_CREATED)

        res5 = self.client.post('/api/register/', {
            "name": "IPS Officer",
            "email": "ips.officer@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "IPS-9905",
            "role": "senior_officer",
            "rank": "IPS"
        }, format='json')
        self.assertEqual(res5.status_code, status.HTTP_201_CREATED)

    def test_10_invalid_category_and_rank_combinations(self):
        # OFFICER + DGP -> INVALID
        res1 = self.client.post('/api/register/', {
            "name": "Invalid Officer",
            "email": "invalid1@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "POL-ERR1",
            "role": "police_officer",
            "rank": "DGP"
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("rank", res1.data.get('errors', {}))

        # OFFICER + Inspector -> INVALID
        res2 = self.client.post('/api/register/', {
            "name": "Invalid Officer 2",
            "email": "invalid2@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "POL-ERR2",
            "role": "police_officer",
            "rank": "Inspector"
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # LEGAL OFFICER + SI -> INVALID
        res3 = self.client.post('/api/register/', {
            "name": "Invalid Legal",
            "email": "invalid3@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "LEG-ERR3",
            "role": "legal_officer",
            "rank": "SI"
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # SENIOR OFFICER + Constable -> INVALID
        res4 = self.client.post('/api/register/', {
            "name": "Invalid Senior",
            "email": "invalid4@police.gov.in",
            "password": "SecurePassword@123",
            "confirm_password": "SecurePassword@123",
            "officer_id": "SEN-ERR4",
            "role": "senior_officer",
            "rank": "Constable"
        }, format='json')
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)
