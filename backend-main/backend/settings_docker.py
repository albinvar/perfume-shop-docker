"""
Docker-specific Django settings
Inherits from base settings and overrides for containerized environment
"""
from .settings import *
import os

# Override database settings for Docker
if os.environ.get('DOCKER_ENV', False):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'perfume_shop'),
            'USER': os.environ.get('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.environ.get('DB_HOST', 'db'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }

    # Allow connections from Docker network
    ALLOWED_HOSTS = ['*']

    # Disable SSL redirect for local development
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

    # CORS settings for Docker
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:19006",
        "http://localhost:8081",
        "http://app:3000",
    ]

    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:19006",
        "http://localhost:8081",
        "http://app:3000",
    ]