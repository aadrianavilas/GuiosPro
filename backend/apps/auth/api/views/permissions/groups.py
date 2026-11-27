from rest_framework.viewsets import ModelViewSet
from django.contrib.auth.models import Group

from apps.auth.api.serializers.permissions.module import ModuleSerializer
from apps.auth.api.serializers.permissions.module_option import ModuleOptionSerializer
from apps.auth.api.serializers.permissions.groups import GroupSerializer
from apps.auth.models.permissions.module import Module
from apps.auth.models.permissions.module_option import ModuleOption


class GroupView(ModelViewSet):
    serializer_class = GroupSerializer
    queryset = Group.objects.all()


class ModuleView(ModelViewSet):
    serializer_class = ModuleSerializer
    queryset = Module.objects.all()


class ModuleOptionView(ModelViewSet):
    serializer_class = ModuleOptionSerializer
    queryset = ModuleOption.objects.all()
