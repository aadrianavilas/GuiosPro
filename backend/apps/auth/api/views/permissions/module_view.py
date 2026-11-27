from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import MethodNotAllowed

from apps.auth.models.permissions.module import Module
from apps.auth.models.permissions.module_option import ModuleOption
from apps.auth.api.serializers.permissions.module import ModuleSerializer, ModuleUpdateSerializer
from apps.auth.api.serializers.permissions.module_option import ModuleOptionSerializer
from apps.auth.components.permissions.permissions import HasModulePermission
from apps.auth.components.permissions.constant import PERMISSIONS


class ModuleViewSet(ModelViewSet):
    """
    ViewSet para la administración de módulos del sistema (solo Administrador).
    Permite listar, visualizar, editar y reordenar módulos.
    La creación y eliminación están estrictamente restringidas.
    """
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    queryset = Module.objects.all().prefetch_related("module_options").order_by("order", "id")
    serializer_class = ModuleSerializer
    permission_classes = [HasModulePermission]
    required_permissions = {
        "list": [PERMISSIONS["MODULE_VIEW"], PERMISSIONS["MODULE_CHANGE"]],
        "retrieve": [PERMISSIONS["MODULE_VIEW"], PERMISSIONS["MODULE_CHANGE"]],
        "update": PERMISSIONS["MODULE_CHANGE"],
        "partial_update": PERMISSIONS["MODULE_CHANGE"],
        "reorder": PERMISSIONS["MODULE_CHANGE"],
        "toggle_option": [PERMISSIONS["MODULE_OPTION_CHANGE"], PERMISSIONS["MODULE_CHANGE"]],
        "update_option": [PERMISSIONS["MODULE_OPTION_CHANGE"], PERMISSIONS["MODULE_CHANGE"]],
        "reorder_options": [PERMISSIONS["MODULE_OPTION_CHANGE"], PERMISSIONS["MODULE_CHANGE"]],
    }

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return ModuleUpdateSerializer
        return ModuleSerializer

    def create(self, request, *args, **kwargs):
        # Regla de negocio: No se permite crear módulos nuevos desde esta vista
        raise MethodNotAllowed("POST", detail="No está permitido crear módulos directamente.")

    def destroy(self, request, *args, **kwargs):
        # Regla de negocio: No se permite eliminar módulos desde esta vista
        raise MethodNotAllowed("DELETE", detail="No está permitido eliminar módulos.")

    @action(detail=False, methods=["post", "patch"], url_path="reorder")
    def reorder(self, request):
        """
        Actualiza el orden de aparición de los módulos en lote mediante arrastre.
        Acepta una lista de objetos: [{'id': 1, 'order': 1}, ...] o lista de IDs en el nuevo orden.
        """
        payload = request.data
        if isinstance(payload, list):
            for index, item in enumerate(payload):
                if isinstance(item, dict) and "id" in item:
                    module_id = item.get("id")
                    order_val = item.get("order", index + 1)
                    Module.objects.filter(id=module_id).update(order=order_val)
                elif isinstance(item, int):
                    Module.objects.filter(id=item).update(order=index + 1)

        modules = Module.objects.all().prefetch_related("module_options").order_by("order", "id")
        return Response(ModuleSerializer(modules, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch", "post"], url_path="toggle-option/(?P<option_id>[0-9]+)")
    def toggle_option(self, request, option_id=None):
        """
        Activa o desactiva la visibilidad de una opción de módulo (ModuleOption).
        """
        try:
            option = ModuleOption.objects.get(id=option_id)
        except ModuleOption.DoesNotExist:
            return Response(
                {"detail": "Opción de módulo no encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        is_active_param = request.data.get("is_active")
        if is_active_param is not None:
            option.is_active = bool(is_active_param)
        else:
            option.is_active = not option.is_active
        option.save(update_fields=["is_active"])

        return Response(ModuleOptionSerializer(option).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["patch", "put"], url_path="update-option/(?P<option_id>[0-9]+)")
    def update_option(self, request, option_id=None):
        """
        Permite editar únicamente el nombre y el ícono de una opción de módulo.
        No permite alterar path ni slug para garantizar estabilidad en la navegación.
        """
        try:
            option = ModuleOption.objects.get(id=option_id)
        except ModuleOption.DoesNotExist:
            return Response(
                {"detail": "Opción de módulo no encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        name = request.data.get("name")
        icon = request.data.get("icon")

        if name is not None:
            clean_name = str(name).strip()
            if not clean_name:
                return Response(
                    {"detail": "El nombre de la opción no puede estar vacío."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            option.name = clean_name

        if icon is not None:
            option.icon = str(icon).strip()

        option.save(update_fields=["name", "icon"])
        return Response(ModuleOptionSerializer(option).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post", "patch"], url_path="reorder-options")
    def reorder_options(self, request):
        """
        Actualiza el orden de las opciones dentro de un módulo mediante arrastre.
        Acepta una lista de objetos: [{'id': 1, 'order': 1}, ...]
        """
        payload = request.data
        if isinstance(payload, list):
            for index, item in enumerate(payload):
                if isinstance(item, dict) and "id" in item:
                    option_id = item.get("id")
                    order_val = item.get("order", index + 1)
                    ModuleOption.objects.filter(id=option_id).update(order=order_val)
                elif isinstance(item, int):
                    ModuleOption.objects.filter(id=item).update(order=index + 1)

        return Response({"detail": "Orden de opciones actualizado correctamente."}, status=status.HTTP_200_OK)
