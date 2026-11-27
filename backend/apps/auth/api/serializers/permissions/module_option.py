from rest_framework import serializers
import unicodedata
import re

from apps.auth.models.permissions.module_option import ModuleOption


class ModuleOptionSerializer(serializers.ModelSerializer):
    """Serializador de lectura para opciones de módulo."""
    slug = serializers.SerializerMethodField()

    class Meta:
        model = ModuleOption
        fields = ["id", "name", "icon", "path", "order", "is_active", "slug"]

    def get_slug(self, obj) -> str:
        text = unicodedata.normalize("NFKD", obj.name).encode("ascii", "ignore").decode("utf-8")
        return re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_")


class ModuleOptionWriteSerializer(serializers.ModelSerializer):
    """Serializador de escritura para opciones de módulo."""
    class Meta:
        model = ModuleOption
        fields = ["id", "name", "icon", "path", "order", "is_active", "module"]



