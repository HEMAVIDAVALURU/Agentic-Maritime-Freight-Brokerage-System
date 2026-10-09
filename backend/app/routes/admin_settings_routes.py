from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import Admin
from app.services.auth_dependency import get_current_user
from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/api/admin/settings",
    tags=["Admin Settings"]
)


# ============================================================
# PROFILE REQUEST
# ============================================================

class AdminProfileUpdate(BaseModel):
    name: str = ""
    mobile_number: str = ""
    city: str = ""
    gender: str = ""


# ============================================================
# EMAIL UPDATE REQUEST
# ============================================================

class AdminEmailUpdate(BaseModel):
    current_email: EmailStr
    new_email: EmailStr


# ============================================================
# NOTIFICATION REQUEST
# ============================================================

class AdminNotificationUpdate(BaseModel):
    email_notifications: bool
    quotation_alerts: bool
    feedback_alerts: bool


# ============================================================
# GET ADMIN PROFILE
# ============================================================

@router.get("/profile")
def get_admin_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    admin = (
        db.query(Admin)
        .filter(Admin.id == current_user.id)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Administrator account not found."
        )

    return {
        "name": admin.name or "",
        "mobile_number": admin.mobile_number or "",
        "city": admin.city or "",
        "email": admin.email or "",
        "gender": admin.gender or ""
    }


# ============================================================
# UPDATE ADMIN PROFILE
# ============================================================

@router.put("/profile")
def update_admin_profile(
    request: AdminProfileUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    admin = (
        db.query(Admin)
        .filter(Admin.id == current_user.id)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Administrator account not found."
        )

    admin.name = request.name.strip()
    admin.mobile_number = request.mobile_number.strip()
    admin.city = request.city.strip()
    admin.gender = request.gender.strip()

    try:
        db.commit()
        db.refresh(admin)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update profile."
        )

    return {
        "success": True,
        "message": "Profile updated successfully.",
        "name": admin.name or "",
        "mobile_number": admin.mobile_number or "",
        "city": admin.city or "",
        "email": admin.email or "",
        "gender": admin.gender or ""
    }


# ============================================================
# CHANGE ADMIN EMAIL
# ============================================================
#
# IMPORTANT:
# Current password is intentionally NOT required.
#
# The request is still protected by the authenticated
# admin session through get_current_user().
# ============================================================

@router.put("/email")
def update_admin_email(
    request: AdminEmailUpdate,
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
        new_email=request.new_email
    )

    if result.get("status") != "success":
        raise HTTPException(
            status_code=400,
            detail=result.get(
                "message",
                "Unable to update email address."
            )
        )

    return result


# ============================================================
# GET NOTIFICATION SETTINGS
# ============================================================

@router.get("/notifications")
def get_notification_settings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    admin = (
        db.query(Admin)
        .filter(Admin.id == current_user.id)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Administrator account not found."
        )

    return {
        "email_notifications": bool(
            admin.email_notifications
        ),
        "quotation_alerts": bool(
            admin.quotation_alerts
        ),
        "feedback_alerts": bool(
            admin.feedback_alerts
        )
    }


# ============================================================
# UPDATE NOTIFICATION SETTINGS
# ============================================================

@router.put("/notifications")
def update_notification_settings(
    request: AdminNotificationUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    admin = (
        db.query(Admin)
        .filter(Admin.id == current_user.id)
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Administrator account not found."
        )

    email_notifications = request.email_notifications

    admin.email_notifications = email_notifications

    # --------------------------------------------------------
    # MASTER SWITCH OFF
    # --------------------------------------------------------

    if not email_notifications:

        admin.quotation_alerts = False
        admin.feedback_alerts = False

    else:

        admin.quotation_alerts = request.quotation_alerts
        admin.feedback_alerts = request.feedback_alerts

    try:
        db.commit()
        db.refresh(admin)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to update notification settings."
        )

    return {
        "success": True,
        "message": "Notification settings updated successfully.",
        "email_notifications": bool(
            admin.email_notifications
        ),
        "quotation_alerts": bool(
            admin.quotation_alerts
        ),
        "feedback_alerts": bool(
            admin.feedback_alerts
        )
    }