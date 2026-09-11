import secrets
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model
from smtplib import SMTPAuthenticationError, SMTPException

from .models import PasswordResetToken, PasswordResetOTP
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    ForgotPasswordSerializer,
    VerifyOTPSerializer,
    ResetPasswordSerializer,
    UserSerializer
)

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            return Response({
                "success": True,
                "message": "Officer account registered successfully.",
                "user": user_data,
                "token": f"token-{user.id}-mock-jwt-placeholder"
            }, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            user_data = UserSerializer(user).data
            return Response({
                "success": True,
                "message": f"Welcome back, {user.name or user.email}",
                "user": user_data,
                "token": f"token-{user.id}-mock-jwt-placeholder"
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        print("\n--- [CASEVAULT DIAGNOSTIC] Forgot Password Request Received ---")
        raw_email = request.data.get('email')
        email_present = bool(raw_email and str(raw_email).strip())
        print(f"-> email field present: {'yes' if email_present else 'no'}")

        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            print("-> email format valid: no")
            print("-> registered account found: no")
            print("-> SMTP send attempted: no")
            print("-> final result: HTTP 400 Bad Request (Validation Error)")
            print("----------------------------------------------------------------\n")
            return Response({
                "success": False,
                "error_type": "ValidationError",
                "message": "Please enter a valid registered email address.",
                "details": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        print("-> email format valid: yes")
        clean_email = serializer.validated_data['email'].lower().strip()

        # Retrieve existing user
        user = User.objects.filter(email=clean_email).first()
        if not user:
            print("-> registered account found: no")
            print("-> SMTP send attempted: no")
            print("-> final result: HTTP 400 Bad Request (Officer Account Not Found)")
            print("----------------------------------------------------------------\n")
            return Response({
                "success": False,
                "message": "Officer account with this email not found."
            }, status=status.HTTP_400_BAD_REQUEST)

        print("-> registered account found: yes")

        # 60-second resend cooldown check
        last_otp = PasswordResetOTP.objects.filter(email=clean_email).order_by('-created_at').first()
        if last_otp and (timezone.now() - last_otp.created_at).total_seconds() < 60:
            remaining_seconds = int(60 - (timezone.now() - last_otp.created_at).total_seconds())
            print(f"-> SMTP send attempted: no (cooldown active: {remaining_seconds}s)")
            print("-> final result: HTTP 400 Bad Request (Cooldown Active)")
            print("----------------------------------------------------------------\n")
            return Response({
                "success": False,
                "error_type": "CooldownActive",
                "message": f"Please wait {remaining_seconds} seconds before requesting another OTP."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Invalidate existing active OTPs for this email
        PasswordResetOTP.objects.filter(email=clean_email, is_used=False).update(is_used=True)

        # Generate cryptographically secure 6-digit OTP
        otp_code = str(secrets.randbelow(900000) + 100000)
        otp_hash = PasswordResetOTP.hash_otp(otp_code)

        PasswordResetOTP.objects.create(
            user=user,
            email=clean_email,
            otp_hash=otp_hash,
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        subject = "CASEVAULT Password Reset OTP"
        message = (
            f"Your CASEVAULT password reset OTP is: {otp_code}\n\n"
            f"This OTP will expire in 10 minutes.\n\n"
            f"If you did not request this password reset, please ignore this email.\n\n"
            f"CASEVAULT Security"
        )

        # Attempt actual Gmail SMTP email delivery
        print("-> SMTP send attempted: yes")
        try:
            sent_count = send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                recipient_list=[clean_email],
                fail_silently=False,
            )

            if sent_count > 0:
                print("-> final result: HTTP 200 OK (OTP Email Accepted by Gmail SMTP)")
                print("----------------------------------------------------------------\n")
                return Response({
                    "success": True,
                    "message": "OTP sent successfully."
                }, status=status.HTTP_200_OK)
            else:
                print("-> final result: HTTP 400 Bad Request (SMTP returned 0 sent)")
                print("----------------------------------------------------------------\n")
                return Response({
                    "success": False,
                    "error_type": "SMTPDeliveryFailed",
                    "message": "Unable to send OTP. Please try again later."
                }, status=status.HTTP_400_BAD_REQUEST)

        except SMTPAuthenticationError as e:
            print(f"-> final result: HTTP 400 Bad Request (SMTP Auth Error: Code {e.smtp_code})")
            print("----------------------------------------------------------------\n")
            return Response({
                "success": False,
                "error_type": "SMTPAuthenticationError",
                "message": f"Gmail SMTP authentication failed (Code {e.smtp_code}). Please verify Gmail App Password.",
                "details": str(e.smtp_error)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"-> final result: HTTP 400 Bad Request (SMTP Error: {type(e).__name__})")
            print("----------------------------------------------------------------\n")
            return Response({
                "success": False,
                "error_type": type(e).__name__,
                "message": f"SMTP delivery error: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "success": False,
                "message": "Please enter both email and a 6-digit OTP."
            }, status=status.HTTP_400_BAD_REQUEST)

        clean_email = serializer.validated_data['email'].lower().strip()
        raw_otp = serializer.validated_data['otp'].strip()

        otp_record = PasswordResetOTP.objects.filter(email=clean_email, is_used=False).order_by('-created_at').first()
        if not otp_record:
            return Response({
                "success": False,
                "message": "No password reset OTP requested for this email."
            }, status=status.HTTP_400_BAD_REQUEST)

        is_valid, message = otp_record.verify_otp(raw_otp)
        if is_valid:
            return Response({
                "success": True,
                "message": "OTP verified successfully."
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "message": message
            }, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            err = serializer.errors.get('confirm_password', [None])[0] or serializer.errors.get('password', [None])[0] or "Password reset validation failed."
            return Response({
                "success": False,
                "message": err
            }, status=status.HTTP_400_BAD_REQUEST)

        clean_password = serializer.validated_data['clean_password']
        clean_email = (serializer.validated_data.get('email') or '').lower().strip()
        raw_otp = (serializer.validated_data.get('otp') or '').strip()
        raw_token = (serializer.validated_data.get('token') or '').strip()

        user = None
        target_otp_record = None

        if clean_email and raw_otp:
            target_otp_record = PasswordResetOTP.objects.filter(email=clean_email, is_used=False, is_verified=True).order_by('-created_at').first()
            if not target_otp_record:
                # Try verifying directly
                target_otp_record = PasswordResetOTP.objects.filter(email=clean_email, is_used=False).order_by('-created_at').first()
                if target_otp_record:
                    ok, msg = target_otp_record.verify_otp(raw_otp)
                    if not ok:
                        return Response({"success": False, "message": msg}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({"success": False, "message": "No verified OTP found for this email."}, status=status.HTTP_400_BAD_REQUEST)

            user = target_otp_record.user

        elif raw_token:
            reset_token_obj = PasswordResetToken.objects.filter(token=raw_token).first()
            if not reset_token_obj:
                return Response({"success": False, "message": "Invalid reset token."}, status=status.HTTP_400_BAD_REQUEST)
            if reset_token_obj.is_used:
                return Response({"success": False, "message": "This reset token has already been used."}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.now() > reset_token_obj.expires_at:
                return Response({"success": False, "message": "Reset token has expired."}, status=status.HTTP_400_BAD_REQUEST)
            
            user = reset_token_obj.user
            reset_token_obj.is_used = True
            reset_token_obj.save()

        if not user:
            return Response({
                "success": False,
                "message": "Unable to verify password reset request."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update password securely using Django's set_password (PBKDF2 SHA-256)
        user.set_password(clean_password)
        user.save()

        if target_otp_record:
            target_otp_record.is_used = True
            target_otp_record.save(update_fields=['is_used'])

        return Response({
            "success": True,
            "message": "Password updated successfully. You can now log in."
        }, status=status.HTTP_200_OK)


class TestEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        recipient = request.data.get('recipient') or settings.EMAIL_HOST_USER
        if not recipient or 'YOUR_GMAIL' in recipient:
            return Response({
                "success": False,
                "error": "EMAIL_HOST_USER placeholder must be updated with a valid Gmail address in .env before sending email."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            send_mail(
                subject='[CASEVAULT Test] Gmail SMTP Diagnostic Check',
                message='This is an automated test email from the CASEVAULT Django Backend.',
                from_email=settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                recipient_list=[recipient],
                fail_silently=False,
            )
            return Response({
                "success": True,
                "message": f"Test email dispatched successfully to {recipient}.",
                "smtp_host": settings.EMAIL_HOST,
                "smtp_port": settings.EMAIL_PORT,
                "sender": settings.EMAIL_HOST_USER
            }, status=status.HTTP_200_OK)
        except SMTPAuthenticationError as e:
            return Response({
                "success": False,
                "error_type": "SMTPAuthenticationError",
                "message": f"SMTP Authentication failed (Code {e.smtp_code}). Please verify Gmail App Password in .env.",
                "details": str(e.smtp_error)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "success": False,
                "error_type": type(e).__name__,
                "message": f"SMTP delivery error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
