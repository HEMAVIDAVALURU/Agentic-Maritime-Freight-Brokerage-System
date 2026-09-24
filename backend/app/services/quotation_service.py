from sqlalchemy.orm import Session

from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent

from app.db_models import (
    QuotationRequestDB,
    QuotationRoute,
    SavedQuotation,
    Pricing
)


class QuotationService:

    def __init__(self):

        self.route_agent = RouteAgent()

        self.pricing_agent = PricingAgent()

    # =========================================================
    # GENERATE QUOTATION
    # =========================================================

    def generate_quotation(
        self,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int,
        route_id: str | None = None
    ):

        # -----------------------------------------------------
        # ROUTE ANALYSIS
        # -----------------------------------------------------

        route_result = self.route_agent.analyze_route(

            origin=origin,

            destination=destination,

            cargo_type=cargo_type,

            containers=containers

        )

        if not route_result:

            return {

                "status": "error",

                "message":
                    "Unable to analyze route."

            }

        if route_result.get("status") != "success":

            return route_result

        # -----------------------------------------------------
        # SELECT ROUTE
        # -----------------------------------------------------

        selected_route = None

        # -----------------------------------------------------
        # If a specific route_id was requested,
        # search inside top routes first.
        # -----------------------------------------------------

        if route_id:

            for route in route_result.get(
                "top_routes",
                []
            ):

                if route.get("route_id") == route_id:

                    selected_route = route

                    break

        # -----------------------------------------------------
        # If not found, search all available routes.
        # -----------------------------------------------------

        if route_id and selected_route is None:

            for route in route_result.get(
                "available_routes",
                []
            ):

                if route.get("route_id") == route_id:

                    selected_route = route

                    break

        # -----------------------------------------------------
        # Otherwise use recommended route.
        # -----------------------------------------------------

        if selected_route is None:

            selected_route = route_result.get(
                "recommended_route"
            )

        # -----------------------------------------------------
        # Final fallback: first top route.
        # -----------------------------------------------------

        if selected_route is None:

            top_routes = route_result.get(
                "top_routes",
                []
            )

            if top_routes:

                selected_route = top_routes[0]

        # -----------------------------------------------------
        # No route found.
        # -----------------------------------------------------

        if selected_route is None:

            return {

                "status": "error",

                "message":
                    "No suitable route found."

            }

        # =====================================================
        # PRICING
        # =====================================================

        pricing_result = self.pricing_agent.calculate_price(

            route=selected_route,

            containers=containers

        )

        if not pricing_result:

            return {

                "status": "error",

                "message":
                    "Unable to calculate pricing."

            }

        # -----------------------------------------------------
        # Pricing Agent may return an error.
        # -----------------------------------------------------

        if isinstance(
            pricing_result,
            dict
        ):

            if pricing_result.get(
                "status"
            ) == "error":

                return pricing_result

        # =====================================================
        # FINAL RESPONSE
        # =====================================================

        return {

            "status": "success",

            "origin":
                origin,

            "destination":
                destination,

            "cargo_type":
                cargo_type,

            "containers":
                containers,

            "recommended_route":
                selected_route,

            "route_id":
                selected_route.get(
                    "route_id"
                ),

            "route_score":
                selected_route.get(
                    "route_score",
                    0
                ),

            "freight_per_container_usd":
                selected_route.get(
                    "base_freight_usd",
                    0
                ),

            "total_freight_usd": (

                float(

                    selected_route.get(
                        "base_freight_usd",
                        0
                    )

                )
                * containers

            ),

            "top_routes":
                route_result.get(
                    "top_routes",
                    []
                ),

            "available_routes":
                route_result.get(
                    "available_routes",
                    []
                ),

            "pricing":
                pricing_result

        }

    # =========================================================
    # SAVE QUOTATION
    # =========================================================
    #
    # Current customer flow:
    #
    # Route Analysis
    #       ↓
    # Select Route
    #       ↓
    # Calculate Price
    #       ↓
    # Final Selling Price
    #       ↓
    # Save Quotation
    #
    # OR
    #
    # Calculate Price
    #       ↓
    # Request Approval
    #       ↓
    # Automatically Saved
    #       ↓
    # Pending
    #
    # =========================================================

    def save_quotation(
        self,
        db: Session,
        user_id: int,
        quotation: dict
    ):

        # =====================================================
        # BASIC VALIDATION
        # =====================================================

        if not quotation:

            return {

                "status": "error",

                "message":
                    "Quotation data is required."

            }

        # -----------------------------------------------------
        # Only successful quotation results can be saved.
        # -----------------------------------------------------

        if quotation.get(
            "status"
        ) != "success":

            return {

                "status": "error",

                "message":
                    "Only a successfully generated quotation can be saved."

            }

        # =====================================================
        # ROUTE ID
        # =====================================================

        route_id = quotation.get(
            "route_id"
        )

        # -----------------------------------------------------
        # Fallback to recommended route.
        # -----------------------------------------------------

        if not route_id:

            recommended_route = quotation.get(
                "recommended_route"
            )

            if recommended_route:

                route_id = recommended_route.get(
                    "route_id"
                )

        if not route_id:

            return {

                "status": "error",

                "message":
                    "Route ID is required."

            }

        # =====================================================
        # CONTAINER COUNT
        # =====================================================

        containers = quotation.get(

            "containers",

            quotation.get(
                "container_count",
                0
            )

        )

        try:

            containers = int(
                containers
            )

        except (
            TypeError,
            ValueError
        ):

            return {

                "status": "error",

                "message":
                    "Invalid container quantity."

            }

        if containers <= 0:

            return {

                "status": "error",

                "message":
                    "Container quantity must be greater than zero."

            }

        # =====================================================
        # BASIC QUOTATION INFORMATION
        # =====================================================

        origin = quotation.get(
            "origin",
            ""
        )

        destination = quotation.get(
            "destination",
            ""
        )

        cargo_type = quotation.get(
            "cargo_type",
            ""
        )

        # =====================================================
        # DUPLICATE QUOTATION CHECK
        # =====================================================
        #
        # Prevent the same quotation from being saved twice.
        #
        # =====================================================

        duplicate = (

            db.query(
                SavedQuotation
            )

            .join(

                QuotationRequestDB,

                SavedQuotation.quotation_id
                ==
                QuotationRequestDB.id

            )

            .filter(

                SavedQuotation.user_id
                ==
                user_id,

                QuotationRequestDB.selected_route_id
                ==
                route_id,

                QuotationRequestDB.origin
                ==
                origin,

                QuotationRequestDB.destination
                ==
                destination,

                QuotationRequestDB.cargo_type
                ==
                cargo_type,

                QuotationRequestDB.container_count
                ==
                containers

            )

            .first()

        )

        if duplicate:

            return {

                "status":
                    "already_saved",

                "message":
                    "This quotation is already saved.",

                "quotation_id":
                    duplicate.quotation_id,

                "saved_quotation_id":
                    duplicate.id

            }

        # =====================================================
        # PRICING VALUES
        # =====================================================

        pricing_data = quotation.get(
            "pricing",
            {}
        )

        if not isinstance(
            pricing_data,
            dict
        ):

            pricing_data = {}

        # -----------------------------------------------------
        # Target Margin
        # -----------------------------------------------------

        target_margin_percent = quotation.get(

            "target_margin_percent",

            pricing_data.get(

                "target_margin_percent",

                0

            )

        )

        # -----------------------------------------------------
        # Margin Amount
        # -----------------------------------------------------

        margin_amount_usd = quotation.get(

            "margin_amount_usd",

            pricing_data.get(

                "margin_amount_usd",

                0

            )

        )

        # -----------------------------------------------------
        # Actual Margin
        # -----------------------------------------------------

        actual_margin_percent = quotation.get(

            "actual_margin_percent",

            pricing_data.get(

                "actual_margin_percent",

                target_margin_percent

            )

        )

        # -----------------------------------------------------
        # Final Selling Price
        # -----------------------------------------------------

        final_selling_price_usd = quotation.get(

            "final_selling_price_usd",

            pricing_data.get(

                "final_selling_price_usd",

                quotation.get(
                    "selling_price",
                    0
                )

            )

        )

        # =====================================================
        # SAFE NUMERIC CONVERSION
        # =====================================================

        try:

            target_margin_percent = float(

                target_margin_percent or 0

            )

        except (
            TypeError,
            ValueError
        ):

            target_margin_percent = 0

        try:

            margin_amount_usd = float(

                margin_amount_usd or 0

            )

        except (
            TypeError,
            ValueError
        ):

            margin_amount_usd = 0

        try:

            actual_margin_percent = float(

                actual_margin_percent or 0

            )

        except (
            TypeError,
            ValueError
        ):

            actual_margin_percent = 0

        try:

            final_selling_price_usd = float(

                final_selling_price_usd or 0

            )

        except (
            TypeError,
            ValueError
        ):

            final_selling_price_usd = 0

        # =====================================================
        # VALIDATE SELLING PRICE
        # =====================================================

        if final_selling_price_usd <= 0:

            return {

                "status": "error",

                "message":
                    "Invalid final selling price."

            }

        # =====================================================
        # CONVERT MARGIN PERCENT TO FRACTION
        # =====================================================
        #
        # Database stores margin as a fraction.
        #
        # Example:
        #
        # 15%  → 0.15
        #
        # If the value is already 0.15, keep it as-is.
        #
        # =====================================================

        target_margin_fraction = (

            target_margin_percent / 100

            if target_margin_percent > 1

            else target_margin_percent

        )

        # =====================================================
        # CREATE QUOTATION REQUEST
        # =====================================================

        quotation_request = QuotationRequestDB(

            user_id=user_id,

            origin=origin,

            destination=destination,

            cargo_type=cargo_type,

            container_type="Standard",

            container_count=containers,

            selected_route_id=route_id,

            target_margin=target_margin_fraction,

            selling_price=final_selling_price_usd,

            status="saved"

        )

        db.add(
            quotation_request
        )

        # -----------------------------------------------------
        # Generate quotation ID before child records.
        # -----------------------------------------------------

        db.flush()

        # =====================================================
        # SAVE TOP 3 ROUTES
        # =====================================================

        top_routes = quotation.get(

            "top_routes",

            []

        )

        # -----------------------------------------------------
        # Backward compatibility for older quotation payloads.
        # -----------------------------------------------------

        if not top_routes:

            top_routes = (

                quotation

                .get(
                    "route_analysis",
                    {}
                )

                .get(
                    "top_routes",
                    []
                )

            )

        # -----------------------------------------------------
        # Save each available top route.
        # -----------------------------------------------------

        for index, route in enumerate(

            top_routes,

            start=1

        ):

            quotation_route_id = route.get(
                "route_id"
            )

            if not quotation_route_id:

                continue

            route_rank = route.get(

                "rank",

                index

            )

            route_score = route.get(

                "route_score",

                0

            )

            base_freight = route.get(

                "base_freight_usd",

                0

            )

            quotation_route = QuotationRoute(

                quotation_id=
                    quotation_request.id,

                route_id=
                    quotation_route_id,

                rank=int(
                    route_rank
                ),

                route_score=float(
                    route_score or 0
                ),

                base_freight_usd=float(
                    base_freight or 0
                )

            )

            db.add(
                quotation_route
            )

        # =====================================================
        # SAVE INTERNAL PRICING INFORMATION
        # =====================================================
        #
        # These values are NOT returned to the customer through
        # GET /api/quotations/saved/{user_id}.
        #
        # They remain stored for the Admin workflow.
        #
        # =====================================================

        fuel_surcharge = quotation.get(

            "fuel_surcharge_usd",

            pricing_data.get(

                "fuel_surcharge_usd",

                pricing_data.get(
                    "fuel_surcharge",
                    0
                )

            )

        )

        port_charge = quotation.get(

            "port_charge_usd",

            pricing_data.get(

                "port_charge_usd",

                pricing_data.get(
                    "port_charge",
                    0
                )

            )

        )

        risk_surcharge = quotation.get(

            "risk_surcharge_usd",

            pricing_data.get(

                "risk_surcharge_usd",

                pricing_data.get(
                    "risk_surcharge",
                    0
                )

            )

        )

        operating_cost = quotation.get(

            "total_operational_cost_usd",

            pricing_data.get(

                "total_operational_cost_usd",

                pricing_data.get(

                    "operating_cost_usd",

                    pricing_data.get(
                        "operating_cost",
                        0
                    )

                )

            )

        )

        demand_factor = quotation.get(

            "demand_factor",

            pricing_data.get(

                "demand_factor",

                1.0

            )

        )

        demand_adjusted_cost = quotation.get(

            "demand_adjusted_total_cost_usd",

            pricing_data.get(

                "demand_adjusted_total_cost_usd",

                pricing_data.get(

                    "demand_adjusted_cost_usd",

                    pricing_data.get(
                        "demand_adjusted_cost",
                        0
                    )

                )

            )

        )

        # =====================================================
        # SAFE PRICING CONVERSION
        # =====================================================

        try:

            fuel_surcharge = float(
                fuel_surcharge or 0
            )

        except (
            TypeError,
            ValueError
        ):

            fuel_surcharge = 0

        try:

            port_charge = float(
                port_charge or 0
            )

        except (
            TypeError,
            ValueError
        ):

            port_charge = 0

        try:

            risk_surcharge = float(
                risk_surcharge or 0
            )

        except (
            TypeError,
            ValueError
        ):

            risk_surcharge = 0

        try:

            operating_cost = float(
                operating_cost or 0
            )

        except (
            TypeError,
            ValueError
        ):

            operating_cost = 0

        try:

            demand_factor = float(
                demand_factor or 1.0
            )

        except (
            TypeError,
            ValueError
        ):

            demand_factor = 1.0

        try:

            demand_adjusted_cost = float(
                demand_adjusted_cost or 0
            )

        except (
            TypeError,
            ValueError
        ):

            demand_adjusted_cost = 0

        # =====================================================
        # CREATE PRICING RECORD
        # =====================================================

        pricing_record = Pricing(

            route_id=route_id,

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

        db.add(
            pricing_record
        )

        # =====================================================
        # CREATE SAVED QUOTATION
        # =====================================================

        saved_quotation = SavedQuotation(

            user_id=user_id,

            quotation_id=
                quotation_request.id

        )

        db.add(
            saved_quotation
        )

        # =====================================================
        # COMMIT
        # =====================================================

        try:

            db.commit()

        except Exception:

            db.rollback()

            raise

        # =====================================================
        # REFRESH
        # =====================================================

        db.refresh(
            quotation_request
        )

        db.refresh(
            saved_quotation
        )

        # =====================================================
        # RETURN SUCCESS
        # =====================================================

        return {

            "status":
                "success",

            "message":
                "Quotation saved successfully.",

            "quotation_id":
                quotation_request.id,

            "saved_quotation_id":
                saved_quotation.id,

            "route_id":
                route_id,

            "selling_price":
                final_selling_price_usd,

            "target_margin_percent":
                target_margin_percent,

            "margin_amount_usd":
                margin_amount_usd,

            "actual_margin_percent":
                actual_margin_percent

        }