from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User, QuotationRequestDB
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/admin-dashboard",
    tags=["Admin Dashboard"]
)


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
        .filter(
            User.role == "customer"
        )
        .count()
    )

    # =====================================================
    # ADMIN-RELEVANT QUOTATIONS
    # =====================================================
    #
    # IMPORTANT:
    #
    # saved     → customer side only
    # pending   → admin workflow
    # approved  → admin workflow
    # rejected  → admin workflow
    #
    # Therefore Admin Dashboard must NEVER count
    # status = "saved".
    #
    # =====================================================

    admin_statuses = [
        "pending",
        "approved",
        "rejected"
    ]

    # =====================================================
    # TOTAL QUOTATIONS
    # =====================================================

    total_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(
                admin_statuses
            )
        )
        .count()
    )

    # =====================================================
    # PENDING QUOTATIONS
    # =====================================================

    pending_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "pending"
        )
        .count()
    )

    # =====================================================
    # APPROVED QUOTATIONS
    # =====================================================

    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "approved"
        )
        .count()
    )

    # =====================================================
    # REJECTED QUOTATIONS
    # =====================================================

    rejected_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status == "rejected"
        )
        .count()
    )

    # =====================================================
    # CURRENT MONTH QUOTATIONS
    # =====================================================
    #
    # Only quotations that reached the Admin workflow
    # are counted.
    #
    # Saved quotations are excluded.
    #
    # =====================================================

    now = datetime.now()

    month_start = datetime(
        now.year,
        now.month,
        1
    )

    monthly_quotations = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(
                admin_statuses
            ),
            QuotationRequestDB.created_at >= month_start
        )
        .count()
    )

    # =====================================================
    # RECENT QUOTATIONS
    # =====================================================
    #
    # IMPORTANT:
    #
    # Saved-only quotations must NOT appear here.
    #
    # Only:
    #   Pending
    #   Approved
    #   Rejected
    #
    # =====================================================

    recent_records = (
        db.query(QuotationRequestDB)
        .filter(
            QuotationRequestDB.status.in_(
                admin_statuses
            )
        )
        .order_by(
            QuotationRequestDB.created_at.desc()
        )
        .limit(10)
        .all()
    )

    recent_quotations = []

    # =====================================================
    # BUILD RECENT QUOTATIONS
    # =====================================================

    for quotation in recent_records:

        # -------------------------------------------------
        # CUSTOMER
        # -------------------------------------------------

        customer = (
            db.query(User)
            .filter(
                User.id == quotation.user_id
            )
            .first()
        )

        # -------------------------------------------------
        # RECENT QUOTATION DATA
        # -------------------------------------------------

        recent_quotations.append({

            "id":
                quotation.id,

            "quotation_id":
                quotation.id,

            # ---------------------------------------------
            # CUSTOMER
            # ---------------------------------------------

            "customer_name":
                customer.name
                if customer
                else "Unknown Customer",

            "customer_email":
                customer.email
                if customer
                else "",

            "company_name":
                customer.company_name
                if customer
                else "",

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
            # ROUTE
            # ---------------------------------------------

            "selected_route_id":
                quotation.selected_route_id,

            # ---------------------------------------------
            # MARGIN / SELLING PRICE
            # ---------------------------------------------
            #
            # These are useful for the Admin Recent
            # Quotations section.
            #
            # Profit is intentionally NOT included here.
            #
            # ---------------------------------------------

            "target_margin_percent": (
                quotation.target_margin * 100
                if quotation.target_margin is not None
                else None
            ),

            "selling_price":
                quotation.selling_price
                if quotation.selling_price is not None
                else 0,

            "final_selling_price_usd":
                quotation.selling_price
                if quotation.selling_price is not None
                else 0,

            # ---------------------------------------------
            # STATUS
            # ---------------------------------------------

            "status":
                (
                    quotation.status or ""
                ).lower(),

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

        "success": True,

        # =================================================
        # ADMIN INFORMATION
        # =================================================

        "admin": {

            "id":
                current_user.id,

            "name":
                current_user.name,

            "email":
                current_user.email,

            "role":
                current_user.role,
        },

        # =================================================
        # KPI DATA
        # =================================================

        "kpis": {

            "total_users":
                total_users,

            "total_quotations":
                total_quotations,

            "pending_quotations":
                pending_quotations,

            "approved_quotations":
                approved_quotations,

            "rejected_quotations":
                rejected_quotations,

            "monthly_quotations":
                monthly_quotations,
        },

        # =================================================
        # RECENT QUOTATIONS
        # =================================================

        "recent_quotations":
            recent_quotations,
    }