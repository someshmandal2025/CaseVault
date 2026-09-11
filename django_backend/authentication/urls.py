from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    ForgotPasswordView,
    VerifyOTPView,
    ResetPasswordView,
    TestEmailView
)

urlpatterns = [
    # Legacy & REST paths
    path('register/', RegisterView.as_view(), name='api-register'),
    path('login/', LoginView.as_view(), name='api-login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='api-forgot-password'),
    path('verify-reset-otp/', VerifyOTPView.as_view(), name='api-verify-reset-otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='api-reset-password'),
    path('test-email/', TestEmailView.as_view(), name='api-test-email'),

    # /api/auth/... aliases
    path('auth/register', RegisterView.as_view()),
    path('auth/login', LoginView.as_view()),
    path('auth/forgot-password', ForgotPasswordView.as_view()),
    path('auth/verify-reset-otp', VerifyOTPView.as_view()),
    path('auth/reset-password', ResetPasswordView.as_view()),
]
