from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from apps.auth.models.auth.user import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        request = self.context.get("request")

        # Comprobar que existe un usuario con el email proporcionado
        user = authenticate(request=request, email=email, password=password)

        if user is None:
            raise serializers.ValidationError(
                _("Credenciales inválidas. Por favor verifica tu correo y contraseña.")
            )

        # Validar que el usuario esté activo
        if not user.is_active:
            raise serializers.ValidationError(_("El usuario no está activo"))

        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializador para registrar un nuevo usuario con rol de Decisor.
    Campos según el modelo User: first_name, last_name, email, password.
    """
    first_name = serializers.CharField(
        required=True,
        max_length=150,
        error_messages={"blank": _("El nombre es obligatorio.")}
    )
    last_name = serializers.CharField(
        required=True,
        max_length=150,
        error_messages={"blank": _("El apellido es obligatorio.")}
    )
    email = serializers.EmailField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message=_("Ya existe una cuenta registrada con este correo electrónico.")
            )
        ],
        error_messages={"blank": _("El correo electrónico es obligatorio.")}
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        error_messages={
            "blank": _("La contraseña es obligatoria."),
            "min_length": _("La contraseña debe tener al menos 8 caracteres.")
        }
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=False
    )

    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "password", "password_confirm"]

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password_confirm is not None and password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": _("Las contraseñas no coinciden.")}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        email = validated_data["email"].strip().lower()
        first_name = validated_data.get("first_name", "").strip()
        last_name = validated_data.get("last_name", "").strip()
        password = validated_data["password"]

        # username asignado automáticamente con base en el email
        username = email

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            is_active=True,
        )

        # Asignar automáticamente el rol / grupo "Decisor"
        decisor_group, _ = Group.objects.get_or_create(
            name="Decisor",
            defaults={"name": "Decisor"}
        )
        user.groups.add(decisor_group)

        return user
