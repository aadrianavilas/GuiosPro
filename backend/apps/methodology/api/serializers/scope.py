from rest_framework import serializers

from apps.methodology.models.scope import Scope

class ScopeSerializer(serializers.ModelSerializer):
    class Meta:
        model= Scope
        fields = ["id", "name", "description"]
    