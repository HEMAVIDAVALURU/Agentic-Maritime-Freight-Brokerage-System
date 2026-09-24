from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.quotation_service import QuotationService
from app.services.auth_dependency import get_current_user
from app.services.email_service import EmailService

from app.db_models import (
    User,
    Admin,
    SavedQuotation,
    QuotationRequestDB,
    QuotationRoute,
    Pricing,
    Activity,
    Route
)


router = APIRouter(
    prefix="/api/quotations",
    tags=["Quotations"]
)


quotation_service = QuotationService()


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



# =========================================================
# GENERATE QUOTATION
# =========================================================

@router.post("/generate")
def generate_quotation(
    request: QuotationRequest
):

    return quotation_service.generate_quotation(

        origin=request.origin,

        destination=request.destination,

        cargo_type=request.cargo_type,

        containers=request.containers,

        route_id=request.route_id

    )


# =========================================================
# SAVE FINAL QUOTATION
# =========================================================
#
# Customer:
#
# Route Analysis
#       ↓
# Pricing + Margin Analysis
#       ↓
# Final Selling Price
#       ↓
# Save Quotation
#
# =========================================================

@router.post("/save")
def save_quotation(

    request: SaveQuotationRequest,

    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)

):

    # -----------------------------------------------------
    # USER OWNERSHIP CHECK
    # -----------------------------------------------------

    if current_user.id != request.user_id:

        return {

            "status": "error",

            "message":
                "You can only save quotations for your own account."

        }

    # -----------------------------------------------------
    # SAVE QUOTATION
    # -----------------------------------------------------

    result = quotation_service.save_quotation(

        db=db,

        user_id=request.user_id,

        quotation=request.quotation


    )

    # -----------------------------------------------------
    # ACTIVITY: QUOTATION SAVED
    # -----------------------------------------------------

    if result.get("status") == "success":

        quotation = request.quotation

        route_id = quotation.get(
            "route_id",
            "Unknown"
        )

        origin = quotation.get(
            "origin",
            "Unknown"
        )

        destination = quotation.get(
            "destination",
            "Unknown"
        )

        activity = Activity(

            user_id=request.user_id,

            activity_type="quotation_saved",

            description=(
                f"Quotation saved for route "
                f"{route_id} from "
                f"{origin} to "
                f"{destination}."
            )

        )

        db.add(activity)

        db.commit()

    return result


# =========================================================
# REMOVE SAVED QUOTATION
# =========================================================
#
# Customer can remove a quotation from:
#
# User Dashboard
#       ↓
# Saved Quotations
#       ↓
# Remove
#
# IMPORTANT:
#
# Only the SavedQuotation record is deleted.
#
# The original quotation request, quotation routes,
# pricing information, and approval history remain
# in the database.
#
# =========================================================

@router.delete("/saved/{saved_quotation_id}")
def remove_saved_quotation(

    saved_quotation_id: int,

    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)

):

    # -----------------------------------------------------
    # FIND SAVED QUOTATION
    # -----------------------------------------------------

    saved_quotation = (

        db.query(SavedQuotation)

        .filter(
            SavedQuotation.id == saved_quotation_id
        )

        .first()

    )

    if not saved_quotation:

        return {

            "status": "error",

            "message":
                "Saved quotation not found."

        }

    # -----------------------------------------------------
    # CUSTOMER OWNERSHIP CHECK
    # -----------------------------------------------------

    if saved_quotation.user_id != current_user.id:

        return {

            "status": "error",

            "message":
                "You can only remove your own saved quotation."

        }

    # -----------------------------------------------------
    # REMOVE SAVED QUOTATION
    # -----------------------------------------------------

    db.delete(saved_quotation)

    db.commit()

    # -----------------------------------------------------
    # ACTIVITY: QUOTATION REMOVED
    # -----------------------------------------------------

    activity = Activity(

        user_id=current_user.id,

        activity_type="quotation_removed",

        description=(
            f"Saved quotation "
            f"#{saved_quotation.quotation_id} "
            f"was removed."
        )

    )

    db.add(activity)

    db.commit()

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "status": "success",

        "message":
            "Saved quotation removed successfully."

    }


# =========================================================
# REQUEST QUOTATION APPROVAL
# =========================================================
#
# Save Quotation
#       ↓
# Request Approval
#       ↓
# Admin Review
#
# =========================================================

@router.post("/{quotation_id}/request-approval")
def request_quotation_approval(

    quotation_id: int,

    current_user=Depends(get_current_user),

    db: Session = Depends(get_db)

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

        return {

            "success": False,

            "message":
                "Quotation not found."

        }

    # -----------------------------------------------------
    # CUSTOMER OWNERSHIP CHECK
    # -----------------------------------------------------

    if quotation.user_id != current_user.id:

        return {

            "success": False,

            "message":
                "You can only request approval for your own quotation."

        }

    # -----------------------------------------------------
    # ALREADY PENDING
    # -----------------------------------------------------

    if quotation.status == "pending":

        return {

            "success": False,

            "message":
                "Quotation is already pending approval."

        }

    # -----------------------------------------------------
    # ALREADY APPROVED
    # -----------------------------------------------------

    if quotation.status == "approved":

        return {

            "success": False,

            "message":
                "Quotation has already been approved."

        }

    # -----------------------------------------------------
    # ALREADY REJECTED
    # -----------------------------------------------------

    if quotation.status == "rejected":

        return {

            "success": False,

            "message":
                "Rejected quotations cannot be submitted for approval again."

        }

    # -----------------------------------------------------
    # ONLY SAVED QUOTATIONS CAN BE SUBMITTED
    # -----------------------------------------------------

    if quotation.status != "saved":

        return {

            "success": False,

            "message":
                "Only saved quotations can be submitted for approval."

        }

    # -----------------------------------------------------
    # SEND FOR ADMIN APPROVAL
    # -----------------------------------------------------

    quotation.status = "pending"

    db.commit()

    db.refresh(quotation)

    # -----------------------------------------------------
    # ACTIVITY: APPROVAL REQUESTED
    # -----------------------------------------------------

    activity = Activity(

        user_id=current_user.id,

        activity_type="quotation_approval_requested",

        description=(

            f"Quotation #{quotation.id} "

            f"from {quotation.origin} to "

            f"{quotation.destination} "

            f"was submitted for admin approval."

        )

    )

    db.add(activity)

    db.commit()

    # =====================================================
    # EMAIL NOTIFICATIONS
    # =====================================================
    #
    # After quotation status becomes pending:
    #
    # 1. All admin users receive:
    #    "New Quotation Approval Request"
    #
    # 2. Customer receives:
    #    "Quotation Sent for Approval"
    #
    # IMPORTANT:
    #
    # Email failure must NOT cancel or break the
    # quotation approval request.
    #
    # =====================================================

    # -----------------------------------------------------
    # SEND APPROVAL REQUEST EMAIL TO ADMINS
    # -----------------------------------------------------

    try:

        admin_users = (
            db.query(Admin)
            .filter(
                 Admin.is_active == True
            )
            .all()
        )

        for admin in admin_users:

            if not admin.email:

                continue

            try:

                EmailService.send_approval_request_email(

                    admin_email=admin.email,

                    customer_name=current_user.name,

                    customer_email=current_user.email,

                    origin=quotation.origin,

                    destination=quotation.destination,

                    cargo_type=quotation.cargo_type,

                    containers=quotation.container_count

                )

            except Exception as email_error:

                print(
                    "Admin approval request email failed "
                    f"for {admin.email}:",
                    email_error
                )

    except Exception as admin_lookup_error:

        print(
            "Admin lookup for approval email failed:",
            admin_lookup_error
        )

    # -----------------------------------------------------
    # SEND CONFIRMATION EMAIL TO CUSTOMER
    # -----------------------------------------------------

    try:

        if current_user.email:

            try:

                EmailService.send_quotation_sent_email(

                    recipient_email=current_user.email,

                    customer_name=current_user.name,

                    origin=quotation.origin,

                    destination=quotation.destination,

                    cargo_type=quotation.cargo_type,

                    containers=quotation.container_count

                )

            except Exception as email_error:

                print(
                    "Customer quotation-sent email failed:",
                    email_error
                )

    except Exception as customer_email_error:

        print(
            "Customer email lookup failed:",
            customer_email_error
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {

        "success": True,

        "message": (
            "Quotation has been submitted "
            "for admin approval."
        ),

        "quotation_id":
            quotation.id,

        "status":
            quotation.status

    }


# =========================================================
# GET SAVED QUOTATIONS
# =========================================================
#
# Customer can see:
#
# - Route
# - Pricing details
# - Target Margin
# - Margin Amount
# - Final Selling Price
# - Approval Status
#
# Customer must NOT receive:
#
# - Profit
# - Internal business analytics
#
# =========================================================

@router.get("/saved/{user_id}")
def get_saved_quotations(

    user_id: int,

    db: Session = Depends(get_db),

    current_user=Depends(get_current_user)

):

    # -----------------------------------------------------
    # USER OWNERSHIP CHECK
    # -----------------------------------------------------

    if current_user.id != user_id:

        return {

            "status": "error",

            "message":
                "You can only view your own saved quotations."

        }

    # -----------------------------------------------------
    # GET SAVED QUOTATIONS
    # -----------------------------------------------------

    saved_items = (

        db.query(

            SavedQuotation,

            QuotationRequestDB

        )

        .join(

            QuotationRequestDB,

            SavedQuotation.quotation_id
            == QuotationRequestDB.id

        )

        .filter(

            SavedQuotation.user_id == user_id

        )

        .order_by(

            SavedQuotation.saved_at.desc()

        )

        .all()

    )

    quotations = []

    # =====================================================
    # BUILD SAVED QUOTATIONS
    # =====================================================

    for saved, quotation in saved_items:

        # -------------------------------------------------
        # GET TOP ROUTES
        # -------------------------------------------------

        route_items = (

            db.query(QuotationRoute)

            .filter(

                QuotationRoute.quotation_id
                == quotation.id

            )

            .order_by(

                QuotationRoute.rank.asc()

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
                == quotation.selected_route_id

            )

            .order_by(

                Pricing.id.desc()

            )

            .first()

        )

        # -------------------------------------------------
        # GET SELECTED ROUTE DETAILS
        # -------------------------------------------------

        selected_route = (

            db.query(Route)

            .filter(
                Route.route_id
                == quotation.selected_route_id
            )

            .first()

        )

        # -------------------------------------------------
        # BUILD TOP ROUTES
        # -------------------------------------------------

        top_routes = []

        for item in route_items:

            top_routes.append({

                "route_id":
                    item.route_id,

                "rank":
                    item.rank,

                "route_score":
                    item.route_score,

                "base_freight_usd":
                    item.base_freight_usd

            })

        # -------------------------------------------------
        # TARGET MARGIN
        # -------------------------------------------------

        target_margin_percent = None

        if quotation.target_margin is not None:

            target_margin_percent = round(

                float(
                    quotation.target_margin
                ) * 100,

                2

            )

        # -------------------------------------------------
        # FINAL SELLING PRICE
        # -------------------------------------------------

        final_selling_price = None

        if quotation.selling_price is not None:

            final_selling_price = round(

                float(
                    quotation.selling_price
                ),

                2

            )

        # -------------------------------------------------
        # DEMAND ADJUSTED COST
        # -------------------------------------------------

        demand_adjusted_cost = None

        if pricing:

            if pricing.demand_adjusted_cost is not None:

                demand_adjusted_cost = round(

                    float(
                        pricing.demand_adjusted_cost
                    ),

                    2

                )

        # -------------------------------------------------
        # MARGIN AMOUNT
        # -------------------------------------------------

        margin_amount = None

        if (
            final_selling_price is not None
            and demand_adjusted_cost is not None
        ):

            margin_amount = round(

                final_selling_price
                -
                demand_adjusted_cost,

                2

            )

        # -------------------------------------------------
        # BUILD PRICING DETAILS
        # -------------------------------------------------

        pricing_data = None

        if pricing:

            pricing_data = {

                "route_id":
                    pricing.route_id,

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

                "final_selling_price_usd":
                    final_selling_price

            }

        # -------------------------------------------------
        # BUILD SAVED QUOTATION
        # -------------------------------------------------

        quotations.append({

            "id":
                saved.id,

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

            "distance_nm":
                selected_route.distance_nm
                if selected_route
                else None,

            "transit_days":
                selected_route.transit_days
                if selected_route
                else None,

            "transshipments":
                selected_route.transshipments
                if selected_route
                else None,

            "base_freight_usd":
                selected_route.base_freight_usd
                if selected_route
                else None,

            "target_margin_percent":
                target_margin_percent,

            "margin_amount_usd":
                margin_amount,

            "selling_price":
                final_selling_price,

            "final_selling_price_usd":
                final_selling_price,

            "status":
                quotation.status,

            "top_routes":
                top_routes,

            "pricing":
                pricing_data,

            "saved_at":
                saved.saved_at

        })

    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "status": "success",

        "count":
            len(quotations),

        "saved_quotations":
            quotations

    }