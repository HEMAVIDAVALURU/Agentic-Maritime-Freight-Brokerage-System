from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import AuthService
from app.services.auth_dependency import get_current_user
from app.services.jwt_service import JWTService


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# =========================================================
# REGISTER REQUEST
# =========================================================

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str | None = None


# =========================================================
# OTP VERIFICATION REQUEST
# =========================================================

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


# =========================================================
# RESEND OTP REQUEST
# =========================================================

class ResendOTPRequest(BaseModel):
    email: EmailStr


# =========================================================
# LOGIN REQUEST
# =========================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =========================================================
# REGISTER CUSTOMER
# =========================================================

@router.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.register_customer(
        db=db,
        name=request.name,
        email=request.email,
        password=request.password
    )

    return result


# =========================================================
# VERIFY OTP
# =========================================================

@router.post("/verify-otp")
def verify_otp(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.verify_otp(
        db=db,
        email=request.email,
        otp=request.otp
    )

    return result


# =========================================================
# RESEND OTP
# =========================================================

@router.post("/resend-otp")
def resend_otp(
    request: ResendOTPRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.resend_otp(
        db=db,
        email=request.email
    )

    return result


# =========================================================
# CUSTOMER LOGIN
# =========================================================

@router.post("/login")
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    result = AuthService.login_customer(
        db=db,
        email=request.email,
        password=request.password
    )

    if result.get("status") != "success":
        return result

    access_token = result.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=500,
            detail="Authentication token was not generated."
        )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=JWTService.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    result.pop("access_token", None)

    return result


# =========================================================
# ADMIN LOGIN
# =========================================================

@router.post("/admin-login")
def admin_login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):

    result = AuthService.login_admin(
        db=db,
        email=request.email,
        password=request.password
    )

    if result.get("status") != "success":
        return result

    access_token = result.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=500,
            detail="Authentication token was not generated."
        )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=JWTService.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    result.pop("access_token", None)

    return result


# =========================================================
# CURRENT LOGGED-IN USER / ADMIN
# =========================================================

@router.get("/me")
def get_me(
    current_user=Depends(get_current_user)
):

    if hasattr(current_user, "role"):
        role = current_user.role
    else:
        role = "admin"

    company_name = getattr(
        current_user,
        "company_name",
        None
    )

    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "company_name": company_name,
            "role": role
        }
    }


# =========================================================
# LOGOUT
# =========================================================

@router.post("/logout")
def logout(
    response: Response
):

    response.delete_cookie(
        key="access_token",
        path="/"
    )

    return {
        "success": True,
        "message": "Logout successful"
    }