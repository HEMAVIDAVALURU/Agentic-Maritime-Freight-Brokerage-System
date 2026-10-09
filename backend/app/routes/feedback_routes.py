from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    Feedback,
    Activity,
    User,
    QuotationRequestDB,
    Admin,
)
from app.services.auth_dependency import get_current_user
from app.services.email_service import EmailService


router = APIRouter(
    prefix="/api/feedback",
    tags=["Feedback"]
)


# =========================================================
# REQUEST MODELS
# =========================================================

class FeedbackRequest(BaseModel):
    user_id: int
    rating: int = Field(ge=1, le=5)
    feedback_text: str = Field(
        default="",
        max_length=5000
    )
    quotation_id: int | None = None


class FeedbackReplyRequest(BaseModel):
    response: str = Field(
        min_length=1,
        max_length=5000
    )


# =========================================================
# HELPER: CHECK ADMIN ACCESS
# =========================================================

def require_admin(current_user):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )


# =========================================================
# HELPER: FORMAT FEEDBACK
# =========================================================

def format_feedback(
    feedback,
    customer=None,
    quotation=None
):
    return {
        "id": feedback.id,
        "user_id": feedback.user_id,

        "customer": {
            "id": (
                customer.id
                if customer
                else feedback.user_id
            ),

            "name": (
                customer.name
                if customer and customer.name
                else "Unknown Customer"
            ),

            "email": (
                customer.email
                if customer and customer.email
                else ""
            ),

            "company_name": (
                customer.company_name
                if customer and customer.company_name
                else ""
            ),
        },

        "quotation_id": feedback.quotation_id,

        "quotation": (
            {
                "origin": quotation.origin,
                "destination": quotation.destination,
                "selected_route_id": quotation.selected_route_id,
                "status": quotation.status,
            }
            if quotation
            else None
        ),

        "rating": feedback.rating,

        "comments": (
            feedback.comments or ""
        ),

        "admin_response": (
            feedback.admin_response or ""
        ),

        "admin_response_at":
            feedback.admin_response_at,

        "created_at":
            feedback.created_at,
    }


# =========================================================
# 1. SUBMIT FEEDBACK
# POST /api/feedback/submit
# =========================================================

@router.post("/submit")
def submit_feedback(
    request: FeedbackRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # Ensure normal users can submit feedback only for
    # their own account.
    # ---------------------------------------------------------

    if (
        getattr(current_user, "role", None) != "admin"
        and current_user.id != request.user_id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You can submit feedback only "
                "for your own account."
            )
        )

    # ---------------------------------------------------------
    # Find customer
    # ---------------------------------------------------------

    customer = (
        db.query(User)
        .filter(User.id == request.user_id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    # ---------------------------------------------------------
    # Validate quotation if provided
    # ---------------------------------------------------------

    quotation = None

    if request.quotation_id is not None:

        quotation = (
            db.query(QuotationRequestDB)
            .filter(
                QuotationRequestDB.id ==
                request.quotation_id,

                QuotationRequestDB.user_id ==
                request.user_id,
            )
            .first()
        )

        if not quotation:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Quotation not found "
                    "for this user."
                )
            )

    # ---------------------------------------------------------
    # Create feedback
    # ---------------------------------------------------------

    feedback = Feedback(
        user_id=request.user_id,
        quotation_id=request.quotation_id,
        rating=request.rating,
        comments=request.feedback_text.strip(),
    )

    db.add(feedback)

    # Get feedback ID before commit
    db.flush()

    # ---------------------------------------------------------
    # Create activity record
    # ---------------------------------------------------------

    activity = Activity(
        user_id=request.user_id,
        activity_type="feedback_submitted",
        description=(
            f"Feedback submitted with "
            f"{request.rating}/5 rating."
        ),
    )

    db.add(activity)

    # ---------------------------------------------------------
    # Save feedback + activity
    # ---------------------------------------------------------

    db.commit()
    db.refresh(feedback)

    # =========================================================
    # SEND ADMIN FEEDBACK EMAIL
    # =========================================================
    #
    # Email is sent ONLY when:
    #
    # email_notifications = True
    #
    # AND
    #
    # feedback_alerts = True
    #
    # Feedback itself is already saved above.
    # Therefore email failure will NOT delete/fail the feedback.
    # =========================================================

    email_result = {
        "success": False,
        "message": "Feedback notification was not sent."
    }

    try:

        admin = (
            db.query(Admin)
            .filter(
                Admin.is_active == True,
                Admin.email_notifications == True,
                Admin.feedback_alerts == True,
            )
            .first()
        )

        if admin and admin.email:

            email_result = (
                EmailService
                .send_feedback_received_email(
                    admin_email=admin.email,

                    customer_name=(
                        customer.name
                        or "Customer"
                    ),

                    customer_email=(
                        customer.email
                        or ""
                    ),

                    rating=request.rating,

                    feedback_text=(
                        request.feedback_text.strip()
                        or "No written feedback provided."
                    ),

                    quotation_id=(
                        request.quotation_id
                    ),
                )
            )

            # Email failure should not affect
            # successful feedback submission.

            if not email_result.get("success"):
                print(
                    "Feedback notification email failed:",
                    email_result.get("message")
                )

        else:
            print(
                "Feedback email notification skipped "
                "because admin notification settings are OFF."
            )

    except Exception as error:

        print(
            "Feedback notification error:",
            error
        )

    # =========================================================
    # SEND USER FEEDBACK SUBMISSION CONFIRMATION EMAIL
    # =========================================================
    #
    # This is a GENERAL email.
    #
    # Controlled ONLY by:
    #
    # email_notifications = True
    #
    # Feedback Alerts are NOT required for this email.
    #
    # Email failure must never fail an already-saved feedback.
    # =========================================================

    try:
        if (
            customer.email
            and customer.email_notifications
        ):
            user_email_result = (
                EmailService
                .send_feedback_submission_confirmation_email(
                    customer_email=customer.email,
                    customer_name=(
                        customer.name
                        or "Customer"
                    ),
                    rating=request.rating,
                    feedback_text=(
                        request.feedback_text.strip()
                        or "No written feedback provided."
                    ),
                    quotation_id=request.quotation_id,
                )
            )

            if not user_email_result.get("success"):
                print(
                    "User feedback confirmation email failed:",
                    user_email_result.get("message")
                )

        else:
            print(
                "User feedback confirmation email skipped "
                "because customer email notifications are OFF "
                "or customer email is unavailable."
            )

    except Exception as error:
        print(
            "User feedback confirmation email error:",
            error
        )

    # ---------------------------------------------------------
    # Return successful feedback response
    # ---------------------------------------------------------

    return {
        "status": "success",
        "message": (
            "Thank you for your valuable feedback!"
        ),
        "feedback_id": feedback.id,
    }


# =========================================================
# 2. GET ALL FEEDBACK FOR ADMIN
# GET /api/feedback/admin
# =========================================================

@router.get("/admin")
def get_admin_feedback(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    records = (
        db.query(Feedback)
        .order_by(
            Feedback.created_at.desc()
        )
        .all()
    )

    feedback_list = []

    for feedback in records:

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

        feedback_list.append(
            format_feedback(
                feedback=feedback,
                customer=customer,
                quotation=quotation,
            )
        )

    return {
        "success": True,
        "total_feedback": len(
            feedback_list
        ),
        "feedback": feedback_list,
    }


# =========================================================
# 3. ADMIN REPLIES TO FEEDBACK
# POST /api/feedback/{feedback_id}/reply
# =========================================================

@router.post("/{feedback_id}/reply")
def reply_to_feedback(
    feedback_id: int,
    request: FeedbackReplyRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    response_text = request.response.strip()

    if not response_text:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please enter a response "
                "before sending."
            )
        )

    feedback = (
        db.query(Feedback)
        .filter(
            Feedback.id == feedback_id
        )
        .first()
    )

    if not feedback:
        raise HTTPException(
            status_code=404,
            detail="Feedback not found."
        )

    feedback.admin_response = response_text

    feedback.admin_response_at = (
        datetime.now(timezone.utc)
    )

    db.commit()
    db.refresh(feedback)

    # ---------------------------------------------------------
    # Find the customer who submitted this feedback
    # ---------------------------------------------------------

    customer = (
        db.query(User)
        .filter(User.id == feedback.user_id)
        .first()
    )

    # =========================================================
    # SEND USER ADMIN-REPLY EMAIL
    # =========================================================
    #
    # This is a FEEDBACK ALERT.
    #
    # Controlled by:
    #
    # email_notifications = True
    #
    # AND
    #
    # feedback_notifications = True
    #
    # Email failure must never undo the saved admin response.
    # =========================================================

    if customer and customer.email:
        try:
            if (
                customer.email_notifications
                and customer.feedback_notifications
            ):
                user_reply_result = (
                    EmailService
                    .send_feedback_reply_email(
                        customer_email=customer.email,
                        customer_name=(
                            customer.name
                            or "Customer"
                        ),
                        rating=feedback.rating,
                        feedback_text=(
                            feedback.comments
                            or "No written feedback provided."
                        ),
                        admin_response=response_text,
                        quotation_id=feedback.quotation_id,
                    )
                )

                if not user_reply_result.get("success"):
                    print(
                        "User feedback reply email failed:",
                        user_reply_result.get("message")
                    )
            else:
                print(
                    "User feedback reply email skipped because "
                    "customer notification settings are OFF."
                )

        except Exception as error:
            print(
                "User feedback reply email error:",
                error
            )

    # =========================================================
    # SEND ADMIN REPLY-SENT CONFIRMATION EMAIL
    # =========================================================
    #
    # This is a GENERAL email.
    #
    # Controlled ONLY by:
    #
    # email_notifications = True
    #
    # Feedback Alerts are NOT required for this email.
    # =========================================================

    try:
        if (
            current_user.email
            and current_user.email_notifications
        ):
            admin_reply_result = (
                EmailService
                .send_feedback_reply_confirmation_email(
                    admin_email=current_user.email,
                    admin_name=(
                        current_user.name
                        or "Admin"
                    ),
                    customer_name=(
                        customer.name
                        if customer
                        else "Customer"
                    ),
                    customer_email=(
                        customer.email
                        if customer
                        else ""
                    ),
                    rating=feedback.rating,
                    admin_response=response_text,
                    quotation_id=feedback.quotation_id,
                )
            )

            if not admin_reply_result.get("success"):
                print(
                    "Admin feedback reply confirmation email failed:",
                    admin_reply_result.get("message")
                )

        else:
            print(
                "Admin feedback reply confirmation email skipped "
                "because admin email notifications are OFF "
                "or admin email is unavailable."
            )

    except Exception as error:
        print(
            "Admin feedback reply confirmation email error:",
            error
        )

    # ---------------------------------------------------------
    # Create activity record
    # ---------------------------------------------------------

    try:
        activity = Activity(
            user_id=feedback.user_id,
            activity_type="feedback_response",
            description=(
                f"Admin responded to your feedback #{feedback.id}."
            ),
        )

        db.add(activity)
        db.commit()

    except Exception as activity_error:
        db.rollback()

        print(
            "Feedback-response activity failed:",
            activity_error
        )

    # ---------------------------------------------------------
    # Return successful response
    # ---------------------------------------------------------

    return {
        "success": True,
        "message": (
            "Response sent successfully."
        ),

        "feedback": {
            "id": feedback.id,

            "admin_response":
                feedback.admin_response,

            "admin_response_at":
                feedback.admin_response_at,
        },
    }


# =========================================================
# 4. GET FEEDBACK FOR LOGGED-IN USER
# GET /api/feedback/my-feedback
# =========================================================

@router.get("/my-feedback")
def get_my_feedback(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = (
        db.query(Feedback)
        .filter(
            Feedback.user_id ==
            current_user.id
        )
        .order_by(
            Feedback.created_at.desc()
        )
        .all()
    )

    feedback_list = []

    for feedback in records:

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

        feedback_list.append(
            format_feedback(
                feedback=feedback,
                customer=current_user,
                quotation=quotation,
            )
        )

    return {
        "success": True,

        "total_feedback":
            len(feedback_list),

        "feedback":
            feedback_list,
    }