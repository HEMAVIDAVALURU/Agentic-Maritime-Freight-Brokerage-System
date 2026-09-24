import os
from datetime import datetime, timedelta, timezone

from jose import jwt
from dotenv import load_dotenv

load_dotenv()


class JWTService:

    SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "maritime_freight_secret_key"
    )

    ALGORITHM = os.getenv(
        "JWT_ALGORITHM",
        "HS256"
    )

    ACCESS_TOKEN_EXPIRE_MINUTES = 60

    @staticmethod
    def create_access_token(user_id: int, role: str):

        expire = datetime.now(timezone.utc) + timedelta(
            minutes=JWTService.ACCESS_TOKEN_EXPIRE_MINUTES
        )

        payload = {
            "user_id": user_id,
            "role": role,
            "exp": expire
        }

        token = jwt.encode(
            payload,
            JWTService.SECRET_KEY,
            algorithm=JWTService.ALGORITHM
        )

        return token