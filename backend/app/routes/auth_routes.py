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
# FORGOT PASSWORD - REQUEST OTP
# =========================================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


# =========================================================
# FORGOT PASSWORD - VERIFY OTP
# =========================================================

class VerifyPasswordResetOTPRequest(BaseModel):
    email: EmailStr
    otp: str


# =========================================================
# FORGOT PASSWORD - RESET PASSWORD
# =========================================================

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


# =========================================================
# LOGIN REQUEST
# =========================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =========================================================
# CHANGE CUSTOMER EMAIL REQUEST
# =========================================================

class ChangeCustomerEmailRequest(BaseModel):
    current_email: EmailStr
    current_password: str
    new_email: EmailStr


# =========================================================
# CHANGE CUSTOMER PASSWORD REQUEST
# =========================================================

class ChangeCustomerPasswordRequest(BaseModel):
    current_password: str
    new_password: str


# =========================================================
# CHANGE ADMIN EMAIL REQUEST
# =========================================================

class ChangeAdminEmailRequest(BaseModel):
    current_email: EmailStr
    current_password: str
    new_email: EmailStr


# =========================================================
# CHANGE ADMIN PASSWORD REQUEST
# =========================================================

class ChangeAdminPasswordRequest(BaseModel):
    current_password: str
    new_password: str


# =========================================================
# UPDATE USER PROFILE REQUEST
# =========================================================

class UpdateUserProfileRequest(BaseModel):
    name: str
    company_name: str | None = None
    phone_number: str | None = None
    city: str | None = None
    gender: str | None = None
    profile_picture: str | None = None


# =========================================================
# UPDATE CUSTOMER NOTIFICATION SETTINGS REQUEST
# =========================================================

class UpdateNotificationSettingsRequest(BaseModel):
    email_notifications: bool
    quotation_notifications: bool
    feedback_notifications: bool


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
        password=request.password,
        company_name=request.company_name
    )

    return result


# =========================================================
# VERIFY REGISTRATION OTP
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
# RESEND REGISTRATION OTP
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
# FORGOT PASSWORD - SEND OTP
# =========================================================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.request_password_reset(
        db=db,
        email=request.email
    )

    return result


# =========================================================
# FORGOT PASSWORD - VERIFY OTP
# =========================================================

@router.post("/forgot-password/verify-otp")
def verify_password_reset_otp(
    request: VerifyPasswordResetOTPRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.verify_password_reset_otp(
        db=db,
        email=request.email,
        otp=request.otp
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Invalid password reset OTP."
            )
        )

    return result


# =========================================================
# FORGOT PASSWORD - RESET PASSWORD
# =========================================================

@router.post("/forgot-password/reset")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):

    result = AuthService.reset_password(
        db=db,
        email=request.email,
        otp=request.otp,
        new_password=request.new_password
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to reset password."
            )
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

            "phone_number": getattr(
                current_user,
                "phone_number",
                None
            ),

            "city": getattr(
                current_user,
                "city",
                None
            ),

            "gender": getattr(
                current_user,
                "gender",
                None
            ),

            "profile_picture": getattr(
                current_user,
                "profile_picture",
                None
            ),

            "is_active": getattr(
                current_user,
                "is_active",
                True
            ),

            "role": role
        }
    }


# =========================================================
# UPDATE CUSTOMER PROFILE
# =========================================================

@router.put("/profile")
def update_user_profile(
    request: UpdateUserProfileRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "customer":

        raise HTTPException(
            status_code=403,
            detail="Customer access required."
        )

    cleaned_name = request.name.strip()

    if not cleaned_name:

        raise HTTPException(
            status_code=400,
            detail="Name cannot be empty."
        )

    current_user.name = cleaned_name

    current_user.company_name = (
        request.company_name.strip()
        if request.company_name
        else None
    )

    current_user.phone_number = (
        request.phone_number.strip()
        if request.phone_number
        else None
    )

    current_user.city = (
        request.city.strip()
        if request.city
        else None
    )

    current_user.gender = (
        request.gender.strip()
        if request.gender
        else None
    )

    current_user.profile_picture = (
        request.profile_picture
        if request.profile_picture
        else None
    )

    try:

        db.commit()
        db.refresh(current_user)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update user profile."
        )

    return {
        "success": True,

        "message":
            "User profile updated successfully.",

        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "company_name": current_user.company_name,
            "phone_number": current_user.phone_number,
            "city": current_user.city,
            "gender": current_user.gender,
            "profile_picture": current_user.profile_picture,
            "is_active": current_user.is_active
        }
    }


# =========================================================
# GET CUSTOMER NOTIFICATION SETTINGS
# =========================================================

@router.get("/notifications")
def get_notification_settings(
    current_user=Depends(get_current_user)
):

    if getattr(current_user, "role", None) != "customer":

        raise HTTPException(
            status_code=403,
            detail="Customer access required."
        )

    return {
        "success": True,

        "notifications": {
            "email_notifications":
                current_user.email_notifications,

            "quotation_notifications":
                current_user.quotation_notifications,

            "feedback_notifications":
                current_user.feedback_notifications
        }
    }


# =========================================================
# UPDATE CUSTOMER NOTIFICATION SETTINGS
# =========================================================

@router.put("/notifications")
def update_notification_settings(
    request: UpdateNotificationSettingsRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "customer":

        raise HTTPException(
            status_code=403,
            detail="Customer access required."
        )

    current_user.email_notifications = (
        request.email_notifications
    )

    if not request.email_notifications:

        current_user.quotation_notifications = False
        current_user.feedback_notifications = False

    else:

        current_user.quotation_notifications = (
            request.quotation_notifications
        )

        current_user.feedback_notifications = (
            request.feedback_notifications
        )

    try:

        db.commit()
        db.refresh(current_user)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update notification preferences."
        )

    return {
        "success": True,

        "message":
            "Notification preferences updated successfully.",

        "notifications": {
            "email_notifications":
                current_user.email_notifications,

            "quotation_notifications":
                current_user.quotation_notifications,

            "feedback_notifications":
                current_user.feedback_notifications
        }
    }


# =========================================================
# CHANGE CUSTOMER EMAIL
# =========================================================

@router.put("/change-email")
def change_customer_email(
    request: ChangeCustomerEmailRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "customer":

        raise HTTPException(
            status_code=403,
            detail="Customer access required."
        )

    result = AuthService.change_customer_email(
        db=db,
        user_id=current_user.id,
        current_email=request.current_email,
        current_password=request.current_password,
        new_email=request.new_email
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to change email."
            )
        )

    return result


# =========================================================
# CHANGE CUSTOMER PASSWORD
# =========================================================

@router.put("/change-password")
def change_customer_password(
    request: ChangeCustomerPasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "customer":

        raise HTTPException(
            status_code=403,
            detail="Customer access required."
        )

    result = AuthService.change_customer_password(
        db=db,
        user_id=current_user.id,
        current_password=request.current_password,
        new_password=request.new_password
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to change password."
            )
        )

    return result


# =========================================================
# CHANGE ADMIN EMAIL
# =========================================================

@router.put("/admin/change-email")
def change_admin_email(
    request: ChangeAdminEmailRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    result = AuthService.change_admin_email(
        db=db,
        admin_id=current_user.id,
        current_email=request.current_email,
        current_password=request.current_password,
        new_email=request.new_email
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to change email."
            )
        )

    return result


# =========================================================
# CHANGE ADMIN PASSWORD
# =========================================================

@router.put("/admin/change-password")
def change_admin_password(
    request: ChangeAdminPasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    result = AuthService.change_admin_password(
        db=db,
        admin_id=current_user.id,
        current_password=request.current_password,
        new_password=request.new_password
    )

    if result.get("status") != "success":

        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to change password."
            )
        )

    return result


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