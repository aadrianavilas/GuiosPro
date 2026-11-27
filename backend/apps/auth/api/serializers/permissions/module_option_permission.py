from rest_framework import serializers
from django.contrib.auth.models import Permission

from apps.auth.models.permissions.module_option import ModuleOption
from apps.auth.models.permissions.module import Module
from apps.auth.api.serializers.permissions.module_option import ModuleOptionSerializer
#from apps.auth.api.serializers.permissions.groups import GroupSerializer
from apps.auth.models.permissions.module_option_permission import ModuleOptionPermission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "name", "codename"]
        read_only_fields = fields

class ModuleOptionPermissionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleOptionPermission
        fields = ["id", "module_option", "group", "permission", "order", "description"]




class ModuleOptionSerializer(serializers.ModelSerializer):
    # Serializador para la administración de las opciones de  los módulos
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = ModuleOption
        fields = [ "id", "name", "icon", "path", "order", "permissions"]


class ModuleOptionPermissionManagementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleOptionPermission
        fields = ["id", "module_option", "group", "permission", "order", "description"]




class ModuleManagementSerializer(serializers.ModelSerializer):
    # Serializador para la administración de los módulos
    module_options = ModuleOptionSerializer(many=True, read_only=True)
    class Meta:
        model = Module
        fields = [ "id", "name", "icon", "order", "module_options"]
    