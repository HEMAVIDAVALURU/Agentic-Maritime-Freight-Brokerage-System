
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from html import escape

import logging

from app.services.email_service import EmailService


from app.database import get_db
from app.db_models import (
    Shipment,
    ShipmentStatusHistory,
    Admin,
    Payment,
    QuotationRequestDB,
    ShipmentCancellationRequest,
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


def send_cancellation_request_email_to_admins(
    db,
    shipment,
    customer,
    reason,
):
    """Notify administrators about a customer's cancellation request."""

    admin_emails = (
        db.query(Admin.email)
        .filter(Admin.email.isnot(None))
        .all()
    )

    admin_emails = list(
        dict.fromkeys(
            email.strip()
            for (email,) in admin_emails
            if email and email.strip()
        )
    )

    if not admin_emails:
        logger.warning(
            "Cancellation email skipped: no admin email configured."
        )
        return

    customer_name = (
        getattr(customer, "name", None)
        or getattr(customer, "username", None)
        or getattr(customer, "full_name", None)
        or "Customer"
    )

    subject = f"Shipment Cancellation Request - {shipment.shipment_id}"

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Shipment Cancellation Request</h2>
        <p>A customer has requested cancellation of a shipment.</p>

        <p><b>Customer:</b> {escape(str(customer_name))}</p>
        <p><b>Customer ID:</b> {escape(str(customer.id))}</p>
        <p><b>Shipment ID:</b> {escape(str(shipment.shipment_id))}</p>
        <p><b>Quotation ID:</b> {escape(str(shipment.quotation_id))}</p>
        <p><b>Origin:</b> {escape(str(shipment.origin or ""))}</p>
        <p><b>Destination:</b> {escape(str(shipment.destination or ""))}</p>
        <p><b>Cancellation Reason:</b> {escape(str(reason))}</p>
        <p><b>Request Status:</b> Pending Admin Review</p>

        <p>Please open the admin dashboard to review this request.</p>
      </body>
    </html>
    """

    for admin_email in admin_emails:
        try:
            result = EmailService.send_email(
                recipient_email=admin_email,
                subject=subject,
                html_content=html_content,
            )

            if not result or not result.get("success"):
                logger.error(
                    "Cancellation request email failed for admin %s, "
                    "shipment %s",
                    admin_email,
                    shipment.shipment_id,
                )

        except Exception:
            logger.exception(
                "Error sending cancellation request email to admin %s",
                admin_email,
            )



# CUSTOMER: REQUEST SHIPMENT CANCELLATION
@router.post("/{shipment_id}/cancellation-request")
def request_shipment_cancellation(
    shipment_id: str,
    reason: str = Body(..., embed=True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cleaned_reason = reason.strip()

    if not cleaned_reason:
        raise HTTPException(
            status_code=400,
            detail="Please provide a cancellation reason.",
        )

    if len(cleaned_reason) > 500:
        raise HTTPException(
            status_code=400,
            detail="Cancellation reason cannot exceed 500 characters.",
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

    if shipment.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot request cancellation of another customer's shipment.",
        )

    if (shipment.status or "").lower() in {"cancelled", "delivered"}:
        raise HTTPException(
            status_code=400,
            detail="Cancellation cannot be requested for a cancelled or delivered shipment.",
        )

    existing_request = (
        db.query(ShipmentCancellationRequest)
        .filter(
            ShipmentCancellationRequest.shipment_id == shipment_id,
            ShipmentCancellationRequest.user_id == current_user.id,
            ShipmentCancellationRequest.status == "pending",
        )
        .first()
    )

    if existing_request:
        raise HTTPException(
            status_code=409,
            detail="A cancellation request is already pending for this shipment.",
        )

    try:
        cancellation_request = ShipmentCancellationRequest(
            shipment_id=shipment.shipment_id,
            user_id=current_user.id,
            reason=cleaned_reason,
            status="pending",
        )

        db.add(cancellation_request)
        db.commit()
        db.refresh(cancellation_request)

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to create cancellation request for shipment %s",
            shipment_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Could not submit the cancellation request.",
        )

    
    # Send admin notification after the request is committed.
    try:
        from app.db_models import User

        customer = (
            db.query(User)
            .filter(User.id == current_user.id)
            .first()
        )

        if customer:
            send_cancellation_request_email_to_admins(
                db=db,
                shipment=shipment,
                customer=customer,
                reason=cleaned_reason,
            )
        else:
            logger.warning(
                "Cancellation email skipped: customer %s not found.",
                current_user.id,
            )

    except Exception:
        logger.exception(
            "Could not notify admins about cancellation request %s",
            shipment_id,
        )


    return {
        "success": True,
        "message": "Cancellation request submitted for admin review.",
        "request": {
            "id": cancellation_request.id,
            "shipment_id": cancellation_request.shipment_id,
            "reason": cancellation_request.reason,
            "status": cancellation_request.status,
            "created_at": cancellation_request.created_at,
        },
        "shipment_status": shipment.status,
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



# ADMIN: LIST SHIPMENT CANCELLATION REQUESTS
@router.get("/admin/cancellation-requests")
def get_cancellation_requests(
    status: str = "pending",
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    requested_status = status.strip().lower()

    if requested_status not in {"pending", "approved", "rejected", "all"}:
        raise HTTPException(
            status_code=400,
            detail="Status must be pending, approved, rejected, or all.",
        )

    query = db.query(ShipmentCancellationRequest)

    if requested_status != "all":
        query = query.filter(
            ShipmentCancellationRequest.status == requested_status
        )

    requests = query.order_by(
        ShipmentCancellationRequest.created_at.desc()
    ).all()

    return {
        "success": True,
        "total": len(requests),
        "requests": [
            {
                "id": item.id,
                "shipment_id": item.shipment_id,
                "user_id": item.user_id,
                "reason": item.reason,
                "status": item.status,
                "admin_note": item.admin_note,
                "reviewed_by_admin_id": item.reviewed_by_admin_id,
                "created_at": item.created_at,
                "reviewed_at": item.reviewed_at,
            }
            for item in requests
        ],
    }


# ADMIN: APPROVE OR REJECT CANCELLATION REQUEST
@router.patch("/admin/cancellation-requests/{request_id}")
def review_cancellation_request(
    request_id: int,
    decision: str = Body(..., embed=True),
    admin_note: str | None = Body(default=None, embed=True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    cleaned_decision = decision.strip().lower()
    cleaned_admin_note = (admin_note or "").strip() or None

    if cleaned_decision not in {"approved", "rejected"}:
        raise HTTPException(
            status_code=400,
            detail="Decision must be approved or rejected.",
        )

    if cleaned_admin_note and len(cleaned_admin_note) > 500:
        raise HTTPException(
            status_code=400,
            detail="Admin note cannot exceed 500 characters.",
        )

    if cleaned_decision == "rejected" and not cleaned_admin_note:
        raise HTTPException(
            status_code=400,
            detail="Please provide a reason for rejecting the request.",
        )

    cancellation_request = (
        db.query(ShipmentCancellationRequest)
        .filter(ShipmentCancellationRequest.id == request_id)
        .with_for_update()
        .first()
    )

    if not cancellation_request:
        raise HTTPException(
            status_code=404,
            detail="Cancellation request not found.",
        )

    if cancellation_request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="This cancellation request has already been reviewed.",
        )

    shipment = (
        db.query(Shipment)
        .filter(
            Shipment.shipment_id == cancellation_request.shipment_id
        )
        .with_for_update()
        .first()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found.",
        )

    old_status = (shipment.status or "").lower()

    if old_status in {"cancelled", "delivered"}:
        raise HTTPException(
            status_code=409,
            detail=(
                "This shipment is already cancelled or delivered. "
                "The cancellation request cannot be approved or rejected."
            ),
        )

    admin_id = (
        db.query(Admin.id)
        .filter(Admin.email == current_user.email)
        .scalar()
    )

    if admin_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin account could not be verified.",
        )

    now = datetime.now()

    try:
        cancellation_request.status = cleaned_decision
        cancellation_request.admin_note = cleaned_admin_note
        cancellation_request.reviewed_by_admin_id = admin_id
        cancellation_request.reviewed_at = now

        if cleaned_decision == "approved":
            shipment.status = "cancelled"
            shipment.cancelled_at = now
            shipment.cancellation_reason = cancellation_request.reason

            db.add(
                ShipmentStatusHistory(
                    shipment_id=shipment.shipment_id,
                    previous_status=old_status,
                    new_status="cancelled",
                    note=(
                        f"Cancellation request approved. "
                        f"Customer reason: {cancellation_request.reason}"
                        + (
                            f" | Admin note: {cleaned_admin_note}"
                            if cleaned_admin_note
                            else ""
                        )
                    ),
                    updated_by_admin_id=admin_id,
                )
            )

        db.commit()
        db.refresh(cancellation_request)
        db.refresh(shipment)

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to review cancellation request %s",
            request_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Could not review the cancellation request.",
        )

    if cleaned_decision == "approved":
        try:
            from app.db_models import User

            customer = (
                db.query(User)
                .filter(User.id == shipment.user_id)
                .first()
            )

            if (
                customer
                and getattr(customer, "email_notifications", True)
            ):
                send_shipment_email_safely(
                    customer_email=getattr(customer, "email", None),
                    customer_name=(
                        getattr(customer, "name", None) or "Customer"
                    ),
                    shipment=shipment,
                    status="cancelled",
                    note=cancellation_request.reason,
                )

        except Exception:
            logger.exception(
                "Could not send cancellation email for shipment %s",
                shipment.shipment_id,
            )

    return {
        "success": True,
        "message": (
            "Cancellation request approved and shipment cancelled."
            if cleaned_decision == "approved"
            else "Cancellation request rejected. Shipment status unchanged."
        ),
        "request": {
            "id": cancellation_request.id,
            "shipment_id": cancellation_request.shipment_id,
            "reason": cancellation_request.reason,
            "status": cancellation_request.status,
            "admin_note": cancellation_request.admin_note,
            "reviewed_at": cancellation_request.reviewed_at,
        },
        "shipment": shipment_to_dict(shipment, db),
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

