from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from types import SimpleNamespace

from app.database import get_db
from app.db_models import (
    User,
    Admin,
    QuotationRequestDB,
    QuotationRoute,
    Route,
    Pricing,
    Activity,
)
from app.services.auth_dependency import get_current_user
from app.services.email_service import EmailService
from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent


router = APIRouter(
    prefix="/api/admin-quotations",
    tags=["Admin Quotations"]
)


# =========================================================
# AGENTS
# =========================================================

weather_agent = WeatherAgent()
customs_agent = CustomsAgent()


# =========================================================
# ADMIN ACCESS CHECK
# =========================================================

def verify_admin(current_user):

    if current_user.role != "admin":
        return False

    return True


# =========================================================
# PRICING FALLBACK
# =========================================================

def get_pricing_data(
    db: Session,
    quotation,
    selected_route
):

    # -----------------------------------------------------
    # FIND EXISTING PRICING RECORD
    # -----------------------------------------------------

    pricing = (
        db.query(Pricing)
        .filter(
            Pricing.route_id ==
            quotation.selected_route_id
        )
        .order_by(
            Pricing.id.desc()
        )
        .first()
    )

    # -----------------------------------------------------
    # CHECK WHETHER STORED PRICING IS VALID
    # -----------------------------------------------------

    stored_pricing_valid = False

    if pricing:

        fuel_value = float(
            pricing.fuel_surcharge or 0
        )

        port_value = float(
            pricing.port_charge or 0
        )

        risk_value = float(
            pricing.risk_surcharge or 0
        )

        operating_value = float(
            pricing.operating_cost or 0
        )

        demand_adjusted_value = float(
            pricing.demand_adjusted_cost or 0
        )

        demand_factor_value = float(
            pricing.demand_factor or 0
        )

        if (
            fuel_value > 0
            or port_value > 0
            or risk_value > 0
            or operating_value > 0
            or demand_adjusted_value > 0
            or demand_factor_value != 1
        ):

            stored_pricing_valid = True

    # -----------------------------------------------------
    # USE STORED PRICING WHEN VALID
    # -----------------------------------------------------

    if stored_pricing_valid:

        return {

            "base_freight_usd":
                float(
                    selected_route.base_freight_usd
                    if selected_route
                    else 0
                ),

            "fuel_surcharge_usd":
                float(
                    pricing.fuel_surcharge or 0
                ),

            "port_charge_usd":
                float(
                    pricing.port_charge or 0
                ),

            "risk_surcharge_usd":
                float(
                    pricing.risk_surcharge or 0
                ),

            "operating_cost_usd":
                float(
                    pricing.operating_cost or 0
                ),

            "demand_factor":
                float(
                    pricing.demand_factor or 1
                ),

            "demand_adjusted_cost_usd":
                float(
                    pricing.demand_adjusted_cost or 0
                ),

            "pricing_record":
                pricing
        }

    # =====================================================
    # PRICING AGENT FALLBACK
    # =====================================================

    try:

        if not selected_route:

            return {

                "base_freight_usd": 0,

                "fuel_surcharge_usd": 0,

                "port_charge_usd": 0,

                "risk_surcharge_usd": 0,

                "operating_cost_usd": 0,

                "demand_factor": 1.0,

                "demand_adjusted_cost_usd": 0,

                "pricing_record":
                    pricing
            }

        # -------------------------------------------------
        # BUILD ROUTE OBJECT FOR PRICING AGENT
        # -------------------------------------------------

        route_data = {

            "route_id":
                selected_route.route_id,

            "origin":
                selected_route.origin,

            "destination":
                selected_route.destination,

            "distance_nm":
                selected_route.distance_nm,

            "transit_days":
                selected_route.transit_days,

            "transit_time_days":
                selected_route.transit_days,

            "transshipments":
                selected_route.transshipments,

            "route_type":
                selected_route.route_type,

            "base_freight_usd":
                float(
                    selected_route.base_freight_usd or 0
                ),

        }

        # -------------------------------------------------
        # RUN PRICING AGENT
        # -------------------------------------------------

        pricing_agent = PricingAgent()

        pricing_result = pricing_agent.calculate_price(

            route=route_data,

            containers=int(
                quotation.container_count or 1
            )

        )

        # -------------------------------------------------
        # CHECK PRICING RESULT
        # -------------------------------------------------

        if (
            not pricing_result
            or pricing_result.get("status") == "error"
        ):

            return {

                "base_freight_usd":
                    float(
                        selected_route.base_freight_usd or 0
                    ),

                "fuel_surcharge_usd": 0,

                "port_charge_usd": 0,

                "risk_surcharge_usd": 0,

                "operating_cost_usd": 0,

                "demand_factor": 1.0,

                "demand_adjusted_cost_usd": 0,

                "pricing_record":
                    pricing
            }

        # -------------------------------------------------
        # EXTRACT PRICING VALUES
        # -------------------------------------------------

        fuel_surcharge = float(
            pricing_result.get(
                "fuel_surcharge_usd",
                0
            ) or 0
        )

        port_charge = float(
            pricing_result.get(
                "port_charge_usd",
                0
            ) or 0
        )

        risk_surcharge = float(
            pricing_result.get(
                "risk_surcharge_usd",
                0
            ) or 0
        )

        operating_cost = float(
            pricing_result.get(
                "total_operational_cost_usd",
                pricing_result.get(
                    "operating_cost_usd",
                    0
                )
            ) or 0
        )

        demand_factor = float(
            pricing_result.get(
                "demand_factor",
                1.0
            ) or 1.0
        )

        demand_adjusted_cost = float(
            pricing_result.get(
                "demand_adjusted_total_cost_usd",
                pricing_result.get(
                    "demand_adjusted_cost_usd",
                    pricing_result.get(
                        "demand_adjusted_cost",
                        0
                    )
                )
            ) or 0
        )

        base_freight = float(
            selected_route.base_freight_usd or 0
        )

        # -------------------------------------------------
        # UPDATE EXISTING PRICING RECORD
        # -------------------------------------------------

        if pricing:

            pricing.fuel_surcharge = (
                fuel_surcharge
            )

            pricing.port_charge = (
                port_charge
            )

            pricing.risk_surcharge = (
                risk_surcharge
            )

            pricing.operating_cost = (
                operating_cost
            )

            pricing.demand_factor = (
                demand_factor
            )

            pricing.demand_adjusted_cost = (
                demand_adjusted_cost
            )

            db.commit()

            db.refresh(pricing)

        # -------------------------------------------------
        # CREATE PRICING RECORD IF MISSING
        # -------------------------------------------------

        else:

            pricing = Pricing(

                route_id=
                    quotation.selected_route_id,

                fuel_surcharge=
                    fuel_surcharge,

                port_charge=
                    port_charge,

                risk_surcharge=
                    risk_surcharge,

                operating_cost=
                    operating_cost,

                demand_factor=
                    demand_factor,

                demand_adjusted_cost=
                    demand_adjusted_cost
            )

            db.add(pricing)

            db.commit()

            db.refresh(pricing)

        # -------------------------------------------------
        # RETURN ACTUAL PRICING
        # -------------------------------------------------

        return {

            "base_freight_usd":
                base_freight,

            "fuel_surcharge_usd":
                fuel_surcharge,

            "port_charge_usd":
                port_charge,

            "risk_surcharge_usd":
                risk_surcharge,

            "operating_cost_usd":
                operating_cost,

            "demand_factor":
                demand_factor,

            "demand_adjusted_cost_usd":
                demand_adjusted_cost,

            "pricing_record":
                pricing
        }

    except Exception as pricing_error:

        print(
            "Pricing Agent fallback failed:",
            pricing_error
        )

        return {

            "base_freight_usd":
                float(
                    selected_route.base_freight_usd or 0
                )
                if selected_route
                else 0,

            "fuel_surcharge_usd": 0,

            "port_charge_usd": 0,

            "risk_surcharge_usd": 0,

            "operating_cost_usd": 0,

            "demand_factor": 1.0,

            "demand_adjusted_cost_usd": 0,

            "pricing_record":
                pricing
        }


# =========================================================
# GET ALL ADMIN QUOTATIONS
# =========================================================

@router.get("/")
def get_admin_quotations(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # ADMIN ACCESS CHECK
    # -----------------------------------------------------

    if not verify_admin(current_user):

        return {
            "success": False,
            "message": "Admin access required."
        }

    # -----------------------------------------------------
    # GET ADMIN-RELEVANT QUOTATIONS
    # -----------------------------------------------------

    quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_([
                "pending",
                "approved",
                "rejected"
            ])
        )
        .order_by(
            QuotationRequestDB.id.desc()
        )
        .all()
    )

    quotation_list = []

    # -----------------------------------------------------
    # BUILD RESPONSE
    # -----------------------------------------------------

    for quotation in quotations:

        # -------------------------------------------------
        # CUSTOMER DETAILS
        # -------------------------------------------------

        customer = (
            db.query(User)
            .filter(
                User.id ==
                quotation.user_id
            )
            .first()
        )

        # -------------------------------------------------
        # SELECTED ROUTE
        # -------------------------------------------------

        selected_route = (
            db.query(Route)
            .filter(
                Route.route_id ==
                quotation.selected_route_id
            )
            .first()
        )

        # -------------------------------------------------
        # FALLBACK TO ROUTE AGENT
        # -------------------------------------------------

        if selected_route is None:

            try:

                route_agent = RouteAgent()

                route_result = (
                    route_agent.analyze_route(

                        origin=
                            quotation.origin,

                        destination=
                            quotation.destination,

                        cargo_type=
                            quotation.cargo_type,

                        containers=
                            quotation.container_count
                    )
                )

                route_candidates = []

                route_candidates.extend(
                    route_result.get(
                        "available_routes",
                        []
                    ) or []
                )

                route_candidates.extend(
                    route_result.get(
                        "top_routes",
                        []
                    ) or []
                )

                matched_route = next(
                    (
                        route
                        for route in route_candidates
                        if str(
                            route.get(
                                "route_id",
                                ""
                            )
                        ).strip().lower()
                        ==
                        str(
                            quotation.selected_route_id
                        ).strip().lower()
                    ),
                    None
                )

                if matched_route:

                    selected_route = SimpleNamespace(

                        route_id=
                            matched_route.get(
                                "route_id"
                            ),

                        origin=
                            matched_route.get(
                                "origin",
                                quotation.origin
                            ),

                        destination=
                            matched_route.get(
                                "destination",
                                quotation.destination
                            ),

                        distance_nm=
                            matched_route.get(
                                "distance_nm"
                            ),

                        transit_days=
                            matched_route.get(
                                "transit_days",
                                matched_route.get(
                                    "transit_time_days"
                                )
                            ),

                        transshipments=
                            matched_route.get(
                                "transshipments",
                                0
                            ),

                        route_type=
                            matched_route.get(
                                "route_type"
                            ),

                        base_freight_usd=
                            matched_route.get(
                                "base_freight_usd",
                                0
                            )
                    )

            except Exception as route_fallback_error:

                print(
                    "Admin route fallback failed:",
                    route_fallback_error
                )

        # -------------------------------------------------
        # ALL ROUTES STORED FOR QUOTATION
        # -------------------------------------------------

        quotation_routes = (
            db.query(QuotationRoute)
            .filter(
                QuotationRoute.quotation_id ==
                quotation.id
            )
            .order_by(
                QuotationRoute.rank.asc()
            )
            .all()
        )

        routes = []

        for quotation_route in quotation_routes:

            route = (
                db.query(Route)
                .filter(
                    Route.route_id ==
                    quotation_route.route_id
                )
                .first()
            )

            routes.append({

                "route_id":
                    quotation_route.route_id,

                "rank":
                    quotation_route.rank,

                "route_score":
                    quotation_route.route_score,

                "base_freight_usd":
                    quotation_route.base_freight_usd,

                "origin":
                    route.origin
                    if route
                    else quotation.origin,

                "destination":
                    route.destination
                    if route
                    else quotation.destination,

                "distance_nm":
                    route.distance_nm
                    if route
                    else None,

                "transit_days":
                    route.transit_days
                    if route
                    else None,

                "transshipments":
                    route.transshipments
                    if route
                    else None,

                "route_type":
                    route.route_type
                    if route
                    else None,

                "cargo_type":
                    quotation.cargo_type,

                "container_count":
                    quotation.container_count,
            })

        # =================================================
        # PRICING
        # =================================================

        pricing_data = get_pricing_data(
            db=db,
            quotation=quotation,
            selected_route=selected_route
        )

        # -------------------------------------------------
        # BASIC PRICING VALUES
        # -------------------------------------------------

        base_freight = (
            pricing_data.get(
                "base_freight_usd",
                0
            )
        )

        fuel_surcharge = (
            pricing_data.get(
                "fuel_surcharge_usd",
                0
            )
        )

        port_charge = (
            pricing_data.get(
                "port_charge_usd",
                0
            )
        )

        risk_surcharge = (
            pricing_data.get(
                "risk_surcharge_usd",
                0
            )
        )

        operating_cost = (
            pricing_data.get(
                "operating_cost_usd",
                0
            )
        )

        demand_factor = (
            pricing_data.get(
                "demand_factor",
                1.0
            )
        )

        demand_adjusted_cost = (
            pricing_data.get(
                "demand_adjusted_cost_usd",
                0
            )
        )

        # =================================================
        # WEATHER INFORMATION
        # =================================================

        weather_condition = "—"
        weather_risk = "—"

        try:

            weather_result = weather_agent.assess_weather(
                quotation.selected_route_id
            )

            if weather_result.get("status") == "success":

                weather_condition = weather_result.get(
                    "weather_condition",
                    "—"
                )

                weather_risk = weather_result.get(
                    "weather_risk",
                    "—"
                )

        except Exception as weather_error:

            print(
                "Admin weather assessment failed:",
                weather_error
            )

        # =================================================
        # CUSTOMS INFORMATION
        # =================================================

        customs_status = "—"

        try:

            customs_result = customs_agent.validate_customs(
                quotation.selected_route_id
            )

            if customs_result.get("status") == "success":

                customs_status = customs_result.get(
                    "customs_status",
                    "—"
                )

        except Exception as customs_error:

            print(
                "Admin customs validation failed:",
                customs_error
            )

        # -------------------------------------------------
        # TARGET MARGIN
        # -------------------------------------------------

        target_margin_percent = (

            quotation.target_margin * 100

            if quotation.target_margin
            is not None

            else None
        )

        # -------------------------------------------------
        # FINAL SELLING PRICE
        # -------------------------------------------------

        final_selling_price = (

            quotation.selling_price

            if quotation.selling_price
            is not None

            else 0
        )

        final_selling_price = float(
            final_selling_price or 0
        )

        # -------------------------------------------------
        # MARGIN AMOUNT
        # -------------------------------------------------

        margin_amount = (
            final_selling_price
            -
            float(
                demand_adjusted_cost or 0
            )
        )

        # -------------------------------------------------
        # ACTUAL MARGIN
        # -------------------------------------------------

        actual_margin_percent = None

        if final_selling_price > 0:

            actual_margin_percent = (

                margin_amount
                /
                final_selling_price

            ) * 100

        # -------------------------------------------------
        # PROFIT
        # -------------------------------------------------

        profit_usd = None

        if (
            quotation.status or ""
        ).lower() == "approved":

            profit_usd = margin_amount

        # -------------------------------------------------
        # STATUS
        # -------------------------------------------------

        status = (
            quotation.status or ""
        ).lower()

        # =================================================
        # ADD QUOTATION
        # =================================================

        quotation_list.append({

            # ---------------------------------------------
            # IDENTIFICATION
            # ---------------------------------------------

            "id":
                quotation.id,

            "quotation_id":
                quotation.id,

            # ---------------------------------------------
            # CUSTOMER
            # ---------------------------------------------

            "customer": {

                "id":
                    customer.id
                    if customer
                    else quotation.user_id,

                "name":
                    customer.name
                    if customer
                    else "Unknown Customer",

                "email":
                    customer.email
                    if customer
                    else "",

                "company_name":
                    customer.company_name
                    if customer
                    else "",
            },

            # ---------------------------------------------
            # SHIPMENT
            # ---------------------------------------------

            "origin":
                quotation.origin,

            "destination":
                quotation.destination,

            "cargo_type":
                quotation.cargo_type,

            "container_type":
                quotation.container_type,

            "container_count":
                quotation.container_count,

            # ---------------------------------------------
            # SELECTED ROUTE
            # ---------------------------------------------

            "selected_route_id":
                quotation.selected_route_id,

            "selected_route": (

                {

                    "route_id":
                        selected_route.route_id,

                    "origin":
                        selected_route.origin,

                    "destination":
                        selected_route.destination,

                    "distance_nm":
                        selected_route.distance_nm,

                    "transit_days":
                        selected_route.transit_days,

                    "transshipments":
                        selected_route.transshipments,

                    "route_type":
                        selected_route.route_type,

                    "base_freight_usd":
                        selected_route.base_freight_usd,

                    "route_score":
                        next(
                            (
                                qr.route_score
                                for qr
                                in quotation_routes

                                if qr.route_id ==
                                quotation.selected_route_id
                            ),
                            None
                        ),
                }

                if selected_route

                else None
            ),

            # ---------------------------------------------
            # TOP ROUTES
            # ---------------------------------------------

            "routes":
                routes,

            "top_routes":
                routes,

            # =================================================
            # WEATHER
            # =================================================

            "weather_condition":
                weather_condition,

            "weather_risk":
                weather_risk,

            # Frontend compatibility
            "weather_risk_factor":
                weather_risk,

            # =================================================
            # CUSTOMS
            # =================================================

            "customs_status":
                customs_status,

            # =================================================
            # PRICING
            # =================================================

            "pricing": {

                "base_freight_usd":
                    base_freight,

                "fuel_surcharge_usd":
                    fuel_surcharge,

                "port_charge_usd":
                    port_charge,

                "risk_surcharge_usd":
                    risk_surcharge,

                "operating_cost_usd":
                    operating_cost,

                "demand_factor":
                    demand_factor,

                "demand_adjusted_cost_usd":
                    demand_adjusted_cost,

                "target_margin_percent":
                    target_margin_percent,

                "margin_amount_usd":
                    margin_amount,

                "final_selling_price_usd":
                    final_selling_price,

                "actual_margin_percent":
                    actual_margin_percent,

                "profit_usd":
                    profit_usd,
            },

            # ---------------------------------------------
            # FLAT VALUES
            # ---------------------------------------------

            "base_freight_usd":
                base_freight,

            "fuel_surcharge_usd":
                fuel_surcharge,

            "port_charge_usd":
                port_charge,

            "risk_surcharge_usd":
                risk_surcharge,

            "total_operational_cost_usd":
                operating_cost,

            "demand_factor":
                demand_factor,

            "total_demand_adjusted_cost_usd":
                demand_adjusted_cost,

            "target_margin_percent":
                target_margin_percent,

            "margin_amount_usd":
                margin_amount,

            "final_selling_price_usd":
                final_selling_price,

            "actual_margin_percent":
                actual_margin_percent,

            "profit_usd":
                profit_usd,

            # ---------------------------------------------
            # STATUS
            # ---------------------------------------------

            "status":
                status,

            # ---------------------------------------------
            # DATE
            # ---------------------------------------------

            "created_at":
                quotation.created_at,
        })

    # =====================================================
    # RESPONSE
    # =====================================================

    return {

        "success":
            True,

        "total_quotations":
            len(quotation_list),

        "quotations":
            quotation_list
    }


# =========================================================
# APPROVE QUOTATION
# =========================================================

@router.post("/{quotation_id}/approve")
def approve_quotation(
    quotation_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if not verify_admin(current_user):

        return {
            "success": False,
            "message": "Admin access required."
        }

    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id ==
            quotation_id
        )
        .first()
    )

    if not quotation:

        return {
            "success": False,
            "message": "Quotation not found."
        }

    current_status = (
        quotation.status or ""
    ).lower()

    if current_status == "saved":

        return {
            "success": False,
            "message": (
                "This quotation has not been "
                "sent for approval."
            )
        }

    if current_status == "approved":

        return {
            "success": False,
            "message": (
                "This quotation has already "
                "been approved."
            )
        }

    if current_status == "rejected":

        return {
            "success": False,
            "message": (
                "This quotation has already "
                "been rejected."
            )
        }

    if current_status != "pending":

        return {
            "success": False,
            "message": (
                "Only pending quotations "
                "can be approved."
            )
        }

    quotation.status = "approved"

    db.commit()
    db.refresh(quotation)

    activity = Activity(

        user_id=
            quotation.user_id,

        activity_type=
            "quotation_approved",

        description=(
            f"Quotation #{quotation.id} "
            f"for route "
            f"{quotation.selected_route_id} "
            f"has been approved by admin."
        )
    )

    db.add(activity)

    db.commit()

    try:

        customer = (
            db.query(User)
            .filter(
                User.id ==
                quotation.user_id
            )
            .first()
        )

        if customer and customer.email:

            EmailService.send_quotation_approved_email(

                recipient_email=
                    customer.email,

                customer_name=
                    customer.name,

                origin=
                    quotation.origin,

                destination=
                    quotation.destination,

                cargo_type=
                    quotation.cargo_type,

                containers=
                    quotation.container_count
            )

    except Exception as email_error:

        print(
            "Quotation approval email failed:",
            email_error
        )

    return {

        "success":
            True,

        "message":
            "Quotation approved successfully.",

        "quotation": {

            "id":
                quotation.id,

            "status":
                quotation.status
        }
    }


# =========================================================
# REJECT QUOTATION
# =========================================================

@router.post("/{quotation_id}/reject")
def reject_quotation(
    quotation_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    if not verify_admin(current_user):

        return {
            "success": False,
            "message": "Admin access required."
        }

    quotation = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.id ==
            quotation_id
        )
        .first()
    )

    if not quotation:

        return {
            "success": False,
            "message": "Quotation not found."
        }

    current_status = (
        quotation.status or ""
    ).lower()

    if current_status == "saved":

        return {
            "success": False,
            "message": (
                "This quotation has not been "
                "sent for approval."
            )
        }

    if current_status == "approved":

        return {
            "success": False,
            "message": (
                "This quotation has already "
                "been approved."
            )
        }

    if current_status == "rejected":

        return {
            "success": False,
            "message": (
                "This quotation has already "
                "been rejected."
            )
        }

    if current_status != "pending":

        return {
            "success": False,
            "message": (
                "Only pending quotations "
                "can be rejected."
            )
        }

    quotation.status = "rejected"

    db.commit()
    db.refresh(quotation)

    activity = Activity(

        user_id=
            quotation.user_id,

        activity_type=
            "quotation_rejected",

        description=(
            f"Quotation #{quotation.id} "
            f"for route "
            f"{quotation.selected_route_id} "
            f"was rejected by admin."
        )
    )

    db.add(activity)

    db.commit()

    try:

        customer = (
            db.query(User)
            .filter(
                User.id ==
                quotation.user_id
            )
            .first()
        )

        if customer and customer.email:

            EmailService.send_quotation_rejected_email(

                recipient_email=
                    customer.email,

                customer_name=
                    customer.name,

                origin=
                    quotation.origin,

                destination=
                    quotation.destination,

                cargo_type=
                    quotation.cargo_type,

                containers=
                    quotation.container_count
            )

    except Exception as email_error:

        print(
            "Quotation rejection email failed:",
            email_error
        )

    return {

        "success":
            True,

        "message":
            "Quotation rejected successfully.",

        "quotation": {

            "id":
                quotation.id,

            "status":
                quotation.status
        }
    }