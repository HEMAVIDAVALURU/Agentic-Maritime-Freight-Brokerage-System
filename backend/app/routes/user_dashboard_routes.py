import csv
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    SavedQuotation,
    QuotationRequestDB,
    Route,
    Activity,
)
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/user-dashboard",
    tags=["User Dashboard"]
)

weather_agent = WeatherAgent()
customs_agent = CustomsAgent()


# =========================================================
# USER DASHBOARD
# =========================================================

@router.get("/")
def get_user_dashboard(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    user_id = current_user.id


    # =====================================================
    # TOTAL ROUTES
    # =====================================================
    #
    # Read route.csv directly so newly added CSV routes
    # are reflected immediately.
    #
    # =====================================================

    total_routes = 0

    current_file = os.path.abspath(__file__)

    project_root = os.path.dirname(
        os.path.dirname(
            os.path.dirname(current_file)
        )
    )

    route_file = os.path.join(
        project_root,
        "app",
        "data",
        "route.csv"
    )

    try:

        with open(
            route_file,
            mode="r",
            encoding="utf-8"
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                if (
                    row.get("route_id") or ""
                ).strip():

                    total_routes += 1

    except Exception:

        total_routes = 0


    # =====================================================
    # SAVED QUOTATIONS
    # =====================================================

    saved_quotations_count = (
        db.query(SavedQuotation)
        .filter(
            SavedQuotation.user_id == user_id
        )
        .count()
    )


    # =====================================================
    # USER QUOTATIONS + SELECTED ROUTE
    # =====================================================
    #
    # IMPORTANT:
    #
    # Average Freight Cost and Average Transit Time
    # are based on the user's actual quotations.
    #
    # They are calculated from the selected Route
    # associated with each quotation.
    #
    # =====================================================

    user_quotations = (
        db.query(
            QuotationRequestDB,
            Route
        )
        .join(
            Route,
            Route.route_id
            ==
            QuotationRequestDB.selected_route_id
        )
        .filter(
            QuotationRequestDB.user_id
            ==
            user_id
        )
        .order_by(
            QuotationRequestDB.created_at.desc()
        )
        .all()
    )


    # =====================================================
    # AVERAGE FREIGHT COST
    # =====================================================

    freight_values = []

    for quotation, route in user_quotations:

        if route.base_freight_usd is not None:

            freight_values.append(
                float(
                    route.base_freight_usd
                )
            )


    if freight_values:

        average_freight_cost = (
            sum(freight_values)
            /
            len(freight_values)
        )

    else:

        average_freight_cost = 0


    # =====================================================
    # AVERAGE TRANSIT TIME
    # =====================================================

    transit_values = []

    for quotation, route in user_quotations:

        if route.transit_days is not None:

            transit_values.append(
                float(
                    route.transit_days
                )
            )


    if transit_values:

        average_transit_time = (
            sum(transit_values)
            /
            len(transit_values)
        )

    else:

        average_transit_time = 0


    # =====================================================
    # QUOTATION STATUS COUNTS
    # =====================================================

    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "approved"
        )
        .count()
    )


    pending_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "pending"
        )
        .count()
    )


    rejected_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.user_id == user_id,
            QuotationRequestDB.status == "rejected"
        )
        .count()
    )


    # =====================================================
    # GRAPH 1 — QUOTATION STATUS
    # =====================================================

    quotation_status_overview = {

        "approved":
            approved_quotations,

        "pending":
            pending_quotations,

        "rejected":
            rejected_quotations
    }


    # =====================================================
    # GRAPH 2 — FREIGHT COST BY ROUTE
    # =====================================================

    freight_cost_by_route = []

    for quotation, route in user_quotations:

        freight_cost_by_route.append({

            "route_id":
                route.route_id,

            "route":
                (
                    f"{route.origin} → "
                    f"{route.destination}"
                ),

            "origin":
                route.origin,

            "destination":
                route.destination,

            "freight_cost":
                float(
                    route.base_freight_usd or 0
                )
        })


    # =====================================================
    # GRAPH 3 — TRANSIT TIME OVERVIEW
    # =====================================================

    transit_time_overview = []

    for quotation, route in user_quotations:

        transit_time_overview.append({

            "route_id":
                route.route_id,

            "route":
                (
                    f"{route.origin} → "
                    f"{route.destination}"
                ),

            "origin":
                route.origin,

            "destination":
                route.destination,

            "transit_days":
                float(
                    route.transit_days or 0
                )
        })


    # =====================================================
    # RECENT ACTIVITY
    # =====================================================
    #
    # Only the requested activity types are shown.
    #
    # Saved Routes are no longer generated by the system.
    # Base Cost itself is still part of the pricing flow.
    #
    # =====================================================

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
    ]


    activities = (
        db.query(Activity)
        .filter(

            Activity.user_id == user_id,

            Activity.activity_type.in_(
                allowed_activity_types
            )

        )
        .order_by(
            Activity.created_at.desc()
        )
        .limit(10)
        .all()
    )


    recent_activity = []

    for activity in activities:

        recent_activity.append({

            "id":
                activity.id,

            "activity_type":
                activity.activity_type,

            "description":
                activity.description,

            "created_at":
                activity.created_at

        })


    # =====================================================
    # RECENT QUOTATIONS
    # =====================================================

    quotation_rows = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.user_id == user_id)
        .order_by(QuotationRequestDB.created_at.desc())
        .limit(10)
        .all()
    )

    recent_quotations = []

    for quotation in quotation_rows:
        weather_condition = None
        customs_status = None

        try:
            weather_result = weather_agent.assess_weather(
                route_id=quotation.selected_route_id
            )
            if weather_result.get("status") == "success":
                weather_condition = weather_result.get("weather_condition")
        except Exception as weather_error:
            print("Dashboard weather lookup failed:", weather_error)

        try:
            customs_result = customs_agent.validate_customs(
                quotation.selected_route_id
            )
            if customs_result.get("status") == "success":
                customs_status = customs_result.get("customs_status")
        except Exception as customs_error:
            print("Dashboard customs lookup failed:", customs_error)

        recent_quotations.append({
            "quotation_id": quotation.id,
            "quotation_date": quotation.created_at,
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


    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "status":
            "success",

        "user": {

            "id":
                current_user.id,

            "name":
                current_user.name,

            "email":
                current_user.email,

            "company_name":
                getattr(current_user, "company_name", None),

            "phone_number":
                getattr(current_user, "phone_number", None),

            "profile_picture":
                getattr(current_user, "profile_picture", None)

        },

        "kpis": {

            "total_routes":
                total_routes,

            "saved_quotations":
                saved_quotations_count,

            "average_freight_cost":
                round(
                    average_freight_cost,
                    2
                ),

            "average_transit_time":
                round(
                    average_transit_time,
                    2
                ),

            "approved_quotations":
                approved_quotations,

            "pending_quotations":
                pending_quotations,

            "rejected_quotations":
                rejected_quotations

        },

        "graphs": {

            "quotation_status_overview":
                quotation_status_overview,

            "freight_cost_by_route":
                freight_cost_by_route,

            "transit_time_overview":
                transit_time_overview

        },

        "recent_activity":
            recent_activity,

        "recent_quotations":
            recent_quotations
    }

# =========================================================
# USER NOTIFICATIONS
# =========================================================

@router.get("/notifications")
def get_user_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    allowed_types = [
        "quotation_approved",
        "quotation_rejected",
        "feedback_response",
    ]

    activities = (
        db.query(Activity)
        .filter(
            Activity.user_id == current_user.id,
            Activity.activity_type.in_(allowed_types),
        )
        .order_by(Activity.created_at.desc())
        .limit(10)
        .all()
    )

    notifications = []
    for activity in activities:
        if activity.activity_type == "quotation_approved":
            title = "Quotation Approved"
            icon = "✓"
        elif activity.activity_type == "quotation_rejected":
            title = "Quotation Rejected"
            icon = "×"
        else:
            title = "Admin Feedback Response"
            icon = "✦"

        notifications.append({
            "id": activity.id,
            "type": activity.activity_type,
            "title": title,
            "message": activity.description or "You have a new notification.",
            "created_at": activity.created_at,
            "icon": icon,
        })

    return {
        "status": "success",
        "notifications": notifications,
    }
