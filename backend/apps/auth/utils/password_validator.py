import re
from rest_framework import serializers

def validate_password_rules(
    password: str,
    confirm_password: str = None,
    first_name: str = "",
    last_name: str = "",
    username: str = "",
    email: str = "",
) -> None:
    """
    Valida los 4 requisitos institucionales de seguridad de contraseñas de GuiosPro:
    1. Mayor de 8 caracteres (mínimo 9 caracteres).
    2. No puede ser solo números (debe contener letras o símbolos).
    3. No contiene tu nombre, apellido, usuario o correo.
    4. Las dos contraseñas deben coincidir exactamente (si se proporciona confirm_password).
    """
    pwd = password or ""

    # Regla 1: Mayor de 8 caracteres (mínimo 9 caracteres)
    if len(pwd) <= 8:
        raise serializers.ValidationError({
            "password": "La contraseña debe tener más de 8 caracteres (mínimo 9)."
        })

    # Regla 2: No puede ser solo números
    if pwd.isdigit():
        raise serializers.ValidationError({
            "password": "La contraseña no puede estar compuesta únicamente por números."
        })

    # Regla 3: No contiene nombre, apellido, usuario o correo
    pwd_lower = pwd.lower()
    forbidden_tokens = set()

    clean_user = (username or "").strip().lower()
    if len(clean_user) >= 3:
        forbidden_tokens.add(clean_user)

    clean_first = (first_name or "").strip().lower()
    for part in re.split(r"\s+", clean_first):
        if len(part) >= 3:
            forbidden_tokens.add(part)

    clean_last = (last_name or "").strip().lower()
    for part in re.split(r"\s+", clean_last):
        if len(part) >= 3:
            forbidden_tokens.add(part)

    clean_email = (email or "").strip().lower()
    if clean_email:
        email_local = clean_email.split("@")[0]
        for part in re.split(r"[._\-+0-9]+", email_local):
            if len(part) >= 3:
                forbidden_tokens.add(part)

    for token in forbidden_tokens:
        if token in pwd_lower:
            raise serializers.ValidationError({
                "password": f"La contraseña no puede contener partes de tu nombre, apellido, usuario o correo ('{token}')."
            })

    # Regla 4: Las contraseñas deben coincidir exactamente
    if confirm_password is not None and pwd != confirm_password:
        raise serializers.ValidationError({
            "confirm_password": "Las contraseñas no coinciden exactamente."
        })
