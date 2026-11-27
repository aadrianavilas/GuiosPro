from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.auth.components.permissions.permissions import (
    HasModulePermission,
    HasModuleOptionPermission,
)
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.evaluation.models.organization import Organization
from apps.evaluation.api.serializers.organization import (
    OrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationUpdateSerializer,
)


class OrganizationSetupView(APIView):
    """
    POST /api/v1/organization/setup/
    Registra o actualiza la organización del decisor.
    """
    permission_classes = [HasModulePermission]
    required_permissions = {
        "create": [PERMISSIONS["ORGANIZATION_CHANGE"], PERMISSIONS["ORGANIZATION_VIEW"]],
    }

    def post(self, request):
        user = request.user if request.user and request.user.is_authenticated else None
        business_name = request.data.get("business_name")

        # Si el usuario ya tiene organización vinculada o ya existe con esa razón social y usuario, actualizar
        existing_org = None
        if user and user.organization:
            existing_org = user.organization
        elif business_name:
            if user:
                existing_org = Organization.objects.filter(business_name=business_name, user=user).first()
            else:
                existing_org = Organization.objects.filter(business_name=business_name).first()

        if existing_org:
            serializer = OrganizationUpdateSerializer(
                instance=existing_org,
                data=request.data,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            organization = serializer.save()
            if user and not user.organization:
                user.organization = organization
                user.save(update_fields=["organization"])
            return Response(
                {
                    "detail": "Organización actualizada exitosamente.",
                    "organization": OrganizationSerializer(organization).data,
                },
                status=status.HTTP_200_OK,
            )

        serializer = OrganizationCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()

        return Response(
            {
                "detail": "Organización registrada exitosamente.",
                "organization": OrganizationSerializer(organization).data,
            },
            status=status.HTTP_201_CREATED,
        )


class OrganizationMeView(APIView):
    """
    GET  /api/v1/organization/me/   → retorna la organización del usuario autenticado o la registrada
    PUT  /api/v1/organization/me/   → actualiza la organización
    """
    permission_classes = [HasModulePermission, HasModuleOptionPermission]
    required_permissions = {
        "list": [PERMISSIONS["ORGANIZATION_VIEW"], PERMISSIONS["ORGANIZATION_CHANGE"]],
        "retrieve": [PERMISSIONS["ORGANIZATION_VIEW"], PERMISSIONS["ORGANIZATION_CHANGE"]],
        "update": PERMISSIONS["ORGANIZATION_CHANGE"],
        "partial_update": PERMISSIONS["ORGANIZATION_CHANGE"],
    }

    def _is_admin(self, request, user=None):
        user = user or (request.user if hasattr(request, "user") else None)
        if not user or not user.is_authenticated:
            return False
        active_group = None
        if hasattr(request, "headers"):
            active_group = request.headers.get("X-Active-Group")
        if not active_group and hasattr(request, "query_params"):
            active_group = request.query_params.get("active_group")

        if active_group:
            return active_group.strip().lower() == "administrador"

        # Si el usuario tiene el rol Decisor asignado, se prioriza Decisor para el acceso a organización
        if user.groups.filter(name="Decisor").exists() and not user.is_superuser:
            return False

        return user.is_superuser or user.groups.filter(name="Administrador").exists()

    def _get_organization(self, request):
        user = request.user
        if self._is_admin(request, user):
            return None

        if user and user.is_authenticated and user.organization:
            return user.organization

        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(
                business_name="Comercial Andina Cía. Ltda.",
                commercial_name="TecnoEmpresa",
                organization_type="private",
                sector="Tecnología",
                city="Guayaquil",
                country="Ecuador",
            )
        if user and user.is_authenticated and not user.organization and not self._is_admin(request, user):
            user.organization = org
            user.save(update_fields=["organization"])
        return org

    def get(self, request):
        if self._is_admin(request, request.user):
            return Response(
                {
                    "has_organization": False,
                    "detail": "El rol de Administrador no cuenta con una organización asociada.",
                },
                status=status.HTTP_200_OK,
            )

        org = self._get_organization(request)
        return Response(
            {
                "has_organization": True,
                "organization": OrganizationSerializer(org).data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        if self._is_admin(request, request.user):
            return Response(
                {
                    "detail": "El rol de Administrador no cuenta con una organización asociada ni permisos para editarla.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        org = self._get_organization(request)
        serializer = OrganizationUpdateSerializer(
            instance=org,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_org = serializer.save()

        return Response(
            {
                "detail": "Organización actualizada exitosamente.",
                "organization": OrganizationSerializer(updated_org).data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        org = self._get_organization(request)
        serializer = OrganizationUpdateSerializer(
            instance=org,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        updated_org = serializer.save()
        return Response(
            {
                "detail": "Organización actualizada correctamente.",
                "organization": OrganizationSerializer(updated_org).data,
            },
            status=status.HTTP_200_OK,
        )


class OrganizationViewSet(ModelViewSet):
    """ViewSet de administración de Organización."""
    permission_classes = [HasModulePermission, HasModuleOptionPermission]
    required_permissions = {
        "list": PERMISSIONS["ORGANIZATION_VIEW"],
        "retrieve": PERMISSIONS["ORGANIZATION_VIEW"],
        "create": PERMISSIONS["ORGANIZATION_CHANGE"],
        "update": PERMISSIONS["ORGANIZATION_CHANGE"],
        "partial_update": PERMISSIONS["ORGANIZATION_CHANGE"],
        "destroy": PERMISSIONS["ORGANIZATION_CHANGE"],
    }
    serializer_class = OrganizationSerializer
    queryset = Organization.objects.all()
