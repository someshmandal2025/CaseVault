import uuid
import hashlib
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.conf import settings

class User(AbstractUser):
    email = models.EmailField(unique=True)
    officer_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    name = models.CharField(max_length=150, blank=True)
    rank = models.CharField(max_length=100, default='Police Officer')
    police_station = models.CharField(max_length=150, default='Siliguri Police Station')
    district = models.CharField(max_length=100, default='Darjeeling')
    role = models.CharField(max_length=50, default='police_officer')
    role_label = models.CharField(max_length=100, default='Police Officer')
    status = models.CharField(max_length=20, default='Active')
    avatar = models.TextField(default='👮', blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    def __str__(self):
        return f"{self.name or self.email} ({self.officer_id or 'No ID'})"


class PasswordResetToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = uuid.uuid4().hex + uuid.uuid4().hex  # Cryptographically secure 64-character token
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=20)  # 20-minute expiration
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at

    def __str__(self):
        return f"Reset Token for {self.user.email} (used={self.is_used}, valid={self.is_valid})"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otp_resets')
    email = models.EmailField(db_index=True)
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_sent_at = models.DateTimeField(auto_now=True)
    attempt_count = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    @staticmethod
    def hash_otp(otp_str):
        return hashlib.sha256(str(otp_str).strip().encode('utf-8')).hexdigest()

    def verify_otp(self, raw_otp):
        if self.is_used:
            return False, "This OTP has already been used."
        if timezone.now() > self.expires_at:
            return False, "OTP has expired. Please request a new one."
        if self.attempt_count >= 5:
            return False, "Maximum verification attempts exceeded (5/5). Please request a new OTP."

        self.attempt_count += 1
        self.save(update_fields=['attempt_count'])

        if self.otp_hash == self.hash_otp(raw_otp):
            self.is_verified = True
            self.save(update_fields=['is_verified'])
            return True, "OTP verified successfully."
        else:
            remaining = 5 - self.attempt_count
            if remaining <= 0:
                return False, "Maximum verification attempts exceeded (5/5). Please request a new OTP."
            return False, f"Invalid OTP. {remaining} attempt(s) remaining."

    def __str__(self):
        return f"OTP Reset for {self.email} (verified={self.is_verified}, attempts={self.attempt_count})"
