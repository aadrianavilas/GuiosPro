from django.db import models
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.auth.models.auth.user import User
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS
from apps.auth.api.serializers.auth.user import (
    UserSerializer,
    UserProfileUpdateSerializer,
    UserAdminListSerializer,
    UserAdminCreateSerializer,
    UserAdminUpdateSerializer,
)


class UserProfileView(APIView):
    """
    GET  /api/v1/auth/profile/  -> Retorna la información del perfil del usuario actual.
    PUT  /api/v1/auth/profile/  -> Actualiza nombres, apellidos, avatar y/o contraseña.
    PATCH /api/v1/auth/profile/ -> Actualización parcial.
    """
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_user(self, request):
        if request.user and request.user.is_authenticated:
            return request.user
        # Fallback de desarrollo para garantizar continuidad operativa
        user = User.objects.filter(is_active=True).first()
        if not user:
            user = User.objects.create_user(
                username="decisor",
                email="decisor@guiospro.local",
                first_name="Adrián",
                last_name="Decisor",
            )
        return user

    def get(self, request):
        user = self._get_user(request)
        return Response(
            {
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        user = self._get_user(request)
        serializer = UserProfileUpdateSerializer(
            instance=user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()

        return Response(
            {
                "detail": "Perfil actualizado exitosamente.",
                "user": UserSerializer(updated_user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        return self.put(request)


class UserManagementViewSet(ModelViewSet):
    """
    ViewSet para la administración integral de usuarios en GuiosPro.
    Permite listar, filtrar, buscar, crear usuarios y asignar grupos.
    El administrador NO puede visualizar ni modificar contraseñas de otros usuarios.
    """
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']
    queryset = User.objects.all().prefetch_related('groups').order_by('first_name', 'last_name', 'username')
    permission_classes = [HasModulePermission]
    required_permissions = {
        'list': PERMISSIONS['CONFIG_USER_VIEW'],
        'retrieve': PERMISSIONS['CONFIG_USER_VIEW'],
        'create': PERMISSIONS['CONFIG_USER_ADD'],
        'update': PERMISSIONS['CONFIG_USER_CHANGE'],
        'partial_update': PERMISSIONS['CONFIG_USER_CHANGE'],
        'destroy': PERMISSIONS['CONFIG_USER_DELETE'],
        'toggle_active': PERMISSIONS['CONFIG_USER_CHANGE'],
    }

    def get_serializer_class(self):
        if self.action == 'create':
            return UserAdminCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserAdminUpdateSerializer
        return UserAdminListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(username__icontains=search) |
                models.Q(email__icontains=search)
            )

        group_id = self.request.query_params.get('group')
        if group_id and group_id not in ['all', 'todos', '']:
            qs = qs.filter(groups__id=group_id)

        is_active = self.request.query_params.get('is_active')
        if is_active in ['true', 'True', '1']:
            qs = qs.filter(is_active=True)
        elif is_active in ['false', 'False', '0']:
            qs = qs.filter(is_active=False)

        return qs.distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = UserAdminListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        read_serializer = UserAdminListSerializer(user, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        # Un usuario administrador no puede desactivar su propia cuenta
        if (
            request.user and request.user.is_authenticated and
            (user == request.user or user.id == request.user.id or user.email == request.user.email) and
            request.data.get('is_active') is False
        ):
            return Response(
                {'detail': 'Un usuario administrador no puede desactivar su propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(user, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        read_serializer = UserAdminListSerializer(updated_user, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        # Un usuario administrador no puede desactivar su propia cuenta
        if (
            request.user and request.user.is_authenticated and
            (user == request.user or user.id == request.user.id or user.email == request.user.email) and
            request.data.get('is_active') is False
        ):
            return Response(
                {'detail': 'Un usuario administrador no puede desactivar su propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        read_serializer = UserAdminListSerializer(updated_user, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        # Regla estricta: Un usuario administrador no puede desactivar su propia cuenta. Solo las de otros.
        if (
            request.user and request.user.is_authenticated and
            (user == request.user or user.id == request.user.id or user.email == request.user.email)
        ):
            return Response(
                {'detail': 'Un usuario administrador no puede desactivar su propia cuenta. Solo puede gestionar las cuentas de otros usuarios.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.is_active = not user.is_active
        user.save(update_fields=['is_active', 'updated_at'])
        read_serializer = UserAdminListSerializer(user, context={'request': request})
        return Response({
            'detail': f"Usuario {'activado' if user.is_active else 'desactivado'} exitosamente.",
            'user': read_serializer.data
        }, status=status.HTTP_200_OK)
