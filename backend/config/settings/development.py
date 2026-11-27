from .base import *
import os
from dotenv import load_dotenv

load_dotenv(BASE_DIR / ".env")

DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "backend",
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]

is_postgres = (os.getenv("DB_ENGINE") or "").endswith("postgresql")
has_postgres_driver = False
postgres_reachable = False

if is_postgres:
    try:
        import psycopg  # type: ignore # noqa
        has_postgres_driver = True
    except ImportError:
        try:
            import psycopg2  # type: ignore # noqa
            has_postgres_driver = True
        except ImportError:
            has_postgres_driver = False

    # Verificar si el host de Postgres es accesible (Docker puede no estar corriendo)
    if has_postgres_driver:
        import socket
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = int(os.getenv("DB_PORT", 5432))
        try:
            sock = socket.create_connection((db_host, db_port), timeout=1)
            sock.close()
            postgres_reachable = True
        except (socket.error, OSError):
            postgres_reachable = False

# Fallback a SQLite si: no hay engine, no hay driver, o Postgres no es accesible
use_sqlite = (
    os.getenv("DB_ENGINE") is None
    or (is_postgres and not has_postgres_driver)
    or (is_postgres and not postgres_reachable)
)

if use_sqlite:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": os.getenv("DB_ENGINE"),
            "NAME": os.getenv("DB_NAME"),
            "USER": os.getenv("DB_USER"),
            "PASSWORD": os.getenv("DB_PASSWORD"),
            "HOST": os.getenv("DB_HOST"),
            "PORT": os.getenv("DB_PORT"),
        }
    }

JWT_COOKIE_SECURE = (os.getenv("JWT_COOKIE_SECURE", 'True' if DEBUG else 'False')).lower() in ('true', '1', 't')


DOMAIN_NAME = '/'

#WebAuthn Configuration
WEBAUTHN = {
    "RP_ID": os.getenv("WEBAUTHN_RP_ID"),
    "RP_NAME": os.getenv("WEBAUTHN_RP_NAME"),
    "ORIGIN": os.getenv("WEBAUTHN_ORIGIN") or os.getenv("WEBAUTH_ORIGIN")
}


#Redis
REDIS = {
    "HOST": os.getenv("REDIS_HOST"),
    "PORT": int(os.getenv("REDIS_PORT")) if os.getenv("REDIS_PORT") else 6379,
    "DB":  int(os.getenv("REDIS_DB")) if os.getenv("REDIS_DB") else 0,
    "DECODE_RESPONSE": (os.getenv("REDIS_DECODE_RESPONSES") or "False").lower() in ('true', '1', 't')
}

VERIFICATION_CODE_LENGTH = 6