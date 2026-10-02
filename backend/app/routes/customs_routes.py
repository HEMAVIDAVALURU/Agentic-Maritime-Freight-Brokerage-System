from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import QuotationRequestDB, Route
from app.services.auth_dependency import get_current_user
from app.agents.customs_agent import CustomsAgent


router = APIRouter(
    prefix="/api/customs",
    tags=["Customs Management"]
)

customs_agent = CustomsAgent()


@router.get("/admin")
def get_admin_customs(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return customs information for approved quotations.
    Admin access only.
    """

    # Verify admin access
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    # Fetch approved quotations
    approved_quotations = (
        db.query(QuotationRequestDB)
        .filter(QuotationRequestDB.status == "approved")
        .order_by(QuotationRequestDB.id.desc())
        .all()
    )

    customs_records = []

    for quotation in approved_quotations:

        selected_route_id = quotation.selected_route_id

        # Skip quotations without a selected route
        if not selected_route_id:
            continue

        # Fetch route information
        route = (
            db.query(Route)
            .filter(Route.route_id == selected_route_id)
            .first()
        )

        if route is None:
            continue

        # Fetch and validate customs information
        try:
            customs_result = customs_agent.validate_customs(
                str(selected_route_id)
            )
        except Exception as error:
            print(
                f"Customs validation failed for route "
                f"{selected_route_id}: {error}"
            )

            customs_result = {
                "status": "error",
                "message": "Unable to retrieve customs information."
            }

        # Customs data was found
        if customs_result.get("status") == "success":

            customs_records.append({
                "quotation_id": quotation.id,
                "route_id": route.route_id,
                "origin": route.origin,
                "destination": route.destination,

                "cargo_type": customs_result.get("cargo_type"),
                "hs_code_required": customs_result.get(
                    "hs_code_required"
                ),
                "commercial_invoice": customs_result.get(
                    "commercial_invoice"
                ),
                "packing_list": customs_result.get(
                    "packing_list"
                ),
                "certificate_of_origin": customs_result.get(
                    "certificate_of_origin"
                ),
                "restricted_cargo": customs_result.get(
                    "restricted_cargo"
                ),

                "customs_status": customs_result.get(
                    "customs_status"
                ),
                "missing_documents": customs_result.get(
                    "missing_documents", []
                ),
                "recommendation": customs_result.get(
                    "recommendation"
                ),
                "customs_data_status": "Available"
            })

        # Route exists, but its customs information is missing
        else:
            customs_records.append({
                "quotation_id": quotation.id,
                "route_id": route.route_id,
                "origin": route.origin,
                "destination": route.destination,

                "cargo_type": None,
                "hs_code_required": None,
                "commercial_invoice": None,
                "packing_list": None,
                "certificate_of_origin": None,
                "restricted_cargo": None,

                "customs_status": "No Data",
                "missing_documents": [],
                "recommendation": (
                    "Customs information is not available "
                    "for this route."
                ),
                "customs_data_status": "Not Available"
            })

    return {
        "success": True,
        "total_approved_quotations": len(approved_quotations),
        "total_customs_records": len(customs_records),
        "customs": customs_records
    }