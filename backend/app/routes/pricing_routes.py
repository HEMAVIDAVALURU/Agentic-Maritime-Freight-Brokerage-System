from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    Pricing,
    Route,
    User,
    QuotationRequestDB,
)
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/pricing",
    tags=["Pricing Management"]
)


# =========================================================
# ADMIN VERIFICATION
# =========================================================

def verify_admin(current_user):
    return current_user.role == "admin"


# =========================================================
# ADMIN PRICING
# ONLY APPROVED QUOTATIONS ARE SHOWN
# =========================================================

@router.get("/admin")
def get_admin_pricing(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # Admin access check
    # -----------------------------------------------------

    if not verify_admin(current_user):
        return {
            "success": False,
            "message": "Admin access required."
        }

    # -----------------------------------------------------
    # Get ONLY approved quotations
    # -----------------------------------------------------

    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "approved"
        )
        .order_by(
            QuotationRequestDB.id.desc()
        )
        .all()
    )

    pricing_list = []

    # -----------------------------------------------------
    # Build pricing information for every approved quotation
    # -----------------------------------------------------

    for quotation in approved_quotations:

        # -------------------------------------------------
        # Customer
        # -------------------------------------------------

        customer = (
            db.query(User)
            .filter(
                User.id == quotation.user_id
            )
            .first()
        )

        # -------------------------------------------------
        # Selected master route
        # -------------------------------------------------

        route = (
            db.query(Route)
            .filter(
                Route.route_id == quotation.selected_route_id
            )
            .first()
        )

        if not route:
            continue

        # -------------------------------------------------
        # Latest pricing record for selected route
        # -------------------------------------------------

        pricing = (
            db.query(Pricing)
            .filter(
                Pricing.route_id == quotation.selected_route_id
            )
            .order_by(
                Pricing.id.desc()
            )
            .first()
        )

        if not pricing:
            continue

        # -------------------------------------------------
        # Base freight
        #
        # Route.base_freight_usd is per container
        # -------------------------------------------------

        base_freight_per_container = (
            route.base_freight_usd or 0
        )

        container_count = (
            quotation.container_count or 0
        )

        total_base_freight = (
            base_freight_per_container
            * container_count
        )

        # -------------------------------------------------
        # Pricing values
        # -------------------------------------------------

        fuel_surcharge = (
            pricing.fuel_surcharge or 0
        )

        port_charge = (
            pricing.port_charge or 0
        )

        risk_surcharge = (
            pricing.risk_surcharge or 0
        )

        operating_cost = (
            pricing.operating_cost or 0
        )

        demand_factor = (
            pricing.demand_factor
            if pricing.demand_factor is not None
            else 1.0
        )

        demand_adjusted_cost = (
            pricing.demand_adjusted_cost or 0
        )

        # -------------------------------------------------
        # Margin information
        #
        # target_margin is stored as decimal:
        # 0.15 = 15%
        # -------------------------------------------------

        target_margin_percent = (
            quotation.target_margin * 100
            if quotation.target_margin is not None
            else 0
        )

        final_selling_price = (
            quotation.selling_price or 0
        )

        margin_amount = (
            final_selling_price
            - demand_adjusted_cost
        )

        # -------------------------------------------------
        # Actual margin
        # -------------------------------------------------

        if final_selling_price > 0:
            actual_margin_percent = (
                margin_amount
                / final_selling_price
                * 100
            )
        else:
            actual_margin_percent = 0

        # -------------------------------------------------
        # Profit
        #
        # Admin-only and only for approved quotations.
        # -------------------------------------------------

        profit = margin_amount

        # -------------------------------------------------
        # Add complete pricing record
        # -------------------------------------------------

        pricing_list.append({

            # =============================================
            # QUOTATION / CUSTOMER INFORMATION
            # =============================================

            "quotation_id": quotation.id,

            "customer_name": (
                customer.name
                if customer
                else "Unknown Customer"
            ),

            "customer_email": (
                customer.email
                if customer
                else ""
            ),

            "company_name": (
                customer.company_name
                if customer
                else ""
            ),

            # =============================================
            # SHIPMENT INFORMATION
            # =============================================

            "origin": quotation.origin,

            "destination": quotation.destination,

            "cargo_type": quotation.cargo_type,

            "container_type": quotation.container_type,

            "container_count": container_count,

            "selected_route_id": (
                quotation.selected_route_id
            ),

            # =============================================
            # BASE FREIGHT
            # =============================================

            "base_freight_usd": (
                base_freight_per_container
            ),

            "base_freight_per_container_usd": (
                base_freight_per_container
            ),

            "total_base_freight_usd": (
                total_base_freight
            ),

            # =============================================
            # PRICING DATASET VALUES
            # =============================================

            "fuel_surcharge": fuel_surcharge,

            "fuel_surcharge_usd": fuel_surcharge,

            "port_charge": port_charge,

            "port_charge_usd": port_charge,

            "risk_surcharge": risk_surcharge,

            "risk_surcharge_usd": risk_surcharge,

            # =============================================
            # CALCULATED COSTS
            # =============================================

            "operating_cost": operating_cost,

            "operating_cost_usd": operating_cost,

            "total_operational_cost_usd": operating_cost,

            "demand_factor": demand_factor,

            "demand_adjusted_cost": (
                demand_adjusted_cost
            ),

            "demand_adjusted_cost_usd": (
                demand_adjusted_cost
            ),

            "total_demand_adjusted_cost_usd": (
                demand_adjusted_cost
            ),

            # =============================================
            # MARGIN ANALYSIS
            # =============================================

            "target_margin_percent": (
                target_margin_percent
            ),

            "margin_amount_usd": (
                margin_amount
            ),

            "actual_margin_percent": (
                actual_margin_percent
            ),

            # =============================================
            # SELLING PRICE
            # =============================================

            "selling_price": (
                final_selling_price
            ),

            "final_selling_price_usd": (
                final_selling_price
            ),

            # =============================================
            # ADMIN-ONLY PROFIT
            # =============================================

            "profit_usd": profit,

            # =============================================
            # STATUS / DATE
            # =============================================

            "status": (
                quotation.status or ""
            ).lower(),

            "created_at": quotation.created_at,

            # =============================================
            # NESTED PRICING OBJECT
            # Useful for frontend
            # =============================================

            "pricing": {

                "base_freight_usd": (
                    base_freight_per_container
                ),

                "total_base_freight_usd": (
                    total_base_freight
                ),

                "fuel_surcharge_usd": (
                    fuel_surcharge
                ),

                "port_charge_usd": (
                    port_charge
                ),

                "risk_surcharge_usd": (
                    risk_surcharge
                ),

                "operating_cost_usd": (
                    operating_cost
                ),

                "total_operational_cost_usd": (
                    operating_cost
                ),

                "demand_factor": (
                    demand_factor
                ),

                "demand_adjusted_cost_usd": (
                    demand_adjusted_cost
                ),

                "total_demand_adjusted_cost_usd": (
                    demand_adjusted_cost
                ),

                "target_margin_percent": (
                    target_margin_percent
                ),

                "margin_amount_usd": (
                    margin_amount
                ),

                "final_selling_price_usd": (
                    final_selling_price
                ),

                "actual_margin_percent": (
                    actual_margin_percent
                ),

                "profit_usd": profit
            }
        })

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "success": True,
        "total_pricing_records": len(pricing_list),
        "pricing": pricing_list
    }