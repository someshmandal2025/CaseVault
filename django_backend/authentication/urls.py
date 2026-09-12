from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    CurrentSessionView,
    LogoutView,
    ForgotPasswordView,
    VerifyOTPView,
    ResetPasswordView,
    TestEmailView,
    MongoPingView,
    OfficerListView,
    OfficerDetailView,
    OfficerToggleStatusView
)
from .cases_views import CaseListCreateView, CaseDetailView
from .documents_views import (
    CaseDocumentListCreateView,
    DocumentDetailView,
    DocumentDownloadView,
    DocumentVerifyView
)
from .evidence_views import (
    CaseEvidenceListCreateView,
    EvidenceDetailView,
    EvidenceTransferView,
    EvidenceAcceptView,
    EvidenceReleaseView,
    EvidenceCustodyHistoryView,
    EvidenceVerifyView
)
from .audit_views import (
    AuditLogListView,
    AuditDetailView,
    AuditVerifyView
)

urlpatterns = [
    # Auth & Account Creation
    path('login/', LoginView.as_view(), name='api-login'),
    path('register/', RegisterView.as_view(), name='api-register'),
    path('auth/me/', CurrentSessionView.as_view(), name='api-auth-me'),
    path('auth/me', CurrentSessionView.as_view()),
    path('logout/', LogoutView.as_view(), name='api-logout'),

    # Audit Trail & SHA-256 Tamper-Evident Chain APIs
    path('audit/', AuditLogListView.as_view(), name='api-audit-list'),
    path('audit/verify/', AuditVerifyView.as_view(), name='api-audit-verify'),
    path('audit/<str:audit_id>/', AuditDetailView.as_view(), name='api-audit-detail'),

    # Case Management APIs
    path('cases/', CaseListCreateView.as_view(), name='api-cases-list-create'),
    path('cases/<str:case_id>/', CaseDetailView.as_view(), name='api-case-detail'),

    # Document Management & SHA-256 Verification APIs
    path('cases/<str:case_id>/documents/', CaseDocumentListCreateView.as_view(), name='api-case-documents-list-create'),
    path('documents/<str:document_id>/', DocumentDetailView.as_view(), name='api-document-detail'),
    path('documents/<str:document_id>/download/', DocumentDownloadView.as_view(), name='api-document-download'),
    path('documents/<str:document_id>/verify/', DocumentVerifyView.as_view(), name='api-document-verify'),

    # Evidence Management & Chain of Custody APIs
    path('cases/<str:case_id>/evidence/', CaseEvidenceListCreateView.as_view(), name='api-case-evidence-list-create'),
    path('evidence/<str:evidence_id>/', EvidenceDetailView.as_view(), name='api-evidence-detail'),
    path('evidence/<str:evidence_id>/transfer/', EvidenceTransferView.as_view(), name='api-evidence-transfer'),
    path('evidence/<str:evidence_id>/accept/', EvidenceAcceptView.as_view(), name='api-evidence-accept'),
    path('evidence/<str:evidence_id>/release/', EvidenceReleaseView.as_view(), name='api-evidence-release'),
    path('evidence/<str:evidence_id>/custody/', EvidenceCustodyHistoryView.as_view(), name='api-evidence-custody'),
    path('evidence/<str:evidence_id>/verify/', EvidenceVerifyView.as_view(), name='api-evidence-verify'),


    # Admin User Management
    path('admin/users/', OfficerListView.as_view(), name='api-admin-users'),
    path('admin/users/<int:pk>/', OfficerDetailView.as_view(), name='api-admin-users-detail'),
    path('admin/users/<int:pk>/status/', OfficerToggleStatusView.as_view(), name='api-admin-users-status'),

    # Password Reset & OTP
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='api-auth-forgot-password'),
    path('forgot-password/', ForgotPasswordView.as_view()),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='api-auth-verify-otp'),
    path('auth/verify-reset-otp/', VerifyOTPView.as_view()),
    path('verify-otp/', VerifyOTPView.as_view()),
    path('verify-reset-otp/', VerifyOTPView.as_view()),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='api-auth-reset-password'),
    path('reset-password/', ResetPasswordView.as_view()),

    # Legacy Aliases & Utility Endpoints
    path('officers/', OfficerListView.as_view(), name='api-officers-list'),
    path('officers/<int:pk>/', OfficerDetailView.as_view(), name='api-officers-detail'),
    path('officers/<int:pk>/toggle-status/', OfficerToggleStatusView.as_view(), name='api-officers-toggle-status'),
    path('test-email/', TestEmailView.as_view(), name='api-test-email'),
    path('mongo-ping/', MongoPingView.as_view(), name='api-mongo-ping'),

    # Legacy /api/auth/... aliases
    path('auth/register', RegisterView.as_view()),
    path('auth/login', LoginView.as_view()),
    path('auth/logout', LogoutView.as_view()),
    path('auth/officers', OfficerListView.as_view()),
]


