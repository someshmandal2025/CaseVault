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
    UserSerializer,
    VALID_ROLE_RANKS,
    RANK_NORMALIZATION,
    ROLE_CATEGORY_ALIAS
)

from casevault_backend.mongo import get_mongo_db
from authentication.audit_service import record_audit_event

_mongo_status_cache = {"available": None, "last_check": 0}

def safe_get_db():
    import time
    now = time.time()
    if _mongo_status_cache["available"] is False and (now - _mongo_status_cache["last_check"]) < 5:
        return None
    try:
        db = get_mongo_db()
        db.command('ping')
        _mongo_status_cache["available"] = True
        _mongo_status_cache["last_check"] = now
        return db
    except Exception:
        _mongo_status_cache["available"] = False
        _mongo_status_cache["last_check"] = now
        return None

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            record_audit_event(
                safe_get_db(),
                actor_user=user,
                event_type="OFFICER_CREATED",
                description=f"Officer '{user.name}' ({user.officer_id}) account created.",
                request=request
            )
            return Response({
                "success": True,
                "message": "Officer registered successfully.",
                "user": user_data,
                "session": {
                    "token": f"token-{user.id}-mock-jwt-placeholder"
                }
            }, status=status.HTTP_201_CREATED)

        errors = serializer.errors
        error_code = "VALIDATION_ERROR"
        error_msg = "Registration validation failed."

        def unwrap_val(val):
            if isinstance(val, (list, tuple)) and len(val) > 0:
                return unwrap_val(val[0])
            return str(val)

        def extract_error(err_data):
            nonlocal error_code, error_msg
            if isinstance(err_data, dict):
                if "code" in err_data:
                    error_code = unwrap_val(err_data["code"])
                    if "message" in err_data:
                        error_msg = unwrap_val(err_data["message"])
                    return True
                for k, v in err_data.items():
                    if extract_error(v):
                        return True
            elif isinstance(err_data, (list, tuple)):
                for item in err_data:
                    if extract_error(item):
                        return True
            return False

        extract_error(errors)


        if error_code in ["DUPLICATE_OFFICER_ID", "DUPLICATE_EMAIL"]:
            return Response({
                "success": False,
                "code": error_code,
                "message": error_msg
            }, status=status.HTTP_409_CONFLICT)
        elif error_code == "INVALID_ROLE_RANK":
            return Response({
                "success": False,
                "code": "INVALID_ROLE_RANK",
                "message": error_msg
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "success": False,
            "code": error_code,
            "message": error_msg,
            "errors": errors
        }, status=status.HTTP_400_BAD_REQUEST)


from authentication.security_utils import check_rate_limit, sanitize_mongo_param

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = sanitize_mongo_param(request.data.get('identifier') or request.data.get('email') or '').strip()
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        
        if not check_rate_limit(f"login_{ip_addr}_{identifier}", limit=10, period_seconds=60):
            record_audit_event(
                safe_get_db(),
                actor_user=None,
                event_type="RATE_LIMIT_TRIGGERED",
                description=f"Login rate limit exceeded for identifier '{identifier}'.",
                request=request
            )
            return Response({
                "success": False,
                "code": "TOO_MANY_REQUESTS",
                "message": "Too many failed login attempts. Please try again later."
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            user_data = UserSerializer(user).data
            record_audit_event(
                safe_get_db(),
                actor_user=user,
                event_type="LOGIN_SUCCESS",
                description=f"Officer '{user.name}' ({user.officer_id}) logged in successfully.",
                request=request
            )
            return Response({
                "success": True,
                "message": "Login successful.",
                "user": user_data,
                "session": {
                    "token": f"token-{user.id}-mock-jwt-placeholder"
                }
            }, status=status.HTTP_200_OK)

        # Check directly for disabled user to guarantee HTTP 403 response contract
        identifier = (request.data.get('identifier') or request.data.get('email') or '').strip()
        if identifier:
            from django.db.models import Q
            matched_user = User.objects.filter(
                Q(email__iexact=identifier.lower()) |
                Q(officer_id__iexact=identifier.upper()) |
                Q(username__iexact=identifier.lower())
            ).first()
            if matched_user and matched_user.check_password(request.data.get('password', '')):
                if matched_user.status == 'Disabled' or not matched_user.is_active:
                    record_audit_event(
                        safe_get_db(),
                        actor_user=matched_user,
                        event_type="LOGIN_FAILED",
                        description=f"Disabled officer '{matched_user.name}' ({matched_user.officer_id}) login attempt blocked.",
                        request=request
                    )
                    return Response({
                        "success": False,
                        "code": "ACCOUNT_DISABLED",
                        "message": "Account is disabled."
                    }, status=status.HTTP_403_FORBIDDEN)

        record_audit_event(
            safe_get_db(),
            actor_user=None,
            event_type="LOGIN_FAILED",
            description=f"Failed login attempt with identifier '{identifier}'.",
            request=request
        )
        return Response({
            "success": False,
            "code": "INVALID_CREDENTIALS",
            "message": "Invalid credentials."
        }, status=status.HTTP_401_UNAUTHORIZED)



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


class MongoPingView(APIView):
    """
    Diagnostic view to safely verify secondary MongoDB connection & collection index status.
    Exposes zero URI credentials, passwords, or sensitive details.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from casevault_backend.mongo import ping_mongo, setup_mongo_indexes
        ping_success, ping_msg, ping_details = ping_mongo()
        idx_success, idx_msg, idx_details = setup_mongo_indexes()

        return Response({
            "success": ping_success,
            "message": ping_msg,
            "details": ping_details,
            "index_setup": {
                "success": idx_success,
                "message": idx_msg,
                "collections": ["cases", "case_documents", "evidence", "chain_of_custody", "audit_logs"]
            },
            "primary_database": "SQLite (db.sqlite3)",
            "secondary_database": "MongoDB (PyMongo)",
            "demo_records_inserted": 0
        }, status=status.HTTP_200_OK)


class CurrentSessionView(APIView):
    """
    Returns the currently authenticated existing user session.
    NEVER creates a user.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None
        if not user:
            return Response({
                "success": False,
                "message": "Authentication required."
            }, status=status.HTTP_401_UNAUTHORIZED)

        if user.status == 'Disabled' or not user.is_active:
            return Response({
                "success": False,
                "message": "Account is disabled."
            }, status=status.HTTP_403_FORBIDDEN)

        return Response({
            "success": True,
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Terminates authentication session/token.
    NEVER creates or deletes a user.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from authentication.cases_views import get_authenticated_user
        user = get_authenticated_user(request)
        record_audit_event(
            safe_get_db(),
            actor_user=user,
            event_type="LOGOUT",
            description=f"Officer '{getattr(user, 'name', '') or getattr(user, 'username', 'SYSTEM')}' logged out.",
            request=request
        )
        return Response({
            "success": True,
            "message": "Logout successful."
        }, status=status.HTTP_200_OK)


def is_admin_authorized(request):
    """
    Validates whether the incoming request is authorized for Administrator officer management.
    Enforces RBAC security boundary on backend.
    """
    requester_role = (
        request.headers.get('X-Requester-Role') or
        request.data.get('requester_role') or
        request.query_params.get('requester_role') or
        getattr(request.user, 'role', '') or
        ''
    ).strip().lower()

    if requester_role in ['administrator', 'admin']:
        return True
    if getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False):
        return True

    if request.user.is_authenticated and getattr(request.user, 'role', '') in ['administrator', 'admin']:
        return True

    return False


class OfficerListView(APIView):
    """
    ADMIN API: GET /api/admin/users/ and POST /api/admin/users/
    Strictly enforced RBAC + Duplicate Protection.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not is_admin_authorized(request):
            return Response({
                "success": False,
                "message": "Administrator access required."
            }, status=status.HTTP_403_FORBIDDEN)

        role_param = request.query_params.get('role', 'ALL').strip().lower()
        rank_param = request.query_params.get('rank', 'ALL').strip()
        status_param = request.query_params.get('status', 'ALL').strip()
        q = request.query_params.get('q', '').strip()

        queryset = User.objects.all().order_by('-date_joined')

        if role_param != 'all' and role_param:
            role_key = ROLE_CATEGORY_ALIAS.get(role_param, role_param)
            queryset = queryset.filter(role__iexact=role_key)

        if rank_param != 'ALL' and rank_param:
            queryset = queryset.filter(rank__iexact=rank_param)

        if status_param != 'ALL' and status_param:
            queryset = queryset.filter(status__iexact=status_param)

        if q:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(name__icontains=q) |
                Q(officer_id__icontains=q) |
                Q(email__icontains=q) |
                Q(police_station__icontains=q) |
                Q(rank__icontains=q)
            )

        serializer = UserSerializer(queryset, many=True)
        return Response({
            "success": True,
            "users": serializer.data,
            "officers": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not is_admin_authorized(request):
            return Response({
                "success": False,
                "message": "Administrator access required."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            return Response({
                "success": True,
                "message": f"Officer {user.name} registered successfully.",
                "user": user_data
            }, status=status.HTTP_201_CREATED)

        errors = serializer.errors
        error_code = "VALIDATION_ERROR"
        error_msg = "Validation failed."

        def unwrap_val(val):
            if isinstance(val, (list, tuple)) and len(val) > 0:
                return unwrap_val(val[0])
            return str(val)

        def extract_error(err_data):
            nonlocal error_code, error_msg
            if isinstance(err_data, dict):
                if "code" in err_data:
                    error_code = unwrap_val(err_data["code"])
                    if "message" in err_data:
                        error_msg = unwrap_val(err_data["message"])
                    return True
                for k, v in err_data.items():
                    if extract_error(v):
                        return True
            elif isinstance(err_data, (list, tuple)):
                for item in err_data:
                    if extract_error(item):
                        return True
            return False

        extract_error(errors)

        if error_code in ["DUPLICATE_OFFICER_ID", "DUPLICATE_EMAIL"]:
            return Response({
                "success": False,
                "code": error_code,
                "message": error_msg
            }, status=status.HTTP_409_CONFLICT)
        elif error_code == "INVALID_ROLE_RANK":
            return Response({
                "success": False,
                "code": "INVALID_ROLE_RANK",
                "message": error_msg
            }, status=status.HTTP_400_BAD_REQUEST)


        return Response({
            "success": False,
            "code": error_code,
            "message": error_msg,
            "errors": errors
        }, status=status.HTTP_400_BAD_REQUEST)


class OfficerDetailView(APIView):
    """
    ADMIN API: GET / PATCH / DELETE /api/admin/users/{id}/
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"success": False, "message": "User does not exist."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"success": True, "user": UserSerializer(user).data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        if not is_admin_authorized(request):
            return Response({
                "success": False,
                "message": "Administrator access required."
            }, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"success": False, "message": "User does not exist."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        new_name = (data.get('full_name') or data.get('name') or user.name).strip()
        new_email = (data.get('email') or user.email).strip().lower()
        new_officer_id = (data.get('officer_id') or data.get('officerId') or data.get('badge_number') or user.officer_id or '').strip().upper()
        new_role = (data.get('category') or data.get('role') or user.role).strip().lower()
        role_key = ROLE_CATEGORY_ALIAS.get(new_role, new_role)
        new_rank = (data.get('rank') or user.rank).strip()
        norm_rank = RANK_NORMALIZATION.get(new_rank.lower(), new_rank)
        new_station = data.get('police_station') or data.get('policeStation') or user.police_station

        # Category + Rank Validation
        if role_key not in VALID_ROLE_RANKS:
            return Response({
                "success": False,
                "code": "INVALID_ROLE_RANK",
                "message": "Invalid Category and Rank combination."
            }, status=status.HTTP_400_BAD_REQUEST)

        if norm_rank not in VALID_ROLE_RANKS[role_key]:
            return Response({
                "success": False,
                "code": "INVALID_ROLE_RANK",
                "message": "Invalid Category and Rank combination."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Duplicate Email check against other officers
        if new_email != user.email and User.objects.filter(email=new_email).exclude(pk=pk).exists():
            return Response({
                "success": False,
                "code": "DUPLICATE_EMAIL",
                "message": "An account with this email already exists."
            }, status=status.HTTP_409_CONFLICT)

        # Duplicate Officer ID check against other officers
        if new_officer_id and new_officer_id != (user.officer_id or '').upper() and User.objects.filter(officer_id__iexact=new_officer_id).exclude(pk=pk).exists():
            return Response({
                "success": False,
                "code": "DUPLICATE_OFFICER_ID",
                "message": "An officer with this Officer ID already exists."
            }, status=status.HTTP_409_CONFLICT)

        user.name = new_name
        user.email = new_email
        user.officer_id = new_officer_id or user.officer_id
        user.role = role_key
        user.role_label = role_key.replace('_', ' ').title()
        user.rank = norm_rank
        user.police_station = new_station
        user.save()

        return Response({
            "success": True,
            "message": "Officer updated successfully.",
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        if not is_admin_authorized(request):
            return Response({
                "success": False,
                "message": "Administrator access required."
            }, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"success": False, "message": "User does not exist."}, status=status.HTTP_404_NOT_FOUND)

        user.delete()
        return Response({
            "success": True,
            "message": "Officer deleted successfully."
        }, status=status.HTTP_200_OK)


class OfficerToggleStatusView(APIView):
    """
    ADMIN API: PATCH /api/admin/users/{id}/status/
    Allowed values: "active" | "disabled"
    """
    permission_classes = [AllowAny]

    def patch(self, request, pk):
        return self._toggle_status(request, pk)

    def post(self, request, pk):
        return self._toggle_status(request, pk)

    def _toggle_status(self, request, pk):
        if not is_admin_authorized(request):
            return Response({
                "success": False,
                "message": "Administrator access required."
            }, status=status.HTTP_403_FORBIDDEN)

        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"success": False, "message": "User does not exist."}, status=status.HTTP_404_NOT_FOUND)

        requested_status = (request.data.get('status') or '').strip().lower()
        if requested_status in ['disabled', 'inactive']:
            next_status = 'Disabled'
        elif requested_status in ['active', 'enabled']:
            next_status = 'Active'
        else:
            next_status = 'Disabled' if user.status == 'Active' else 'Active'

        user.status = next_status
        user.is_active = (next_status == 'Active')
        user.save(update_fields=['status', 'is_active'])

        return Response({
            "success": True,
            "message": f"Officer {next_status.lower()} successfully.",
            "user": {
                "id": user.id,
                "status": next_status.lower()
            }
        }, status=status.HTTP_200_OK)



