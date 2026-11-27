import re
from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework import serializers

from apps.auth.models.auth.user import User
from apps.auth.utils.password_validator import validate_password_rules


class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    organization_name = serializers.CharField(source="organization.business_name", read_only=True, default=None)
    avatar = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "username",
            "groups",
            "is_staff",
            "is_superuser",
            "role",
            "organization",
            "organization_name",
            "avatar",
            "is_mfa_enabled",
        ]

    def get_role(self, obj):
        request = self.context.get("request")
        active_group = None
        if request and hasattr(request, "headers"):
            active_group = request.headers.get("X-Active-Group")
        if not active_group and request and hasattr(request, "query_params"):
            active_group = request.query_params.get("active_group")

        if active_group:
            matched = obj.groups.filter(name__iexact=active_group).first()
            if matched:
                return matched.name

        if obj.is_superuser or obj.is_staff or obj.groups.filter(name="Administrador").exists():
            return "Administrador"
        return "Decisor"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        active_group = None
        if request and hasattr(request, "headers"):
            active_group = request.headers.get("X-Active-Group")
        if not active_group and request and hasattr(request, "query_params"):
            active_group = request.query_params.get("active_group")

        is_admin_active = False
        if active_group:
            is_admin_active = (active_group.strip().lower() == "administrador")
        else:
            is_admin_active = (
                instance.is_superuser
                or instance.is_staff
                or instance.groups.filter(name="Administrador").exists()
            ) and not instance.groups.filter(name="Decisor").exists()

        if is_admin_active:
            data["organization"] = None
            data["organization_name"] = None
        return data

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        try:
            url = obj.avatar.url
            if "://" in url:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return parsed.path
            if not url.startswith("/"):
                return f"/{url}"
            return url
        except Exception:
            return None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    avatar = serializers.FileField(required=False, allow_null=True)
    is_mfa_enabled = serializers.BooleanField(required=False)
    new_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=8
    )
    confirm_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "avatar",
            "is_mfa_enabled",
            "new_password",
            "confirm_password",
        ]

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password or confirm_password:
            if not new_password or not confirm_password:
                raise serializers.ValidationError({
                    "confirm_password": "Debes ingresar y confirmar la nueva contraseña."
                })
            user = self.instance
            validate_password_rules(
                password=new_password,
                confirm_password=confirm_password,
                first_name=user.first_name if user else "",
                last_name=user.last_name if user else "",
                username=user.username if user else "",
                email=user.email if user else "",
            )
        return attrs

    def update(self, instance, validated_data):
        new_password = validated_data.pop("new_password", None)
        validated_data.pop("confirm_password", None)

        request = self.context.get("request")
        if request and request.data.get("remove_avatar") in [True, "true", "1"]:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if new_password:
            instance.set_password(new_password)

        instance.save()
        return instance


class GroupSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["id", "name"]


class UserAdminListSerializer(serializers.ModelSerializer):
    groups = GroupSimpleSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "username",
            "email",
            "is_active",
            "groups",
            "is_staff",
            "is_superuser",
            "avatar",
            "created_at",
            "date_joined",
        ]

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        try:
            url = obj.avatar.url
            if "://" in url:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return parsed.path
            if not url.startswith("/"):
                return f"/{url}"
            return url
        except Exception:
            return None


class UserAdminCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)
    group_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "username",
            "email",
            "password",
            "confirm_password",
            "group_ids",
        ]

    def validate_first_name(self, value):
        clean = (value or "").strip()
        if not clean:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return clean

    def validate_last_name(self, value):
        clean = (value or "").strip()
        if not clean:
            raise serializers.ValidationError("El apellido es obligatorio.")
        return clean

    def validate_email(self, value):
        clean_email = (value or "").strip().lower()
        if not clean_email:
            raise serializers.ValidationError("El correo electrónico es obligatorio.")
        if User.objects.filter(email__iexact=clean_email).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo electrónico.")
        return clean_email

    def validate_username(self, value):
        clean_username = (value or "").strip()
        if not clean_username:
            raise serializers.ValidationError("El nombre de usuario es obligatorio.")
        if User.objects.filter(username__iexact=clean_username).exists():
            raise serializers.ValidationError("Este nombre de usuario ya está en uso.")
        return clean_username

    def validate(self, attrs):
        password = attrs.get("password") or ""
        confirm_password = attrs.get("confirm_password") or ""
        first_name = attrs.get("first_name") or ""
        last_name = attrs.get("last_name") or ""
        username = attrs.get("username") or ""
        email = attrs.get("email") or ""

        validate_password_rules(
            password=password,
            confirm_password=confirm_password,
            first_name=first_name,
            last_name=last_name,
            username=username,
            email=email,
        )
        return attrs

    def create(self, validated_data):
        group_ids = validated_data.pop("group_ids", [])
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password")

        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                **validated_data
            )
            if group_ids:
                groups = Group.objects.filter(id__in=group_ids)
                user.groups.set(groups)
        return user


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    group_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )

    class Meta:
        model = User
        fields = [
            "id",
            "first_name",
            "last_name",
            "is_active",
            "group_ids",
        ]

    def validate_first_name(self, value):
        clean = (value or "").strip()
        if not clean:
            raise serializers.ValidationError("El nombre no puede estar vacío.")
        return clean

    def validate_last_name(self, value):
        clean = (value or "").strip()
        if not clean:
            raise serializers.ValidationError("El apellido no puede estar vacío.")
        return clean

    def update(self, instance, validated_data):
        group_ids = validated_data.pop("group_ids", None)
        instance.first_name = validated_data.get("first_name", instance.first_name).strip()
        instance.last_name = validated_data.get("last_name", instance.last_name).strip()
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]

        instance.save()

        if group_ids is not None:
            groups = Group.objects.filter(id__in=group_ids)
            instance.groups.set(groups)

        return instance

        