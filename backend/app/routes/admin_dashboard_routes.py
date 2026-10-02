from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User, QuotationRequestDB
from app.services.auth_dependency import get_current_user
from app.agents.pricing_agent import PricingAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent


router = APIRouter(
    prefix="/api/admin-dashboard",
    tags=["Admin Dashboard"]
)


# =========================================================
# AGENTS
# =========================================================

pricing_agent = PricingAgent()
weather_agent = WeatherAgent()
customs_agent = CustomsAgent()


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@router.get("/")
def get_admin_dashboard(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # =====================================================
    # ADMIN ACCESS CHECK
    # =====================================================

    if current_user.role != "admin":
        return {
            "success": False,
            "message": "Admin access required."
        }

    # =====================================================
    # USER STATISTICS
    # =====================================================

    total_users = (
        db.query(User)
        .filter(User.role == "customer")
        .count()
    )

    # =====================================================
    # ADMIN-RELEVANT QUOTATION STATUSES
    # =====================================================

    admin_statuses = [
        "pending",
        "approved",
        "rejected"
    ]

    # =====================================================
    # OVERALL QUOTATION STATISTICS
    # =====================================================

    total_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(admin_statuses)
        )
        .count()
    )

    pending_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "pending"
        )
        .count()
    )

    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "approved"
        )
        .count()
    )

    rejected_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "rejected"
        )
        .count()
    )

    # =====================================================
    # CURRENT DATE AND MONTH PERIODS
    # =====================================================

    now = datetime.now()

    current_month_start = datetime(
        now.year,
        now.month,
        1
    )

    if now.month == 12:
        next_month_start = datetime(
            now.year + 1,
            1,
            1
        )
    else:
        next_month_start = datetime(
            now.year,
            now.month + 1,
            1
        )

    # =====================================================
    # CURRENT MONTH QUOTATION SUMMARY
    # =====================================================

    # Total quotations created during the current month.

    current_month_total = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(admin_statuses),
            QuotationRequestDB.created_at >= current_month_start,
            QuotationRequestDB.created_at < next_month_start
        )
        .count()
    )

    # Approved quotations created during the current month.

    current_month_approved = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "approved",
            QuotationRequestDB.created_at >= current_month_start,
            QuotationRequestDB.created_at < next_month_start
        )
        .count()
    )

    # Rejected quotations created during the current month.

    current_month_rejected = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "rejected",
            QuotationRequestDB.created_at >= current_month_start,
            QuotationRequestDB.created_at < next_month_start
        )
        .count()
    )

    # Pending quotations created during the current month.

    current_month_pending = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "pending",
            QuotationRequestDB.created_at >= current_month_start,
            QuotationRequestDB.created_at < next_month_start
        )
        .count()
    )

    # Object consumed by the React Current Month section.

    current_month_summary = {
        "month": current_month_start.strftime("%B"),
        "year": now.year,
        "total_quotations": current_month_total,
        "approved_quotations": current_month_approved,
        "rejected_quotations": current_month_rejected,
        "pending_quotations": current_month_pending
    }

    # =====================================================
    # LAST THREE MONTHS
    # =====================================================

    monthly_periods = []

    # Example: October 2026
    # August 2026, September 2026, October 2026.

    for offset in range(2, -1, -1):

        month_number = now.month - offset
        year_number = now.year

        while month_number <= 0:
            month_number += 12
            year_number -= 1

        month_start = datetime(
            year_number,
            month_number,
            1
        )

        if month_number == 12:
            month_end = datetime(
                year_number + 1,
                1,
                1
            )
        else:
            month_end = datetime(
                year_number,
                month_number + 1,
                1
            )

        monthly_periods.append({
            "month": month_start.strftime("%B"),
            "year": year_number,
            "start": month_start,
            "end": month_end
        })

    # =====================================================
    # FINANCIAL KPI INITIAL VALUES
    # =====================================================

    total_selling_price = 0.0
    total_profit = 0.0
    total_loss = 0.0

    # =====================================================
    # APPROVED AND REJECTED FINANCIAL RECORDS
    # =====================================================

    financial_records = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(
                ["approved", "rejected"]
            )
        )
        .all()
    )

    # =====================================================
    # MONTHLY CHART DATA INITIALIZATION
    # =====================================================

    monthly_profit_data = []
    monthly_quotation_data = []

    for period in monthly_periods:

        monthly_profit_data.append({
            "month": period["month"],
            "year": period["year"],
            "profit": 0.0
        })

        monthly_quotation_data.append({
            "month": period["month"],
            "year": period["year"],
            "quotations": 0
        })

    # =====================================================
    # MONTHLY QUOTATION COUNTS
    # =====================================================

    for index, period in enumerate(monthly_periods):

        month_count = (
            db.query(QuotationRequestDB)
            .filter(
                QuotationRequestDB.status.in_(admin_statuses),
                QuotationRequestDB.created_at >= period["start"],
                QuotationRequestDB.created_at < period["end"]
            )
            .count()
        )

        monthly_quotation_data[index]["quotations"] = (
            month_count
        )

    # =====================================================
    # FINANCIAL KPI AND MONTHLY PROFIT CALCULATIONS
    # =====================================================

    for quotation in financial_records:

        try:

            quotation_status = (
                quotation.status or ""
            ).strip().lower()

            # ---------------------------------------------
            # APPROVED SELLING PRICE
            # ---------------------------------------------

            if (
                quotation_status == "approved"
                and quotation.selling_price is not None
            ):
                total_selling_price += float(
                    quotation.selling_price
                )

            # ---------------------------------------------
            # PRICING AGENT
            # ---------------------------------------------

            pricing_result = (
                pricing_agent.calculate_pricing(
                    route_id=quotation.selected_route_id,
                    containers=quotation.container_count
                )
            )

            if (
                not isinstance(pricing_result, dict)
                or pricing_result.get("status") != "success"
            ):
                continue

            profit = float(
                pricing_result.get("profit_usd", 0) or 0
            )

            # ---------------------------------------------
            # OVERALL PROFIT AND LOSS
            # ---------------------------------------------

            if quotation_status == "approved":
                total_profit += profit

            elif quotation_status == "rejected":
                total_loss += abs(profit)

            # ---------------------------------------------
            # MONTHLY PROFIT
            # ---------------------------------------------

            created_at = quotation.created_at

            if created_at is None:
                continue

            for index, period in enumerate(monthly_periods):

                if (
                    period["start"]
                    <= created_at
                    < period["end"]
                ):

                    if quotation_status == "approved":

                        monthly_profit_data[index]["profit"] += (
                            profit
                        )

                    elif quotation_status == "rejected":

                        monthly_profit_data[index]["profit"] -= (
                            abs(profit)
                        )

                    break

        except Exception as exc:

            print(
                f"Financial calculation error for quotation "
                f"{quotation.id}: {exc}"
            )

            continue

    # =====================================================
    # NET PROFIT
    # =====================================================

    net_profit = total_profit - total_loss

    # =====================================================
    # ROUND FINANCIAL VALUES
    # =====================================================

    total_selling_price = round(
        total_selling_price, 2
    )

    total_profit = round(
        total_profit, 2
    )

    total_loss = round(
        total_loss, 2
    )

    net_profit = round(
        net_profit, 2
    )

    for item in monthly_profit_data:

        item["profit"] = round(
            item["profit"], 2
        )

    # =====================================================
    # RECENT QUOTATIONS
    # =====================================================

    recent_records = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(admin_statuses)
        )
        .order_by(
            QuotationRequestDB.created_at.desc()
        )
        .limit(10)
        .all()
    )

    recent_quotations = []

    for quotation in recent_records:

        customer = (
            db.query(User)
            .filter(
                User.id == quotation.user_id
            )
            .first()
        )

        route_id = quotation.selected_route_id

        profit = None
        weather_risk = None
        customs_status = None

        # ---------------------------------------------
        # PRICING AGENT
        # ---------------------------------------------

        try:

            if route_id:

                pricing_result = (
                    pricing_agent.calculate_pricing(
                        route_id=route_id,
                        containers=quotation.container_count
                    )
                )

                if (
                    isinstance(pricing_result, dict)
                    and pricing_result.get("status") == "success"
                ):

                    profit_value = pricing_result.get(
                        "profit_usd"
                    )

                    if profit_value is None:

                        final_price = pricing_result.get(
                            "final_selling_price_usd"
                        )

                        operating_cost = pricing_result.get(
                            "demand_adjusted_total_cost_usd"
                        )

                        if (
                            final_price is not None
                            and operating_cost is not None
                        ):
                            profit_value = (
                                float(final_price)
                                - float(operating_cost)
                            )

                    if profit_value is not None:

                        profit = round(
                            float(profit_value), 2
                        )

        except Exception as exc:

            print(
                f"Pricing error for quotation "
                f"{quotation.id}, route {route_id}: {exc}"
            )

        # ---------------------------------------------
        # WEATHER AGENT
        # ---------------------------------------------

        try:

            if route_id:

                weather_result = (
                    weather_agent.assess_weather(
                        route_id=str(route_id).strip()
                    )
                )

                if (
                    isinstance(weather_result, dict)
                    and weather_result.get("status") != "not_found"
                ):

                    weather_value = weather_result.get(
                        "weather_risk"
                    )

                    if weather_value is not None:

                        weather_risk = str(
                            weather_value
                        ).strip().upper()

        except Exception as exc:

            print(
                f"Weather error for quotation "
                f"{quotation.id}, route {route_id}: {exc}"
            )

        # ---------------------------------------------
        # CUSTOMS AGENT
        # ---------------------------------------------

        try:

            if route_id:

                customs_result = (
                    customs_agent.validate_customs(
                        route_id=str(route_id).strip()
                    )
                )

                if (
                    isinstance(customs_result, dict)
                    and customs_result.get("status") != "not_found"
                ):

                    customs_value = customs_result.get(
                        "customs_status"
                    )

                    if customs_value is not None:

                        customs_status = str(
                            customs_value
                        ).strip().upper()

        except Exception as exc:

            print(
                f"Customs error for quotation "
                f"{quotation.id}, route {route_id}: {exc}"
            )

        # ---------------------------------------------
        # SELLING PRICE
        # ---------------------------------------------

        selling_price = (
            float(quotation.selling_price)
            if quotation.selling_price is not None
            else None
        )

        # ---------------------------------------------
        # RECENT QUOTATION RECORD
        # ---------------------------------------------

        recent_quotations.append({

            "id": quotation.id,

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

            "origin": quotation.origin,

            "destination": quotation.destination,

            "cargo_type": quotation.cargo_type,

            "container_type": quotation.container_type,

            "container_count": quotation.container_count,

            "selected_route_id": route_id,

            "route_id": route_id,

            "target_margin_percent": (
                float(quotation.target_margin) * 100
                if quotation.target_margin is not None
                else None
            ),

            "selling_price": selling_price,

            "total_selling_price": selling_price,

            "final_selling_price_usd": selling_price,

            "profit": profit,

            "profit_usd": profit,

            "weather_risk": weather_risk,

            "customs_status": customs_status,

            "status": (
                quotation.status or "unknown"
            ).strip().lower(),

            "created_at": quotation.created_at,
        })

    # =====================================================
    # API RESPONSE
    # =====================================================

    return {

        "success": True,

        # ---------------------------------------------
        # ADMIN INFORMATION
        # ---------------------------------------------

        "admin": {

            "id": current_user.id,

            "name": current_user.name,

            "email": current_user.email,

            "role": current_user.role,
        },

        # ---------------------------------------------
        # OVERALL KPI DATA
        # ---------------------------------------------

        "kpis": {

            "total_users": total_users,

            "total_quotations": total_quotations,

            "pending_quotations": pending_quotations,

            "approved_quotations": approved_quotations,

            "rejected_quotations": rejected_quotations,

            "monthly_quotations": current_month_total,

            "total_selling_price": total_selling_price,

            "total_profit": total_profit,

            "total_loss": total_loss,

            "net_profit": net_profit,
        },

        # ---------------------------------------------
        # CURRENT MONTH SUMMARY
        # ---------------------------------------------

        "current_month_summary": current_month_summary,

        # ---------------------------------------------
        # MONTHLY PROFIT CHART
        # ---------------------------------------------

        "monthly_profit": monthly_profit_data,

        # ---------------------------------------------
        # MONTHLY QUOTATIONS CHART
        # ---------------------------------------------

        "monthly_quotations": monthly_quotation_data,

        # ---------------------------------------------
        # RECENT QUOTATIONS
        # ---------------------------------------------

        "recent_quotations": recent_quotations,
    }