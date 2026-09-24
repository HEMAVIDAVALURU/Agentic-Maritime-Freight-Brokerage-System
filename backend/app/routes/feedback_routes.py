
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    Feedback,
    Activity,
    User,
    QuotationRequestDB
)
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/feedback",
    tags=["Feedback"]
)


# =========================================================
# CUSTOMER FEEDBACK REQUEST
# =========================================================

class FeedbackRequest(BaseModel):
    user_id: int
    rating: int
    feedback_text: str = ""
    quotation_id: int | None = None


# =========================================================
# SUBMIT FEEDBACK
# =========================================================

@router.post("/submit")
def submit_feedback(
    request: FeedbackRequest,
    db: Session = Depends(get_db)
):
    # -----------------------------------------------------
    # VALIDATE RATING
    # -----------------------------------------------------

    if request.rating < 1 or request.rating > 5:
        return {
            "status": "error",
            "message": "Rating must be between 1 and 5."
        }

    # -----------------------------------------------------
    # VALIDATE USER
    # -----------------------------------------------------

    user = (
        db.query(User)
        .filter(User.id == request.user_id)
        .first()
    )

    if not user:
        return {
            "status": "error",
            "message": "User not found."
        }

    # -----------------------------------------------------
    # VALIDATE QUOTATION IF PROVIDED
    # -----------------------------------------------------

    if request.quotation_id is not None:

        quotation = (
            db.query(QuotationRequestDB)
            .filter(
                QuotationRequestDB.id ==
                request.quotation_id,
                QuotationRequestDB.user_id ==
                request.user_id
            )
            .first()
        )

        if not quotation:
            return {
                "status": "error",
                "message": "Quotation not found."
            }

    # -----------------------------------------------------
    # CREATE FEEDBACK RECORD
    # -----------------------------------------------------

    feedback = Feedback(
        user_id=request.user_id,
        quotation_id=request.quotation_id,
        rating=request.rating,
        comments=request.feedback_text.strip()
    )

    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    # -----------------------------------------------------
    # ACTIVITY: FEEDBACK SUBMITTED
    # -----------------------------------------------------

    activity = Activity(
        user_id=request.user_id,
        activity_type="feedback_submitted",
        description=(
            f"Feedback submitted with "
            f"{request.rating}/5 rating."
        )
    )

    db.add(activity)
    db.commit()

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "status": "success",
        "message": "Thank you for your valuable feedback!",
        "feedback_id": feedback.id
    }


# =========================================================
# ADMIN - GET ALL CUSTOMER FEEDBACK
# =========================================================

@router.get("/admin")
def get_admin_feedback(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # -----------------------------------------------------
    # ADMIN ACCESS CHECK
    # -----------------------------------------------------

    if current_user.role != "admin":
        return {
            "success": False,
            "message": "Admin access required."
        }

    # -----------------------------------------------------
    # FETCH FEEDBACK
    # -----------------------------------------------------

    feedback_records = (
        db.query(Feedback)
        .order_by(
            Feedback.created_at.desc()
        )
        .all()
    )

    feedback_list = []

    # -----------------------------------------------------
    # BUILD ADMIN FEEDBACK RESPONSE
    # -----------------------------------------------------

    for feedback in feedback_records:

        customer = (
            db.query(User)
            .filter(
                User.id == feedback.user_id
            )
            .first()
        )

        quotation = None

        if feedback.quotation_id is not None:
            quotation = (
                db.query(QuotationRequestDB)
                .filter(
                    QuotationRequestDB.id ==
                    feedback.quotation_id
                )
                .first()
            )

        feedback_list.append({
            "id": feedback.id,

            "customer": {
                "id": (
                    customer.id
                    if customer
                    else feedback.user_id
                ),
                "name": (
                    customer.name
                    if customer
                    else "Unknown Customer"
                ),
                "email": (
                    customer.email
                    if customer
                    else ""
                ),
                "company_name": (
                    customer.company_name
                    if customer
                    else ""
                )
            },

            "quotation_id": feedback.quotation_id,

            "quotation": (
                {
                    "origin": quotation.origin,
                    "destination": quotation.destination,
                    "selected_route_id": (
                        quotation.selected_route_id
                    ),
                    "status": quotation.status
                }
                if quotation
                else None
            ),

            "rating": feedback.rating,

            "comments": (
                feedback.comments
                if feedback.comments
                else ""
            ),

            "created_at": feedback.created_at
        })

    # -----------------------------------------------------
    # RETURN ADMIN FEEDBACK
    # -----------------------------------------------------

    return {
        "success": True,
        "total_feedback": len(feedback_list),
        "feedback": feedback_list
    }

