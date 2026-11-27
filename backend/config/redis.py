try:
    import redis
except ImportError:
    redis = None

from django.conf import settings


class RedisCache:
    _client = (
        redis.Redis(
            host=settings.REDIS.get("HOST"),
            port=settings.REDIS.get("PORT"),
            db=settings.REDIS.get("DB"),
            decode_responses=settings.REDIS.get("DECODE_RESPONSES"),
        )
        if redis is not None
        else None
    )

    @staticmethod
    def get(key):
        if RedisCache._client is not None:
            return RedisCache._client.get(key)
        return None

    @staticmethod
    def set(key, value, exe=300):
        if RedisCache._client is not None:
            RedisCache._client.set(key, value, exe)

    @staticmethod
    def delete(key):
        if RedisCache._client is not None:
            RedisCache._client.delete(key)
