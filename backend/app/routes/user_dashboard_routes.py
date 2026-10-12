
import csv
import os
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    SavedQuotation,
    QuotationRequestDB,
    Route,
    Activity,
    Shipment,
    ShipmentStatusHistory,
    Payment,
    PaymentStatusHistory,
    Feedback,
)
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/user-dashboard",
    tags=["User Dashboard"],
)

logger = logging.getLogger(__name__)

weather_agent = WeatherAgent()
customs_agent = CustomsAgent()

SHIPMENT_STATUSES = [
    "booked",
    "pickup",
    "in_transit",
    "out_for_delivery",
    "delivered",
]


def serialize_datetime(value):
    return value.isoformat() if value else None


def get_total_routes():
    current_file = os.path.abspath(__file__)
    project_root = os.path.dirname(
        os.path.dirname(os.path.dirname(current_file))
    )
    route_file = os.path.join(
        project_root, "app", "data", "route.csv"
    )

    try:
        with open(route_file, "r", encoding="utf-8") as file:
            return sum(
                1 for row in csv.DictReader(file)
                if (row.get("route_id") or "").strip()
            )
    except Exception:
        logger.exception("Could not read route.csv")
        return 0


def get_activity_notification(activity):
    activity_type = activity.activity_type

    details = {
        "quotation_approved": ("Quotation Approved", "✓"),
        "quotation_rejected": ("Quotation Rejected", "×"),
        "feedback_response": ("Admin Feedback Response", "✦"),
        "quotation_approval_requested": ("Quotation Submitted", "◷"),
        "quotation_saved": ("Quotation Saved", "▣"),
    }

    title, icon = details.get(
        activity_type,
        ("Account Update", "•"),
    )

    return {
        "id": f"activity-{activity.id}",
        "type": activity_type,
        "title": title,
        "message": activity.description or title,
        "created_at": serialize_datetime(activity.created_at),
        "icon": icon,
        "related_id": activity.id,
    }


@router.get("/")
def get_user_dashboard(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id

    # -----------------------------------------------------
    # QUOTATIONS
    # -----------------------------------------------------

    total_routes = get_total_routes()

    total_quotations = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .count()
    )

    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "approved",
        )
        .count()
    )

    pending_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "pending",
        )
        .count()
    )

    rejected_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "rejected",
        )
        .count()
    )

    user_quotations = (
        db.query(QuotationRequestDB, Route)
        .join(
            Route,
            Route.route_id == QuotationRequestDB.selected_route_id,
        )
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(QuotationRequestDB.created_at.desc())
        .all()
    )

    freight_values = [
        float(route.base_freight_usd)
        for quotation, route in user_quotations
        if route.base_freight_usd is not None
    ]

    transit_values = [
        float(route.transit_days)
        for quotation, route in user_quotations
        if route.transit_days is not None
    ]

    average_freight_cost = (
        sum(freight_values) / len(freight_values)
        if freight_values else 0
    )

    average_transit_time = (
        sum(transit_values) / len(transit_values)
        if transit_values else 0
    )

    # -----------------------------------------------------
    # SHIPMENTS
    # -----------------------------------------------------

    shipment_query = (
        db.query(Shipment)
        .filter(Shipment.user_id == user_id)
    )

    successful_deliveries = (
        shipment_query
        .filter(Shipment.status == "delivered")
        .count()
    )

    shipment_status_overview = []
    for status in SHIPMENT_STATUSES:
        count = (
            db.query(Shipment)
            .filter(
                Shipment.user_id == user_id,
                Shipment.status == status,
            )
            .count()
        )

        shipment_status_overview.append({
            "status": status,
            "count": count,
        })

    # Keep cancelled shipments visible in the overview too.
    cancelled_shipments = (
        db.query(Shipment)
        .filter(
            Shipment.user_id == user_id,
            Shipment.status == "cancelled",
        )
        .count()
    )

    if cancelled_shipments:
        shipment_status_overview.append({
            "status": "cancelled",
            "count": cancelled_shipments,
        })

    recent_shipment_rows = (
        shipment_query
        .order_by(Shipment.created_at.desc(), Shipment.id.desc())
        .limit(10)
        .all()
    )
    
    # Payment status for recent shipments, linked by quotation_id
    shipment_quotation_ids = {
        item.quotation_id
        for item in recent_shipment_rows
        if item.quotation_id is not None
    }

    payment_rows = (
        db.query(Payment)
        .filter(
            Payment.user_id == user_id,
            Payment.quotation_id.in_(shipment_quotation_ids),
        )
        .order_by(Payment.id.desc())
        .all()
        if shipment_quotation_ids
        else []
    )

    payment_status_by_quotation = {}

    for payment in payment_rows:
        quotation_id = payment.quotation_id
        status = (payment.status or "").lower()

        # Verified payment takes priority over other payment records.
        if (
            quotation_id not in payment_status_by_quotation
            or status == "verified"
        ):
            payment_status_by_quotation[quotation_id] = status

        if status == "verified":
            payment_status_by_quotation[quotation_id] = status

    payment_labels = {
        "verified": "Paid",
        "pending_verification": "Pending Verification",
        "rejected": "Rejected",
    }

    recent_shipments = [
        {
            "shipment_id": item.shipment_id,
            "quotation_id": item.quotation_id,
            "route_id": item.route_id,
            "origin": item.origin,
            "destination": item.destination,
            "route": f"{item.origin} → {item.destination}",
            "cargo_type": item.cargo_type,
            "shipment_date": serialize_datetime(
                item.booked_at or item.created_at
            ),
            "status": item.status,
            "estimated_arrival": serialize_datetime(
                item.estimated_arrival
            ),
            "payment_status": payment_labels.get(
    payment_status_by_quotation.get(item.quotation_id, ""),
    "No Payment",
),
        }
        for item in recent_shipment_rows
    ]

    # -----------------------------------------------------
    # PAYMENTS
    # -----------------------------------------------------

    verified_payments_query = (
        db.query(Payment)
        .filter(
            Payment.user_id == user_id,
            Payment.status == "verified",
        )
    )

    # Number of verified payment records, not payment requests
    # awaiting review and not a claim of actual money transfer.
    payments_made = verified_payments_query.count()

    verified_payment_amount = sum(
        float(payment.amount or 0)
        for payment in verified_payments_query.all()
    )

    # -----------------------------------------------------
    # EXISTING GRAPHS
    # -----------------------------------------------------

    quotation_status_overview = {
        "approved": approved_quotations,
        "pending": pending_quotations,
        "rejected": rejected_quotations,
    }

    freight_cost_by_route = [
        {
            "route_id": route.route_id,
            "route": f"{route.origin} → {route.destination}",
            "origin": route.origin,
            "destination": route.destination,
            "freight_cost": float(route.base_freight_usd or 0),
        }
        for quotation, route in user_quotations
    ]

    transit_time_overview = [
        {
            "route_id": route.route_id,
            "route": f"{route.origin} → {route.destination}",
            "origin": route.origin,
            "destination": route.destination,
            "transit_days": float(route.transit_days or 0),
        }
        for quotation, route in user_quotations
    ]

    # -----------------------------------------------------
    # MONTHLY QUOTATION TRENDS
    # -----------------------------------------------------

    monthly_counts = defaultdict(
        lambda: {"created": 0, "approved": 0}
    )

    quotation_rows = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(QuotationRequestDB.created_at.asc())
        .all()
    )

    for quotation in quotation_rows:
        if not quotation.created_at:
            continue

        month_key = quotation.created_at.strftime("%Y-%m")
        monthly_counts[month_key]["created"] += 1

        # This reflects the quotation's current approved status,
        # grouped by its creation month; it is not the approval date.
        if quotation.status == "approved":
            monthly_counts[month_key]["approved"] += 1

    monthly_quotation_trends = [
        {
            "month": month,
            "created": counts["created"],
            "approved": counts["approved"],
        }
        for month, counts in sorted(monthly_counts.items())
    ]

    # -----------------------------------------------------
    # RECENT QUOTATIONS
    # -----------------------------------------------------

    recent_quotations = []

    for quotation in (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(
            QuotationRequestDB.created_at.desc(),
            QuotationRequestDB.id.desc(),
        )
        .limit(10)
        .all()
    ):
        weather_condition = None
        customs_status = None

        try:
            weather_result = weather_agent.assess_weather(
                route_id=quotation.selected_route_id
            )
            if weather_result.get("status") == "success":
                weather_condition = weather_result.get(
                    "weather_condition"
                )
        except Exception:
            logger.exception(
                "Weather lookup failed for quotation %s",
                quotation.id,
            )

        try:
            customs_result = customs_agent.validate_customs(
                quotation.selected_route_id
            )
            if customs_result.get("status") == "success":
                customs_status = customs_result.get("customs_status")
        except Exception:
            logger.exception(
                "Customs lookup failed for quotation %s",
                quotation.id,
            )

        recent_quotations.append({
            "quotation_id": quotation.id,
            "quotation_date": serialize_datetime(
                quotation.created_at
            ),
            "origin": quotation.origin,
            "destination": quotation.destination,
            "cargo_type": quotation.cargo_type,
            "container_type": quotation.container_type,
            "container_count": quotation.container_count,
            "selling_price": float(quotation.selling_price or 0),
            "weather_condition": weather_condition,
            "customs_status": customs_status,
            "status": quotation.status,
        })

    # -----------------------------------------------------
    # RECENT ACTIVITIES
    # -----------------------------------------------------

    allowed_activity_types = [
        "route_analysis",
        "route_saved",
        "base_cost_calculation",
        "pricing_analysis",
        "quotation_saved",
        "quotation_approval_requested",
        "quotation_approved",
        "quotation_rejected",
        "feedback_response",
        "payment_request_submitted",
    ]

    activities = (
        db.query(Activity)
        .filter(
            Activity.user_id == user_id,
            Activity.activity_type.in_(allowed_activity_types),
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(10)
        .all()
    )

    recent_activity = [
        {
            "id": activity.id,
            "activity_type": activity.activity_type,
            "description": activity.description,
            "created_at": serialize_datetime(activity.created_at),
        }
        for activity in activities
    ]

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "status": "success",
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "company_name": getattr(
                current_user, "company_name", None
            ),
            "phone_number": getattr(
                current_user, "phone_number", None
            ),
            "profile_picture": getattr(
                current_user, "profile_picture", None
            ),
        },
        "kpis": {
            "total_routes": total_routes,
            "total_quotations": total_quotations,
            "average_freight_cost": round(
                average_freight_cost, 2
            ),
            "average_transit_time": round(
                average_transit_time, 2
            ),
            "approved_quotations": approved_quotations,
            "successful_deliveries": successful_deliveries,
            "payments_made": payments_made,
        },
        "payment_summary": {
            "verified_payment_count": payments_made,
            "verified_payment_amount": round(
                verified_payment_amount, 2
            ),
            "currency": "USD",
        },
        "graphs": {
            "quotation_status_overview": quotation_status_overview,
            "freight_cost_by_route": freight_cost_by_route,
            "transit_time_overview": transit_time_overview,
            "monthly_quotation_trends": monthly_quotation_trends,
            "shipment_status_overview": shipment_status_overview,
        },
        "recent_activity": recent_activity,
        "recent_quotations": recent_quotations,
        "recent_shipments": recent_shipments,
    }


# =========================================================
# USER NOTIFICATIONS
# =========================================================

@router.get("/notifications")
def get_user_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id
    notifications = []

    # Existing quotation and feedback activity notifications.
    activity_types = [
        "quotation_approved",
        "quotation_rejected",
        "feedback_response",
    ]

    activities = (
        db.query(Activity)
        .filter(
            Activity.user_id == user_id,
            Activity.activity_type.in_(activity_types),
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .limit(10)
        .all()
    )

    for activity in activities:
        notifications.append(get_activity_notification(activity))

    # Payment history notifications. The history table records
    # submitted, verified, and rejected state transitions.
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == user_id)
        .all()
    )

    payment_ids = [payment.id for payment in payments]

    if payment_ids:
        payment_history = (
            db.query(PaymentStatusHistory, Payment)
            .join(
                Payment,
                Payment.id == PaymentStatusHistory.payment_id,
            )
            .filter(
                Payment.user_id == user_id,
                PaymentStatusHistory.payment_id.in_(payment_ids),
            )
            .order_by(
                PaymentStatusHistory.created_at.desc(),
                PaymentStatusHistory.id.desc(),
            )
            .limit(30)
            .all()
        )

        payment_titles = {
            "pending_verification": (
                "Payment Request Submitted", "◷"
            ),
            "verified": ("Payment Verified", "✓"),
            "rejected": ("Payment Rejected", "×"),
        }

        for history, payment in payment_history:
            title_icon = payment_titles.get(history.new_status)
            if not title_icon:
                continue

            title, icon = title_icon
            notifications.append({
                "id": f"payment-history-{history.id}",
                "type": f"payment_{history.new_status}",
                "title": title,
                "message": (
                    f"Payment for Quotation #{payment.quotation_id}: "
                    f"{history.note or history.new_status.replace('_', ' ').title()}"
                ),
                "created_at": serialize_datetime(history.created_at),
                "icon": icon,
                "related_id": payment.id,
                "quotation_id": payment.quotation_id,
            })

    # Shipment status history notifications.
    shipments = (
        db.query(Shipment)
        .filter(Shipment.user_id == user_id)
        .all()
    )

    shipment_ids = [item.shipment_id for item in shipments]

    if shipment_ids:
        shipment_history = (
            db.query(ShipmentStatusHistory, Shipment)
            .join(
                Shipment,
                Shipment.shipment_id
                == ShipmentStatusHistory.shipment_id,
            )
            .filter(
                Shipment.user_id == user_id,
                ShipmentStatusHistory.shipment_id.in_(shipment_ids),
            )
            .order_by(
                ShipmentStatusHistory.created_at.desc(),
                ShipmentStatusHistory.id.desc(),
            )
            .limit(40)
            .all()
        )

        shipment_titles = {
            "booked": ("Shipment Booked", "▣"),
            "pickup": ("Shipment Picked Up", "↗"),
            "in_transit": ("Shipment In Transit", "➜"),
            "out_for_delivery": ("Shipment Out for Delivery", "⌖"),
            "delivered": ("Shipment Delivered", "✓"),
            "cancelled": ("Shipment Cancelled", "×"),
        }

        for history, shipment in shipment_history:
            title_icon = shipment_titles.get(history.new_status)
            if not title_icon:
                continue

            title, icon = title_icon
            notifications.append({
                "id": f"shipment-history-{history.id}",
                "type": f"shipment_{history.new_status}",
                "title": title,
                "message": (
                    f"Shipment {shipment.shipment_id}: "
                    f"{history.note or title}"
                ),
                "created_at": serialize_datetime(history.created_at),
                "icon": icon,
                "related_id": shipment.shipment_id,
                "quotation_id": shipment.quotation_id,
            })

    notifications.sort(
        key=lambda item: item.get("created_at") or "",
        reverse=True,
    )

    return {
        "status": "success",
        "notifications": notifications[:30],
    }