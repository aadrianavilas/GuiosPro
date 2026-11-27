from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import timedelta


# Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent


load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

# Secret Key 
SECRET_KEY = os.getenv('SECRET_KEY')

# Application definition
BASE_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

# Third Apps
THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
]

# Local Apps
LOCAL_APPS = [
    "apps.core",
    "apps.auth",
    "apps.methodology",
    "apps.evaluation",
]

INSTALLED_APPS = BASE_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'


TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Configuration REST_FRAMEWORK
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.auth.components.tokens.cookie_auth.CookieJWTAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

# Congiguration JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
    "ROTATE_REFRESH_TOKENS": True,
    "ALGORITHM": 'HS256',
    "USER_ID_FIELD": 'id',
    "USER_ID_CLAIM": "user_id", 
    "BLACKLIST_AFTER_ROTATION": True,
    "SIGNING_KEY": os.getenv("JWT_SIGNING_KEY", SECRET_KEY),
    "UPDATE_LAST_LOGIN": False,
    "AUTH_TOKEN_CLASSES": ('rest_framework_simplejwt.tokens.AccessToken',),
}

JWT_CUSTOM = {
    "TEMP_TOKEN_LIFETIME": timedelta(minutes=5)
}

EMAIL_CODE_LIFETIME = timedelta(minutes=5)
EMAIL_CODE_MAX_ATTEMPTS = 3
EMAIL_CODE_MIN_ATTEMPTS = 0
VERIFICATION_CODE_LENGTH = 6



LANGUAGE_CODE = 'es-ec'

TIME_ZONE = 'America/Guayaquil'

USE_I18N = True

USE_TZ = True

AUTH_USER_MODEL = "authentication.User"

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Mailers for email configuration
MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": os.getenv("EMAIL_HOST") or "smtp.gmail.com",
            "port": int(os.getenv("EMAIL_PORT")) if os.getenv("EMAIL_PORT") else 587,
            "username": os.getenv("EMAIL_HOST_USER"),
            "password": os.getenv("EMAIL_HOST_PASSWORD"),
            "use_tls": os.getenv("EMAIL_USE_TLS") == 'True',
        },
    },
}

EMAIL_FROM = os.getenv("EMAIL_HOST_USER")

# Logg
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "normal": {
            "format": "{asctime} | {levelname} | {message}",
            "style": "{", 
        }, 
        "error": {
            "format": "{asctime} | {levelname} | {name} | {message}",
            "style": "{",
        },
        "api": {
            "format": "[API] {asctime} | {levelname} | {message}",
            "style": "{"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "normal",
        },
        "errors_console": {
            "class": "logging.StreamHandler",
            "formatter": "error",
        },
        "api_console": {
            "class": "logging.StreamHandler",
            "formatter": "api",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "django.request": {
            "handlers": ["errors_console"],
            "level": "ERROR",
            "propagate": False
        },
        "api": {
            "handlers": ["api_console"],
            "level": "INFO",
            "propagate": False
        }
    },
}


JWT_COOKIE_SECURE = (os.getenv("JWT_COOKIE_SECURE")).lower() in ('true', '1', 't')

# Groq AI
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://redis:6379/1",
    }
}

