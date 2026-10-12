
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

import logging

from app.services.email_service import EmailService

from app.database import get_db
from app.db_models import (
    Shipment,
    ShipmentStatusHistory,
    Admin,
    Payment,
    QuotationRequestDB,
)
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/shipments",
    tags=["Shipments"],
)

ALLOWED_STATUSES = {
    "booked",
    "pickup",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "cancelled",
}

PROGRESS_STATUSES = {
    "pickup",
    "in_transit",
    "out_for_delivery",
    "delivered",
}


def require_admin(current_user):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )


def money(value):
    return Decimal(str(value or 0)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def get_payment_summary(shipment, db):
    quotation = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.id == shipment.quotation_id)
        .first()
    )

    total = money(quotation.selling_price) if quotation else Decimal("0.00")

    payments = (
        db.query(Payment)
        .filter(
            Payment.quotation_id == shipment.quotation_id,
            Payment.user_id == shipment.user_id,
        )
        .all()
    )

    paid = sum(
        (
            money(payment.amount)
            for payment in payments
            if payment.status == "verified"
        ),
        Decimal("0.00"),
    )

    pending = sum(
        (
            money(payment.amount)
            for payment in payments
            if payment.status == "pending_verification"
        ),
        Decimal("0.00"),
    )

    remaining = max(Decimal("0.00"), total - paid)

    if total > 0 and paid >= total:
        status = "paid"
    elif pending > 0:
        status = "pending_verification"
    elif paid > 0:
        status = "partially_paid"
    else:
        status = "unpaid"

    return {
        "payment_status": status,
        "total_amount": float(total),
        "paid_amount": float(paid),
        "pending_verification_amount": float(pending),
        "remaining_amount": float(remaining),
        "currency": "USD",
    }


def shipment_to_dict(shipment, db):
    result = {
        "shipment_id": shipment.shipment_id,
        "quotation_id": shipment.quotation_id,
        "user_id": shipment.user_id,
        "route_id": shipment.route_id,
        "origin": shipment.origin,
        "destination": shipment.destination,
        "cargo_type": shipment.cargo_type,
        "container_type": shipment.container_type,
        "container_count": shipment.container_count,
        "status": shipment.status,
        "estimated_arrival": shipment.estimated_arrival,
        "booked_at": shipment.booked_at,
        "delivered_at": shipment.delivered_at,
        "cancelled_at": shipment.cancelled_at,
        "cancellation_reason": shipment.cancellation_reason,
    }

    result.update(get_payment_summary(shipment, db))
    return result

logger = logging.getLogger(__name__)


def send_shipment_email_safely(
    customer_email,
    customer_name,
    shipment,
    status,
    note=None,
):
    """
    Send customer emails only for booked and delivered statuses.
    Email failures must not affect shipment updates.
    """

    if status not in {"booked", "delivered","cancelled"}:
        return

    if not customer_email:
        logger.warning(
            "Shipment email skipped: customer email missing. "
            "Shipment ID: %s",
            shipment.shipment_id,
        )
        return

    try:
        result = EmailService.send_shipment_status_email(
            customer_email=customer_email,
            customer_name=customer_name,
            shipment_id=shipment.shipment_id,
            quotation_id=shipment.quotation_id,
            origin=shipment.origin,
            destination=shipment.destination,
            status=status,
            note=note,
        )

        if not result or not result.get("success"):
            logger.error(
                "Shipment email failed. Shipment ID: %s, status: %s",
                shipment.shipment_id,
                status,
            )

    except Exception:
        logger.exception(
            "Shipment email error. Shipment ID: %s, status: %s",
            shipment.shipment_id,
            status,
        )


# CUSTOMER: LIST THEIR OWN SHIPMENTS
@router.get("/my")
def get_my_shipments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shipments = (
        db.query(Shipment)
        .filter(Shipment.user_id == current_user.id)
        .order_by(Shipment.id.desc())
        .all()
    )

    return {
        "success": True,
        "total": len(shipments),
        "shipments": [
            shipment_to_dict(item, db)
            for item in shipments
        ],
    }


# CUSTOMER / ADMIN: SHIPMENT DETAILS AND HISTORY
@router.get("/{shipment_id}")
def get_shipment_details(
    shipment_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shipment = (
        db.query(Shipment)
        .filter(Shipment.shipment_id == shipment_id)
        .first()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found.",
        )

    is_admin = getattr(current_user, "role", None) == "admin"

    if not is_admin and shipment.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another customer's shipment.",
        )

    history = (
        db.query(ShipmentStatusHistory)
        .filter(
            ShipmentStatusHistory.shipment_id
            == shipment.shipment_id
        )
        .order_by(ShipmentStatusHistory.created_at.asc())
        .all()
    )

    result = shipment_to_dict(shipment, db)
    result["history"] = [
        {
            "previous_status": item.previous_status,
            "new_status": item.new_status,
            "note": item.note,
            "created_at": item.created_at,
        }
        for item in history
    ]

    return {
        "success": True,
        "shipment": result,
    }


# ADMIN: ALL SHIPMENTS
@router.get("/admin/all")
def get_all_shipments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    shipments = (
        db.query(Shipment)
        .order_by(Shipment.id.desc())
        .all()
    )

    return {
        "success": True,
        "total": len(shipments),
        "shipments": [
            shipment_to_dict(item, db)
            for item in shipments
        ],
    }


# ADMIN: UPDATE SHIPMENT STATUS
@router.patch("/admin/{shipment_id}/status")
def update_shipment_status(
    shipment_id: str,
    status: str = Body(..., embed=True),
    note: str | None = Body(default=None, embed=True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    new_status = status.strip().lower()

    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid shipment status.",
                "allowed_statuses": sorted(ALLOWED_STATUSES),
            },
        )

    shipment = (
        db.query(Shipment)
        .filter(Shipment.shipment_id == shipment_id)
        .with_for_update()
        .first()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found.",
        )

    old_status = (shipment.status or "").lower()

    if old_status == new_status:
        raise HTTPException(
            status_code=400,
            detail="Shipment already has this status.",
        )

    if old_status in {"delivered", "cancelled"}:
        raise HTTPException(
            status_code=400,
            detail="Delivered or cancelled shipments cannot be changed.",
        )

    # Prevent delivery progress until the full quotation amount
    # has been verified by an admin.
    if new_status in PROGRESS_STATUSES:
        payment_summary = get_payment_summary(shipment, db)

        if payment_summary["payment_status"] != "paid":
            raise HTTPException(
                status_code=400,
                detail={
                    "message": (
                        "Shipment progress is blocked until "
                        "the full quotation amount is verified."
                    ),
                    "payment_status": payment_summary["payment_status"],
                    "total_amount": payment_summary["total_amount"],
                    "paid_amount": payment_summary["paid_amount"],
                    "remaining_amount": payment_summary["remaining_amount"],
                },
            )

    cleaned_note = (note or "").strip() or None

    if new_status == "cancelled" and not cleaned_note:
        raise HTTPException(
            status_code=400,
            detail="Please provide a cancellation reason.",
        )

    try:
        shipment.status = new_status

        if new_status == "delivered":
            shipment.delivered_at = datetime.now()

        if new_status == "cancelled":
            shipment.cancelled_at = datetime.now()
            shipment.cancellation_reason = cleaned_note

        admin_id = (
            db.query(Admin.id)
            .filter(Admin.email == current_user.email)
            .scalar()
        )

        history = ShipmentStatusHistory(
            shipment_id=shipment.shipment_id,
            previous_status=old_status,
            new_status=new_status,
            note=cleaned_note,
            updated_by_admin_id=admin_id,
        )

        db.add(history)
        db.commit()
        db.refresh(shipment)

    
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update shipment status.",
        )

    # Send customer email only for booked and delivered.
    # The database update has already been committed.
    if new_status in {"booked", "delivered","cancelled"}:
        try:
            from app.db_models import User

            customer = (
                db.query(User)
                .filter(User.id == shipment.user_id)
                .first()
            )

            if customer:
                customer_email = getattr(customer, "email", None)

                customer_name = (
                    getattr(customer, "name", None)
                    or getattr(customer, "username", None)
                    or getattr(customer, "full_name", None)
                    or "Customer"
                )

                if getattr(customer, "email_notifications", True):
                    send_shipment_email_safely(
                        customer_email=customer_email,
                        customer_name=customer_name,
                        shipment=shipment,
                        status=new_status,
                        note=cleaned_note,
                    )

        except Exception:
            logger.exception(
                "Could not notify customer about shipment %s",
                shipment.shipment_id,
            )

    return {
        "success": True,
        "message": "Shipment status updated successfully.",
        "shipment": shipment_to_dict(shipment, db),
    }

