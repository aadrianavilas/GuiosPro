from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.evaluation.api.views.organization import (
    OrganizationSetupView,
    OrganizationMeView,
    OrganizationViewSet,
)
from apps.evaluation.api.views.software import SoftwareViewSet
from apps.evaluation.api.views.evaluation import EvaluationViewSet

router = DefaultRouter()
router.register(r"organizations", OrganizationViewSet, basename="organization")
router.register(r"software", SoftwareViewSet, basename="software")
router.register(r"evaluations", EvaluationViewSet, basename="evaluation")

urlpatterns = [
    # Flujo del decisor
    path("organization/setup/", OrganizationSetupView.as_view(), name="organization-setup"),
    path("organization/me/", OrganizationMeView.as_view(), name="organization-me"),
    # CRUD general / ViewSets
    path("", include(router.urls)),
]
