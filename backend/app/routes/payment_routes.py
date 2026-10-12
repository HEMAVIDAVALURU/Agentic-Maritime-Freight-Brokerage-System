
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    Admin,
    Payment,
    PaymentStatusHistory,
    QuotationRequestDB,
    Shipment,
    User,
)
from app.services.auth_dependency import get_current_user
from app.services.email_service import EmailService


router = APIRouter(
    prefix="/api/payments",
    tags=["Payments"],
)

logger = logging.getLogger(__name__)


ALLOWED_METHODS = {
    "upi",
    "net_banking",
    "card",
    "offline",
}


class PaymentRequest(BaseModel):
    quotation_id: int = Field(gt=0)
    payment_method: str
    payment_reference: str | None = Field(
        default=None,
        max_length=255,
    )
    proof_description: str | None = Field(
        default=None,
        max_length=2000,
    )


class AdminPaymentDecision(BaseModel):
    action: str
    note: str | None = Field(
        default=None,
        max_length=2000,
    )


def require_customer(user):
    if getattr(user, "role", None) != "customer":
        raise HTTPException(
            status_code=403,
            detail="Customer access required.",
        )


def require_admin(user):
    if getattr(user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )


def money(value):
    return Decimal(str(value or 0)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def send_email_safely(method_name, **kwargs):
    """
    Attempt to send an email and log the result.
    Email failures must not undo a successfully committed payment.
    """
    recipient = (
        kwargs.get("customer_email")
        or kwargs.get("admin_email")
        or kwargs.get("recipient_email")
        or "unknown"
    )

    try:
        method = getattr(EmailService, method_name)
        result = method(**kwargs)

        if (
            isinstance(result, dict)
            and result.get("success") is False
        ):
            logger.error(
                "EMAIL FAILED | method=%s | recipient=%s | result=%s",
                method_name,
                recipient,
                result,
            )
        else:
            logger.info(
                "EMAIL RESULT | method=%s | recipient=%s | result=%s",
                method_name,
                recipient,
                result,
            )

        return result

    except Exception:
        logger.exception(
            "EMAIL EXCEPTION | method=%s | recipient=%s",
            method_name,
            recipient,
        )
        return None


def get_shipment_for_quotation(db, quotation_id):
    return (
        db.query(Shipment)
        .filter(
            Shipment.quotation_id == quotation_id
        )
        .first()
    )


def notify_payment_request(db, payment, quotation):
    """
    Payment request submitted:
    Notify active admins only.

    The customer must not receive an email when submitting
    a payment verification request.
    """
    customer = (
        db.query(User)
        .filter(User.id == payment.user_id)
        .first()
    )

    shipment = get_shipment_for_quotation(
        db,
        payment.quotation_id,
    )

    shipment_id = (
        shipment.shipment_id
        if shipment
        else None
    )

    customer_name = (
        getattr(customer, "name", None)
        or getattr(customer, "username", None)
        or getattr(customer, "full_name", None)
        or "Customer"
    )

    admins = (
        db.query(Admin)
        .filter(Admin.is_active.is_(True))
        .all()
    )

    for admin in admins:
        if not getattr(admin, "email", None):
            continue

        if not getattr(
            admin,
            "email_notifications",
            True,
        ):
            continue

        if not getattr(
            admin,
            "payment_alerts",
            True,
        ):
            continue

        send_email_safely(
            "send_payment_request_admin_email",
            admin_email=admin.email,
            customer_name=customer_name,
            quotation_id=payment.quotation_id,
            amount=float(money(payment.amount)),
            payment_method=payment.payment_method,
            shipment_id=shipment_id,
        )



def notify_payment_decision(
    db,
    payment,
    quotation,
    action,
):
    """
    Notify the customer after payment verification or rejection.
    Rejection emails include the administrator's reason.
    """

    if action not in {"verify", "reject"}:
        logger.info(
            "PAYMENT EMAIL SKIPPED | payment_id=%s | action=%s",
            payment.id,
            action,
        )
        return

    customer = (
        db.query(User)
        .filter(User.id == payment.user_id)
        .first()
    )

    if not customer or not getattr(customer, "email", None):
        logger.warning(
            "PAYMENT EMAIL SKIPPED | payment_id=%s | "
            "reason=no_customer_email",
            payment.id,
        )
        return

    # Respect customer notification preferences.
    if not getattr(customer, "email_notifications", True):
        logger.info(
            "PAYMENT EMAIL SKIPPED | payment_id=%s | "
            "reason=email_notifications_disabled",
            payment.id,
        )
        return

    if not getattr(customer, "payment_notifications", True):
        logger.info(
            "PAYMENT EMAIL SKIPPED | payment_id=%s | "
            "reason=payment_notifications_disabled",
            payment.id,
        )
        return

    shipment = get_shipment_for_quotation(
        db,
        payment.quotation_id,
    )

    shipment_id = (
        shipment.shipment_id
        if shipment
        else None
    )

    customer_name = (
        getattr(customer, "name", None)
        or getattr(customer, "username", None)
        or getattr(customer, "full_name", None)
        or "Customer"
    )

    if action == "verify":
        total_amount = (
            money(quotation.selling_price)
            if quotation
            else Decimal("0.00")
        )

        send_email_safely(
            "send_payment_verified_email",
            customer_email=customer.email,
            customer_name=customer_name,
            quotation_id=payment.quotation_id,
            verified_amount=float(money(payment.amount)),
            total_amount=float(total_amount),
            shipment_id=shipment_id,
        )

    elif action == "reject":
        send_email_safely(
            "send_payment_rejected_email",
            customer_email=customer.email,
            customer_name=customer_name,
            quotation_id=payment.quotation_id,
            amount=float(money(payment.amount)),
            rejection_reason=payment.admin_note,
            shipment_id=shipment_id,
        )

   
def payment_to_dict(payment, db):
    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id
            == payment.quotation_id
        )
        .first()
    )

    shipment = get_shipment_for_quotation(
        db,
        payment.quotation_id,
    )

    user = (
        db.query(User)
        .filter(User.id == payment.user_id)
        .first()
    )

    customer_name = (
        getattr(user, "name", None)
        or getattr(user, "username", None)
        or getattr(user, "full_name", None)
        or "Unknown Customer"
    )

    verified_payments = (
        db.query(Payment)
        .filter(
            Payment.quotation_id
            == payment.quotation_id,
            Payment.user_id == payment.user_id,
            Payment.status == "verified",
        )
        .all()
    )

    pending_payments = (
        db.query(Payment)
        .filter(
            Payment.quotation_id
            == payment.quotation_id,
            Payment.user_id == payment.user_id,
            Payment.status == "pending_verification",
        )
        .all()
    )

    total = (
        money(quotation.selling_price)
        if quotation
        else Decimal("0.00")
    )

    paid = sum(
        (
            money(p.amount)
            for p in verified_payments
        ),
        Decimal("0.00"),
    )

    pending = sum(
        (
            money(p.amount)
            for p in pending_payments
        ),
        Decimal("0.00"),
    )

    if total > 0 and paid >= total:
        payment_status = "paid"
    elif pending > 0 and paid > 0:
        payment_status = "partially_paid"
    elif pending > 0:
        payment_status = "pending_verification"
    elif paid > 0:
        payment_status = "partially_paid"
    else:
        payment_status = "unpaid"

    return {
        "id": payment.id,
        "user_id": payment.user_id,
        "customer_name": customer_name,
        "customer_email": (
            getattr(user, "email", None)
        ),
        "customer": {
            "id": user.id,
            "name": customer_name,
            "email": getattr(user, "email", None),
            "company_name": getattr(
                user,
                "company_name",
                None,
            ),
        } if user else None,
        "quotation_id": payment.quotation_id,
        "shipment_id": (
            shipment.shipment_id
            if shipment
            else None
        ),
        "origin": (
            quotation.origin
            if quotation
            else None
        ),
        "destination": (
            quotation.destination
            if quotation
            else None
        ),
        "amount": float(money(payment.amount)),
        "currency": payment.currency,
        "payment_method": payment.payment_method,
        "payment_reference": payment.payment_reference,
        "proof_description": payment.proof_description,
        "status": payment.status,
        "payment_status": payment_status,
        "total_amount": float(total),
        "paid_amount": float(paid),
        "pending_verification_amount": float(pending),
        "remaining_amount": float(
            max(
                Decimal("0.00"),
                total - paid,
            )
        ),
        "admin_note": payment.admin_note,
        "submitted_at": payment.submitted_at,
        "verified_at": payment.verified_at,
        "shipment_status": getattr(
            shipment,
            "status",
            None,
        ),
    }


@router.get("/my")
def get_my_payments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_customer(current_user)

    payments = (
        db.query(Payment)
        .filter(
            Payment.user_id == current_user.id
        )
        .order_by(Payment.id.desc())
        .all()
    )

    result = []

    for payment in payments:
        item = payment_to_dict(payment, db)

        history = (
            db.query(PaymentStatusHistory)
            .filter(
                PaymentStatusHistory.payment_id
                == payment.id
            )
            .order_by(
                PaymentStatusHistory.id.asc()
            )
            .all()
        )

        item["history"] = [
            {
                "old_status": entry.old_status,
                "new_status": entry.new_status,
                "changed_by_role": entry.changed_by_role,
                "note": entry.note,
                "created_at": entry.created_at,
            }
            for entry in history
        ]

        result.append(item)

    return {
        "success": True,
        "payments": result,
    }


@router.get("/summary")
def get_payment_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_customer(current_user)

    quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id
            == current_user.id,
            QuotationRequestDB.status == "approved",
        )
        .order_by(
            QuotationRequestDB.id.desc()
        )
        .all()
    )

    result = []

    for quotation in quotations:
        total = money(quotation.selling_price)

        payments = (
            db.query(Payment)
            .filter(
                Payment.quotation_id == quotation.id,
                Payment.user_id == current_user.id,
            )
            .all()
        )

        paid = sum(
            (
                money(p.amount)
                for p in payments
                if p.status == "verified"
            ),
            Decimal("0.00"),
        )

        pending_verification = sum(
            (
                money(p.amount)
                for p in payments
                if p.status == "pending_verification"
            ),
            Decimal("0.00"),
        )

        remaining = max(
            Decimal("0.00"),
            total - paid - pending_verification,
        )

        result.append({
            "quotation_id": quotation.id,
            "origin": quotation.origin,
            "destination": quotation.destination,
            "cargo_type": quotation.cargo_type,
            "container_type": quotation.container_type,
            "container_count": quotation.container_count,
            "total_amount": float(total),
            "paid_amount": float(paid),
            "pending_verification_amount": float(
                pending_verification
            ),
            "remaining_amount": float(remaining),
            "payment_status": (
                "paid"
                if paid >= total and total > 0
                else "pending_verification"
                if pending_verification > 0
                else "partially_paid"
                if paid > 0
                else "unpaid"
            ),
        })

    return {
        "success": True,
        "quotations": result,
    }


@router.post("/request")
def submit_payment_request(
    request: PaymentRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_customer(current_user)

    method = request.payment_method.strip().lower()

    if method not in ALLOWED_METHODS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid payment method. Use upi, "
                "net_banking, card, or offline."
            ),
        )

    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id
            == request.quotation_id,
            QuotationRequestDB.user_id
            == current_user.id,
        )
        .with_for_update()
        .first()
    )

    if not quotation:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    if quotation.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only approved quotations can be paid."
            ),
        )

    total = money(quotation.selling_price)

    if total <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Quotation selling price must be positive."
            ),
        )

    existing_payments = (
        db.query(Payment)
        .filter(
            Payment.quotation_id == quotation.id,
            Payment.user_id == current_user.id,
        )
        .all()
    )

    paid = sum(
        (
            money(p.amount)
            for p in existing_payments
            if p.status == "verified"
        ),
        Decimal("0.00"),
    )

    awaiting = sum(
        (
            money(p.amount)
            for p in existing_payments
            if p.status == "pending_verification"
        ),
        Decimal("0.00"),
    )

    remaining = total - paid - awaiting

    if remaining <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "No payment amount remains available. "
                "Check payment status."
            ),
        )

    payment = Payment(
        quotation_id=quotation.id,
        user_id=current_user.id,
        amount=float(remaining),
        currency="USD",
        payment_method=method,
        payment_reference=(
            request.payment_reference.strip()
            if request.payment_reference
            else None
        ),
        proof_description=(
            request.proof_description.strip()
            if request.proof_description
            else None
        ),
        status="pending_verification",
    )

    db.add(payment)
    db.flush()

    db.add(
        PaymentStatusHistory(
            payment_id=payment.id,
            old_status=None,
            new_status="pending_verification",
            changed_by=current_user.id,
            changed_by_role="customer",
            note="Demo payment request submitted.",
        )
    )

    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to submit payment request."
            ),
        )

    # Send payment request alert to admins only.
    notify_payment_request(
        db,
        payment,
        quotation,
    )

    return {
        "success": True,
        "message": (
            "Demo payment request submitted. "
            "It is awaiting admin verification; "
            "no money has been transferred."
        ),
        "payment": payment_to_dict(payment, db),
    }


@router.get("/admin/all")
def get_all_payments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    payments = (
        db.query(Payment)
        .order_by(Payment.id.desc())
        .all()
    )

    result = []

    for payment in payments:
        item = payment_to_dict(payment, db)

        user = (
            db.query(User)
            .filter(User.id == payment.user_id)
            .first()
        )

        item["customer"] = {
            "id": (
                user.id
                if user
                else payment.user_id
            ),
            "name": (
                user.name
                if user
                else None
            ),
            "email": (
                user.email
                if user
                else None
            ),
            "company_name": (
                user.company_name
                if user
                else None
            ),
        }

        result.append(item)

    return {
        "success": True,
        "payments": result,
    }


@router.post("/admin/{payment_id}/decision")
def decide_payment(
    payment_id: int,
    request: AdminPaymentDecision,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    action = request.action.strip().lower()

    if action not in {"verify", "reject"}:
        raise HTTPException(
            status_code=400,
            detail="Action must be verify or reject.",
        )

    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id)
        .with_for_update()
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    if payment.status != "pending_verification":
        raise HTTPException(
            status_code=400,
            detail=(
                "This payment has already been reviewed."
            ),
        )

    if action == "reject" and not (
        request.note and request.note.strip()
    ):
        raise HTTPException(
            status_code=400,
            detail="A rejection note is required.",
        )

    old_status = payment.status

    payment.status = (
        "verified"
        if action == "verify"
        else "rejected"
    )

    payment.admin_note = (
        request.note.strip()
        if request.note
        else None
    )

    payment.verified_by = current_user.id
    payment.verified_at = datetime.utcnow()

    db.add(
        PaymentStatusHistory(
            payment_id=payment.id,
            old_status=old_status,
            new_status=payment.status,
            changed_by=current_user.id,
            changed_by_role="admin",
            note=payment.admin_note,
        )
    )

    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to update payment status."
            ),
        )

    # Fetch the quotation after the successful commit.
    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id
            == payment.quotation_id
        )
        .first()
    )

    # Verification emails the customer.
    # Rejection intentionally sends no customer email.
    notify_payment_decision(
        db,
        payment,
        quotation,
        action,
    )

    return {
        "success": True,
        "message": (
            "Payment verified."
            if action == "verify"
            else "Payment rejected."
        ),
        "payment": payment_to_dict(
            payment,
            db,
        ),
    }

