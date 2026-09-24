from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/admin-users",
    tags=["Admin Users"]
)


@router.get("/")
def get_admin_users(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # =========================================================
    # ADMIN ACCESS CHECK
    # =========================================================

    if current_user.role != "admin":
        return {
            "success": False,
            "message": "Admin access required."
        }

    # =========================================================
    # GET ALL CUSTOMER USERS
    # =========================================================

    users = (
        db.query(User)
        .filter(User.role == "customer")
        .order_by(User.id.desc())
        .all()
    )

    # =========================================================
    # FORMAT USER DATA
    # =========================================================

    user_list = []

    for user in users:
        user_list.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "company_name": user.company_name,
            "role": user.role,
            "is_verified": user.is_verified,
        })

    # =========================================================
    # RESPONSE
    # =========================================================

    return {
        "success": True,
        "total_users": len(user_list),
        "users": user_list
    }