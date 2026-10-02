from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User, QuotationRequestDB
from app.services.auth_dependency import get_current_user

router = APIRouter(
    prefix="/api/admin-users",
    tags=["Admin Users"]
)


# =========================================================
# GET ALL REGISTERED CUSTOMERS
# GET /api/admin-users/
# =========================================================

@router.get("/")
def get_admin_users(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only admin can access this endpoint
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    users = (
        db.query(User)
        .filter(User.role == "customer")
        .order_by(User.id.desc())
        .all()
    )

    user_list = []

    for user in users:
        user_list.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "company_name": user.company_name,
            "role": user.role,
            "is_verified": user.is_verified,
            "created_at": (
                user.created_at.isoformat()
                if user.created_at
                else None
            ),
        })

    return {
        "success": True,
        "total_users": len(user_list),
        "users": user_list,
    }


# =========================================================
# GET ACTIVITY AND QUOTATIONS FOR ONE CUSTOMER
# GET /api/admin-users/{user_id}/activity
# =========================================================

@router.get("/{user_id}/activity")
def get_user_activity(
    user_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only admin can access customer activity
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    # Find the selected customer
    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.role == "customer"
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Customer not found."
        )

    # Fetch this customer's quotations only
    quotation_records = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(QuotationRequestDB.created_at.desc())
        .all()
    )

    quotations = []

    approved_count = 0
    pending_count = 0
    rejected_count = 0

    for quotation in quotation_records:
        status = (quotation.status or "pending").strip().lower()

        if status == "approved":
            approved_count += 1
        elif status == "pending":
            pending_count += 1
        elif status == "rejected":
            rejected_count += 1

        quotations.append({
            "id": quotation.id,
            "origin": quotation.origin,
            "destination": quotation.destination,
            "cargo_type": quotation.cargo_type,
            "container_type": quotation.container_type,
            "container_count": quotation.container_count,
            "selected_route_id": quotation.selected_route_id,
            "selling_price": (
                float(quotation.selling_price)
                if quotation.selling_price is not None
                else None
            ),
            "status": status,
            "created_at": (
                quotation.created_at.isoformat()
                if quotation.created_at
                else None
            ),
        })

    return {
        "success": True,

        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "company_name": user.company_name,
            "is_verified": user.is_verified,
            "created_at": (
                user.created_at.isoformat()
                if user.created_at
                else None
            ),
        },

        "summary": {
            "total_quotations": len(quotation_records),
            "approved_quotations": approved_count,
            "pending_quotations": pending_count,
            "rejected_quotations": rejected_count,
        },

        "quotations": quotations,
    }