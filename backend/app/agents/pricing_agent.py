import os
import pandas as pd


class PricingAgent:

    def __init__(self):

        current_file = os.path.abspath(__file__)

        project_root = os.path.dirname(
            os.path.dirname(
                os.path.dirname(current_file)
            )
        )

        # =====================================================
        # PRICING CSV
        # =====================================================

        self.pricing_path = os.path.join(
            project_root,
            "app",
            "data",
            "pricing.csv"
        )

        self.pricing = pd.read_csv(
            self.pricing_path
        )

        # =====================================================
        # ROUTE CSV
        # Base freight comes from route data
        # =====================================================

        self.route_path = os.path.join(
            project_root,
            "app",
            "data",
            "route.csv"
        )

        self.routes = pd.read_csv(
            self.route_path
        )

    # =========================================================
    # CALCULATE PRICING + MARGIN
    # =========================================================

    def calculate_pricing(
        self,
        route_id,
        containers
    ):

        # =====================================================
        # FIND ROUTE
        # =====================================================

        route_data = self.routes[
            self.routes["route_id"]
            .astype(str)
            .str.upper()
            ==
            str(route_id).upper()
        ]

        if route_data.empty:

            return {
                "status": "not_found",
                "message": (
                    f"No route data found "
                    f"for route {route_id}"
                )
            }

        route = route_data.iloc[0]

        # =====================================================
        # FIND PRICING DATA
        # =====================================================

        pricing_data = self.pricing[
            self.pricing["route_id"]
            .astype(str)
            .str.upper()
            ==
            str(route_id).upper()
        ]

        if pricing_data.empty:

            return {
                "status": "not_found",
                "message": (
                    f"No pricing data found "
                    f"for route {route_id}"
                )
            }

        pricing = pricing_data.iloc[0]

        # =====================================================
        # INPUT VALUES
        # =====================================================

        base_freight = float(
            route["base_freight_usd"]
        )

        fuel_surcharge = float(
            pricing["fuel_surcharge_usd"]
        )

        port_charge = float(
            pricing["port_charge_usd"]
        )

        risk_surcharge = float(
            pricing["risk_surcharge_usd"]
        )

        demand_factor = float(
            pricing["demand_factor"]
        )

        target_margin_percent = float(
            pricing["target_margin_percent"]
        )

        containers = int(containers)

        # =====================================================
        # VALIDATE CONTAINER QUANTITY
        # =====================================================

        if containers <= 0:

            return {
                "status": "error",
                "message": (
                    "Container quantity "
                    "must be greater than 0."
                )
            }

        # =====================================================
        # OPERATIONAL COST PER CONTAINER
        # =====================================================

        operating_cost_per_container = (
            base_freight
            + fuel_surcharge
            + port_charge
            + risk_surcharge
        )

        # =====================================================
        # TOTAL OPERATIONAL COST
        # =====================================================

        total_operational_cost = (
            operating_cost_per_container
            * containers
        )

        # =====================================================
        # DEMAND ADJUSTED TOTAL COST
        # =====================================================

        demand_adjusted_total_cost = (
            total_operational_cost
            * demand_factor
        )

        # =====================================================
        # MARGIN AGENT
        #
        # Target margin is calculated on the final
        # selling price, not simply added to the cost.
        # =====================================================

        if (
            target_margin_percent < 0
            or target_margin_percent >= 100
        ):

            return {
                "status": "error",
                "message": (
                    "Target margin must be "
                    "between 0 and 100 percent."
                )
            }

        # =====================================================
        # FINAL SELLING PRICE
        # =====================================================

        final_selling_price = (
            demand_adjusted_total_cost
            /
            (
                1
                -
                target_margin_percent / 100
            )
        )

        # =====================================================
        # MARGIN AMOUNT
        #
        # This is the amount added above the
        # demand-adjusted cost to reach the
        # target selling price.
        # =====================================================

        margin_amount = (
            final_selling_price
            -
            demand_adjusted_total_cost
        )

        # =====================================================
        # ACTUAL MARGIN
        #
        # Internal validation of the calculated
        # selling price.
        # =====================================================

        actual_margin_percent = (
            margin_amount
            /
            final_selling_price
        ) * 100

        # =====================================================
        # INTERNAL PROFIT
        #
        # Kept for Admin/business analytics.
        # Customer UI should not display this field.
        # =====================================================

        profit = margin_amount

        # =====================================================
        # FINAL RESPONSE
        # =====================================================

        return {

            "status": "success",

            "route_id": route_id,

            "containers": containers,

            # =================================================
            # PRICING AGENT OUTPUT
            # =================================================

            "base_freight_usd": round(
                base_freight,
                2
            ),

            "fuel_surcharge_usd": round(
                fuel_surcharge,
                2
            ),

            "port_charge_usd": round(
                port_charge,
                2
            ),

            "risk_surcharge_usd": round(
                risk_surcharge,
                2
            ),

            "operating_cost_per_container_usd": round(
                operating_cost_per_container,
                2
            ),

            "total_operational_cost_usd": round(
                total_operational_cost,
                2
            ),

            "demand_factor": round(
                demand_factor,
                2
            ),

            "demand_adjusted_total_cost_usd": round(
                demand_adjusted_total_cost,
                2
            ),

            # =================================================
            # MARGIN AGENT OUTPUT
            # =================================================

            "target_margin_percent": round(
                target_margin_percent,
                2
            ),

            "margin_amount_usd": round(
                margin_amount,
                2
            ),

            "final_selling_price_usd": round(
                final_selling_price,
                2
            ),

            # =================================================
            # INTERNAL ADMIN VALUE
            # =================================================

            "actual_margin_percent": round(
                actual_margin_percent,
                2
            ),

            "profit_usd": round(
                profit,
                2
            )
        }