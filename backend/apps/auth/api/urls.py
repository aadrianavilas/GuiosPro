from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.auth.api.views.auth.auth_view import LoginView, RegisterView, TokenRefreshView, LogoutView
from apps.auth.api.views.auth.user_view import UserProfileView, UserManagementViewSet
from apps.auth.api.views.auth.password_reset_view import (
    PasswordResetRequestView,
    PasswordResetVerifyView,
    PasswordResetConfirmView,
)
from apps.auth.api.views.mfa.emailmfa_view import EmailMFAView, EmailMFAVerifyView
from apps.auth.api.views.permissions.navigation import UserNavigationModulesView
from apps.auth.api.views.permissions.module_view import ModuleViewSet
from apps.auth.api.views.permissions.group_view import GroupViewSet
from apps.auth.api.views.mfa.webauthn_view import (
    WebAuthnRegisterOptionsView, 
    WebAuthnVerifyView, 
    WebAuthnAuthenticateView,
    WebAuthnVerifyAuthenticateView
)

app_name = "auth"

router = DefaultRouter()
router.register(r'config/modules', ModuleViewSet, basename='config-modules')
router.register(r'config/groups', GroupViewSet, basename='config-groups')
router.register(r'config/users', UserManagementViewSet, basename='config-users')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/password-reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('auth/password-reset/verify/', PasswordResetVerifyView.as_view(), name='password-reset-verify'),
    path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/profile/', UserProfileView.as_view(), name='user-profile'),
    path('user/profile/', UserProfileView.as_view(), name='user-profile-alt'),
    path('navigation/modules/', UserNavigationModulesView.as_view(), name='navigation-modules'),
    path('auth/email-mfa/send/', EmailMFAView.as_view(), name='send-email-mfa'),
    path('auth/email-mfa/verify/', EmailMFAVerifyView.as_view(), name='verify-email-mfa'),
    path('webauthn/register/options/', WebAuthnRegisterOptionsView.as_view(), name='webauthn-register-verify'),
    path('webauthn/register/verify/', WebAuthnVerifyView.as_view(), name='webauthn-register-verify'),
    path('webauthn/authenticate/options/', WebAuthnAuthenticateView.as_view(), name='webauthn-authenticate-options'),
    path('webauthn/authenticate/verify/', WebAuthnVerifyAuthenticateView.as_view(), name='webauthn-authenticate-verify'),
] + router.urls