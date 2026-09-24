from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User, Admin
from app.services.jwt_service import JWTService


# =========================================================
# GET CURRENT AUTHENTICATED USER
# =========================================================

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # Get JWT from HTTP-only cookie
    # -----------------------------------------------------

    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # -----------------------------------------------------
    # Decode JWT
    # -----------------------------------------------------

    try:

        payload = jwt.decode(
            token,
            JWTService.SECRET_KEY,
            algorithms=[JWTService.ALGORITHM]
        )

        user_id = payload.get("user_id")
        role = payload.get("role")

        # -------------------------------------------------
        # Validate token payload
        # -------------------------------------------------

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

        if not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )

    # =====================================================
    # ADMIN AUTHENTICATION
    # =====================================================

    if role == "admin":

        admin = (
            db.query(Admin)
            .filter(Admin.id == user_id)
            .first()
        )

        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin not found"
            )

        # -------------------------------------------------
        # Check whether admin is active
        # -------------------------------------------------

        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin account is inactive"
            )

        return admin

    # =====================================================
    # CUSTOMER AUTHENTICATION
    # =====================================================

    if role == "customer":

        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        return user

    # =====================================================
    # UNKNOWN ROLE
    # =====================================================

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication role"
    )