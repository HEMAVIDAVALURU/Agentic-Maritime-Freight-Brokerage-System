
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    User,
    QuotationRequestDB,
    Payment,
    Shipment,
)
from app.services.auth_dependency import get_current_user

router = APIRouter(
    prefix="/api/admin-users",
    tags=["Admin Users"]
)


def serialize_date(value):
    return value.isoformat() if value else None


# =========================================================
# GET ALL REGISTERED CUSTOMERS
# =========================================================

@router.get("/")
def get_admin_users(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    return {
        "success": True,
        "total_users": len(users),
        "users": [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "company_name": user.company_name,
                "role": user.role,
                "is_verified": user.is_verified,
                "created_at": serialize_date(user.created_at),
            }
            for user in users
        ],
    }


# =========================================================
# GET CUSTOMER ACTIVITY
# GET /api/admin-users/{user_id}/activity
# =========================================================

@router.get("/{user_id}/activity")
def get_user_activity(
    user_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

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

    quotation_records = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(QuotationRequestDB.created_at.desc())
        .all()
    )

    payment_records = (
        db.query(Payment)
        .filter(Payment.user_id == user_id)
        .order_by(
            Payment.submitted_at.desc(),
            Payment.id.desc()
        )
        .all()
    )

    shipment_records = (
        db.query(Shipment)
        .filter(Shipment.user_id == user_id)
        .all()
    )

    # Latest payment record per quotation.
    # Older rejected/repaid records remain in the database.
    latest_payments = {}

    for payment in payment_records:
        if payment.quotation_id not in latest_payments:
            latest_payments[payment.quotation_id] = payment

    # One shipment per quotation, as enforced by the model.
    shipments_by_quotation = {
        shipment.quotation_id: shipment
        for shipment in shipment_records
    }

    approved_count = 0
    pending_count = 0
    rejected_count = 0
    quotations = []

    for quotation in quotation_records:
        quotation_status = (
            quotation.status or "pending"
        ).strip().lower()

        if quotation_status == "approved":
            approved_count += 1
        elif quotation_status == "rejected":
            rejected_count += 1
        else:
            pending_count += 1

        payment = latest_payments.get(quotation.id)
        shipment = shipments_by_quotation.get(quotation.id)

        payment_status = (
            (payment.status or "").strip().lower()
            if payment
            else "not_paid"
        )

        shipment_status = (
            (shipment.status or "").strip().lower()
            if shipment
            else "not_booked"
        )

        quotations.append({
            "id": quotation.id,
            "origin": (
                shipment.origin if shipment else quotation.origin
            ),
            "destination": (
                shipment.destination
                if shipment else quotation.destination
            ),
            "cargo_type": quotation.cargo_type,
            "container_type": quotation.container_type,
            "container_count": quotation.container_count,
            "selected_route_id": quotation.selected_route_id,
            "selling_price": (
                float(quotation.selling_price)
                if quotation.selling_price is not None
                else None
            ),
            "status": quotation_status,
            "created_at": serialize_date(quotation.created_at),

            "payment_id": payment.id if payment else None,
            "payment_status": payment_status,
            "payment_amount": (
                float(payment.amount) if payment else None
            ),
            "payment_submitted_at": (
                serialize_date(payment.submitted_at)
                if payment else None
            ),

            "shipment_id": (
                shipment.shipment_id if shipment else None
            ),
            "route_id": (
                shipment.route_id
                if shipment else quotation.selected_route_id
            ),
            "shipment_status": shipment_status,
            "shipment_booked_at": (
                serialize_date(shipment.booked_at)
                if shipment else None
            ),
            "shipment_delivered_at": (
                serialize_date(shipment.delivered_at)
                if shipment else None
            ),
        })

    active_or_completed_shipments = sum(
        1
        for shipment in shipment_records
        if (shipment.status or "").strip().lower() != "cancelled"
    )

    delivered_shipments = sum(
        1
        for shipment in shipment_records
        if (shipment.status or "").strip().lower() == "delivered"
    )

    completed_payments = sum(
        1
        for payment in payment_records
        if (payment.status or "").strip().lower() == "verified"
    )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "company_name": user.company_name,
            "is_verified": user.is_verified,
            "created_at": serialize_date(user.created_at),
        },
        "summary": {
            "total_quotations": len(quotation_records),
            "approved_quotations": approved_count,
            "pending_quotations": pending_count,
            "rejected_quotations": rejected_count,
            "completed_payments": completed_payments,
            "shipments_booked": active_or_completed_shipments,
            "successfully_delivered": delivered_shipments,
        },
        "quotations": quotations,
    }
