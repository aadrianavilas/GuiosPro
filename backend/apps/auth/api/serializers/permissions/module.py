from rest_framework import serializers

from apps.auth.models.permissions.module import Module
from apps.auth.api.serializers.permissions.module_option import ModuleOptionSerializer


class ModuleSerializer(serializers.ModelSerializer):
    """Serializador para consultar módulos y sus opciones asociadas."""
    module_options = ModuleOptionSerializer(many=True, read_only=True)
    options_count = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["id", "order", "name", "icon", "module_options", "options_count"]

    def get_options_count(self, obj) -> int:
        return obj.module_options.count()


class ModuleUpdateSerializer(serializers.ModelSerializer):
    """Serializador para actualizar nombre, ícono y orden de un módulo existente."""
    class Meta:
        model = Module
        fields = ["id", "name", "icon", "order"]
        read_only_fields = ["id"]


    
