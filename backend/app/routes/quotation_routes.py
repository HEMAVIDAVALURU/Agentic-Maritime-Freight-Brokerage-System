from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.quotation_service import QuotationService
from app.services.auth_dependency import get_current_user
from app.services.email_service import EmailService

from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent

from app.db_models import (
    User,
    SavedQuotation,
    QuotationRequestDB,
    QuotationRoute,
    Pricing,
    Activity,
    Route,
    Admin,
)


router = APIRouter(
    prefix="/api/quotations",
    tags=["Quotations"],
)

quotation_service = QuotationService()
weather_agent = WeatherAgent()
customs_agent = CustomsAgent()


# =========================================================
# GENERATE QUOTATION REQUEST
# =========================================================

class QuotationRequest(BaseModel):
    origin: str
    destination: str
    cargo_type: str
    containers: int
    route_id: str | None = None


# =========================================================
# SAVE QUOTATION REQUEST
# =========================================================

class SaveQuotationRequest(BaseModel):
    user_id: int
    quotation: dict
    saved_route_id: int | None = None


# =========================================================
# GENERATE QUOTATION
# =========================================================

@router.post("/generate")
def generate_quotation(request: QuotationRequest):
    return quotation_service.generate_quotation(
        origin=request.origin,
        destination=request.destination,
        cargo_type=request.cargo_type,
        containers=request.containers,
        route_id=request.route_id,
    )


# =========================================================
# SAVE FINAL QUOTATION
# =========================================================

@router.post("/save")
def save_quotation(
    request: SaveQuotationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify that the user can only save their own quotation.
    if current_user.id != request.user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only save quotations for your own account.",
        )

    result = quotation_service.save_quotation(
        db=db,
        user_id=current_user.id,
        quotation=request.quotation,
    )

    # Record the activity after a successful save.
    if result.get("status") == "success":
        quotation_data = request.quotation

        route_id = quotation_data.get("route_id", "Unknown")
        origin = quotation_data.get("origin", "Unknown")
        destination = quotation_data.get("destination", "Unknown")

        try:
            activity = Activity(
                user_id=current_user.id,
                activity_type="quotation_saved",
                description=(
                    f"Quotation saved for route {route_id} "
                    f"from {origin} to {destination}."
                ),
            )

            db.add(activity)
            db.commit()

        except Exception as activity_error:
            db.rollback()
            print(
                "Quotation-saved activity failed:",
                activity_error
            )

    return result


# =========================================================
# REMOVE SAVED QUOTATION
# =========================================================

@router.delete("/saved/{saved_quotation_id}")
def remove_saved_quotation(
    saved_quotation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    saved_quotation = (
        db.query(SavedQuotation)
        .filter(
            SavedQuotation.id == saved_quotation_id
        )
        .first()
    )

    if not saved_quotation:
        raise HTTPException(
            status_code=404,
            detail="Saved quotation not found.",
        )

    if saved_quotation.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only remove your own saved quotation.",
        )

    quotation_id = saved_quotation.quotation_id

    try:
        db.delete(saved_quotation)
        db.commit()

    except Exception as delete_error:
        db.rollback()
        print(
            "Saved quotation deletion failed:",
            delete_error
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to remove the saved quotation.",
        )

    # Record the removal activity separately.
    try:
        activity = Activity(
            user_id=current_user.id,
            activity_type="quotation_removed",
            description=(
                f"Saved quotation #{quotation_id} was removed."
            ),
        )

        db.add(activity)
        db.commit()

    except Exception as activity_error:
        db.rollback()
        print(
            "Quotation-removal activity failed:",
            activity_error
        )

    return {
        "status": "success",
        "message": "Saved quotation removed successfully.",
    }


# =========================================================
# REQUEST QUOTATION APPROVAL
# =========================================================

@router.post("/{quotation_id}/request-approval")
def request_quotation_approval(
    quotation_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # FIND QUOTATION
    # -----------------------------------------------------

    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id == quotation_id
        )
        .first()
    )

    if not quotation:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    # -----------------------------------------------------
    # CUSTOMER OWNERSHIP CHECK
    # -----------------------------------------------------

    if quotation.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only request approval "
                "for your own quotation."
            ),
        )

    # -----------------------------------------------------
    # CHECK CURRENT STATUS
    # -----------------------------------------------------

    if quotation.status == "pending":
        raise HTTPException(
            status_code=400,
            detail="Quotation is already pending approval.",
        )

    if quotation.status == "approved":
        raise HTTPException(
            status_code=400,
            detail="Quotation has already been approved.",
        )

    if quotation.status == "rejected":
        raise HTTPException(
            status_code=400,
            detail=(
                "Rejected quotations cannot be submitted "
                "for approval again."
            ),
        )

    if quotation.status != "saved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only saved quotations can be submitted "
                "for approval."
            ),
        )

    # -----------------------------------------------------
    # UPDATE STATUS IN DATABASE
    # -----------------------------------------------------

    try:
        quotation.status = "pending"

        db.commit()
        db.refresh(quotation)

    except Exception as database_error:
        db.rollback()

        print(
            "Quotation approval status update failed:",
            database_error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to submit the quotation "
                "for approval."
            ),
        )

    # -----------------------------------------------------
    # RECORD APPROVAL ACTIVITY
    # -----------------------------------------------------

    try:
        activity = Activity(
            user_id=current_user.id,
            activity_type="quotation_approval_requested",
            description=(
                f"Quotation #{quotation.id} from "
                f"{quotation.origin} to "
                f"{quotation.destination} "
                f"was submitted for admin approval."
            ),
        )

        db.add(activity)
        db.commit()

    except Exception as activity_error:
        db.rollback()

        print(
            "Approval-request activity failed:",
            activity_error
        )

    # -----------------------------------------------------
    # EMAIL RESULT COUNTERS
    # -----------------------------------------------------

    admin_email_results = []

    customer_email_result = {
        "success": False,
        "message": "Customer email was not attempted.",
    }

    # -----------------------------------------------------
    # FIND ACTIVE ADMINS
    # -----------------------------------------------------

    try:
        admin_users = (
            db.query(Admin)
            .filter(
                Admin.is_active.is_(True)
            )
            .all()
        )

    except Exception as admin_lookup_error:
        admin_users = []

        print(
            "Admin lookup for approval email failed:",
            admin_lookup_error,
        )

    # -----------------------------------------------------
    # SEND APPROVAL REQUEST EMAILS TO ADMINS
    # -----------------------------------------------------
    #
    # Admin notification rules:
    #
    # 1. Email Notifications must be ON
    # 2. Quotation Alerts must be ON
    #
    # If either one is OFF, admin does not receive
    # the quotation approval notification.
    #
    # IMPORTANT:
    # The quotation submission itself is NOT blocked.
    # The status is already changed to "pending".
    # -----------------------------------------------------

    for admin in admin_users:

        # -------------------------------------------------
        # ADMIN EMAIL CHECK
        # -------------------------------------------------

        if not admin.email:
            continue

        # -------------------------------------------------
        # MASTER EMAIL NOTIFICATION CHECK
        # -------------------------------------------------

        if not admin.email_notifications:
            print(
                f"Quotation notification skipped for "
                f"{admin.email}: "
                f"Email Notifications are OFF."
            )
            continue

        # -------------------------------------------------
        # QUOTATION ALERT CHECK
        # -------------------------------------------------

        if not admin.quotation_alerts:
            print(
                f"Quotation notification skipped for "
                f"{admin.email}: "
                f"Quotation Alerts are OFF."
            )
            continue

        # -------------------------------------------------
        # SEND EMAIL
        # -------------------------------------------------

        try:
            email_result = (
                EmailService.send_approval_request_email(
                    admin_email=admin.email,
                    customer_name=current_user.name,
                    customer_email=current_user.email,
                    origin=quotation.origin,
                    destination=quotation.destination,
                    cargo_type=quotation.cargo_type,
                    containers=quotation.container_count,
                )
            )

            if (
                isinstance(email_result, dict)
                and email_result.get("success")
            ):
                admin_email_results.append({
                    "email": admin.email,
                    "success": True,
                    "message": email_result.get(
                        "message",
                        "Email sent."
                    ),
                })

            else:
                admin_email_results.append({
                    "email": admin.email,
                    "success": False,
                    "message": (
                        email_result.get(
                            "message",
                            "Email sending failed."
                        )
                        if isinstance(
                            email_result,
                            dict
                        )
                        else (
                            "Email service returned "
                            "an unexpected result."
                        )
                    ),
                })

        except Exception as email_error:

            admin_email_results.append({
                "email": admin.email,
                "success": False,
                "message": str(email_error),
            })

            print(
                f"Admin approval email failed "
                f"for {admin.email}:",
                email_error,
            )

    # -----------------------------------------------------
    # SEND CONFIRMATION EMAIL TO CUSTOMER
    # -----------------------------------------------------
    #
    # This is a CUSTOMER email.
    #
    # It is intentionally NOT controlled by the admin
    # Email Notifications / Quotation Alerts settings.
    # -----------------------------------------------------

    try:

        if (
            current_user.email
            and current_user.email_notification
            ):
            email_result = EmailService.send_quotation_sent_email(
                    recipient_email=current_user.email,
                    customer_name=current_user.name,
                    origin=quotation.origin,
                    destination=quotation.destination,
                    cargo_type=quotation.cargo_type,
                    containers=quotation.container_count,
                )
            

            if isinstance(result, dict):

                customer_email_result = result

            else:

                customer_email_result = {
                    "success": False,
                    "message": (
                        "Email service returned "
                        "an unexpected result."
                    ),
                }

        else:

            customer_email_result = {
                "success": False,
                "message": (
                    "Customer email address is missing."
                ),
            }

    except Exception as customer_email_error:

        customer_email_result = {
            "success": False,
            "message": str(customer_email_error),
        }

        print(
            "Customer quotation-sent email failed:",
            customer_email_error,
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    successful_admin_emails = sum(
        1
        for item in admin_email_results
        if item["success"]
    )

    return {
        "success": True,
        "message": (
            "Quotation has been submitted "
            "for admin approval."
        ),
        "quotation_id": quotation.id,
        "status": quotation.status,

        "notifications": {
            "active_admins_found": len(
                admin_users
            ),

            "admin_emails_attempted": len(
                admin_email_results
            ),

            "admin_emails_sent": (
                successful_admin_emails
            ),

            "customer_email_sent": bool(
                customer_email_result.get(
                    "success"
                )
            ),
        },
    }


# =========================================================
# GET SAVED QUOTATIONS
# =========================================================

@router.get("/saved/{user_id}")
def get_saved_quotations(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # -----------------------------------------------------
    # USER OWNERSHIP CHECK
    # -----------------------------------------------------

    if current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only view your own "
                "saved quotations."
            ),
        )

    # -----------------------------------------------------
    # GET SAVED QUOTATIONS
    # -----------------------------------------------------

    saved_items = (
        db.query(
            SavedQuotation,
            QuotationRequestDB,
        )
        .join(
            QuotationRequestDB,
            SavedQuotation.quotation_id
            == QuotationRequestDB.id,
        )
        .filter(
            SavedQuotation.user_id == user_id,
        )
        .order_by(
            SavedQuotation.saved_at.desc(),
        )
        .all()
    )

    quotations = []

    # =====================================================
    # BUILD EACH SAVED QUOTATION
    # =====================================================

    for saved, quotation in saved_items:

        # -------------------------------------------------
        # GET TOP ROUTES
        # -------------------------------------------------

        route_items = (
            db.query(QuotationRoute)
            .filter(
                QuotationRoute.quotation_id
                == quotation.id,
            )
            .order_by(
                QuotationRoute.rank.asc(),
            )
            .all()
        )

        # -------------------------------------------------
        # GET PRICING DATA
        # -------------------------------------------------

        pricing = (
            db.query(Pricing)
            .filter(
                Pricing.route_id
                == quotation.selected_route_id,
            )
            .order_by(
                Pricing.id.desc(),
            )
            .first()
        )

        # -------------------------------------------------
        # GET WEATHER INFORMATION
        # -------------------------------------------------

        weather_data = {
            "wind_speed_knots": None,
            "wave_height_m": None,
            "storm_probability_percent": None,
            "visibility_km": None,
            "weather_condition": None,
            "weather_risk": None,
        }

        try:

            weather_result = (
                weather_agent.assess_weather(
                    route_id=quotation.selected_route_id,
                )
            )

            if weather_result.get("status") == "success":

                weather_data = {
                    "wind_speed_knots": weather_result.get("wind_speed_knots"),
                    "wave_height_m": weather_result.get("wave_height_m"),
                    "storm_probability_percent": weather_result.get("storm_probability_percent"),
                    "visibility_km": weather_result.get("visibility_km"),
                    "weather_condition": weather_result.get("weather_condition"),
                    "weather_risk": weather_result.get("weather_risk"),
                }

        except Exception as weather_error:

            print(
                "Weather assessment failed:",
                weather_error
            )

        # -------------------------------------------------
        # GET CUSTOMS INFORMATION
        # -------------------------------------------------

        customs_data = {
            "customs_id": None,
            "cargo_type": None,
            "hs_code_required": None,
            "commercial_invoice": None,
            "packing_list": None,
            "certificate_of_origin": None,
            "restricted_cargo": None,
            "customs_status": None,
            "missing_documents": [],
            "recommendation": None,
        }

        try:

            customs_result = (
                customs_agent.validate_customs(
                    quotation.selected_route_id,
                )
            )

            if customs_result.get("status") == "success":

                customs_data = {
                    "customs_id": customs_result.get("customs_id"),
                    "cargo_type": customs_result.get("cargo_type"),
                    "hs_code_required": customs_result.get("hs_code_required"),
                    "commercial_invoice": customs_result.get("commercial_invoice"),
                    "packing_list": customs_result.get("packing_list"),
                    "certificate_of_origin": customs_result.get("certificate_of_origin"),
                    "restricted_cargo": customs_result.get("restricted_cargo"),
                    "customs_status": customs_result.get("customs_status"),
                    "missing_documents": customs_result.get("missing_documents") or [],
                    "recommendation": customs_result.get("recommendation"),
                }

        except Exception as customs_error:

            print(
                "Customs validation failed:",
                customs_error
            )

        # -------------------------------------------------
        # GET SELECTED ROUTE DETAILS
        # -------------------------------------------------

        selected_route = (
            db.query(Route)
            .filter(
                Route.route_id
                == quotation.selected_route_id,
            )
            .first()
        )

        # -------------------------------------------------
        # BUILD TOP ROUTES
        # -------------------------------------------------

        top_routes = []

        for item in route_items:

            top_routes.append({
                "route_id": item.route_id,
                "rank": item.rank,
                "route_score": item.route_score,
                "base_freight_usd":
                    item.base_freight_usd,
            })

        # -------------------------------------------------
        # TARGET MARGIN
        # -------------------------------------------------

        target_margin_percent = None

        if quotation.target_margin is not None:

            target_margin_percent = round(
                float(quotation.target_margin) * 100,
                2,
            )

        # -------------------------------------------------
        # FINAL SELLING PRICE
        # -------------------------------------------------

        final_selling_price = None

        if quotation.selling_price is not None:

            final_selling_price = round(
                float(quotation.selling_price),
                2,
            )

        # -------------------------------------------------
        # DEMAND-ADJUSTED COST
        # -------------------------------------------------

        demand_adjusted_cost = None

        if (
            pricing
            and pricing.demand_adjusted_cost is not None
        ):

            demand_adjusted_cost = round(
                float(
                    pricing.demand_adjusted_cost
                ),
                2,
            )

        # -------------------------------------------------
        # MARGIN AMOUNT
        # -------------------------------------------------

        margin_amount = None
        actual_margin_percent = None

        if (
            final_selling_price is not None
            and demand_adjusted_cost is not None
        ):

            margin_amount = round(
                final_selling_price
                - demand_adjusted_cost,
                2,
            )

            if final_selling_price > 0:
                actual_margin_percent = round(
                    (margin_amount / final_selling_price) * 100,
                    2,
                )

        # -------------------------------------------------
        # BUILD PRICING DETAILS
        # -------------------------------------------------

        pricing_data = None

        if pricing:

            pricing_data = {
                "route_id":
                    pricing.route_id,

                "base_freight_usd":
                    (
                        selected_route.base_freight_usd
                        if selected_route
                        else None
                    ),

                "fuel_surcharge_usd":
                    pricing.fuel_surcharge,

                "port_charge_usd":
                    pricing.port_charge,

                "risk_surcharge_usd":
                    pricing.risk_surcharge,

                "operating_cost_usd":
                    pricing.operating_cost,

                "demand_factor":
                    pricing.demand_factor,

                "demand_adjusted_cost_usd":
                    pricing.demand_adjusted_cost,

                "target_margin_percent":
                    target_margin_percent,

                "margin_amount_usd":
                    margin_amount,

                "actual_margin_percent":
                    actual_margin_percent,

                "final_selling_price_usd":
                    final_selling_price,
            }

        # -------------------------------------------------
        # BUILD SAVED QUOTATION
        # -------------------------------------------------

        quotations.append({

            "id": saved.id,

            "quotation_id":
                quotation.id,

            "origin":
                quotation.origin,

            "destination":
                quotation.destination,

            "cargo_type":
                quotation.cargo_type,

            "container_type":
                quotation.container_type,

            "containers":
                quotation.container_count,

            "route_id":
                quotation.selected_route_id,

            "distance_nm": (
                selected_route.distance_nm
                if selected_route
                else None
            ),

            "transit_days": (
                selected_route.transit_days
                if selected_route
                else None
            ),

            "transshipments": (
                selected_route.transshipments
                if selected_route
                else None
            ),

            "base_freight_usd": (
                selected_route.base_freight_usd
                if selected_route
                else None
            ),

            "target_margin_percent":
                target_margin_percent,

            "margin_amount_usd":
                margin_amount,

            "actual_margin_percent":
                actual_margin_percent,

            "selling_price":
                final_selling_price,

            "final_selling_price_usd":
                final_selling_price,

            "weather_condition":
                weather_data.get("weather_condition"),

            "weather":
                weather_data,

            "customs_status":
                customs_data.get("customs_status"),

            "customs":
                customs_data,

            "status":
                quotation.status,

            "top_routes":
                top_routes,

            "pricing":
                pricing_data,

            "saved_at":
                saved.saved_at,
        })

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "status": "success",
        "count": len(quotations),
        "saved_quotations": quotations,
    }