from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import QuotationRequestDB, Route
from app.services.auth_dependency import get_current_user
from app.agents.weather_agent import WeatherAgent


router = APIRouter(
    prefix="/api/weather",
    tags=["Weather Intelligence"]
)


# =========================================================
# REQUEST MODEL
# =========================================================

class WeatherRequest(BaseModel):
    route_id: str


# =========================================================
# WEATHER AGENT
# =========================================================

weather_agent = WeatherAgent()


# =========================================================
# POST /api/weather/assess
# ASSESS WEATHER FOR A ROUTE
# =========================================================

@router.post("/assess")
def assess_weather(request: WeatherRequest):

    result = weather_agent.assess_weather(
        route_id=request.route_id
    )

    if result.get("status") == "not_found":
        raise HTTPException(
            status_code=404,
            detail=result.get(
                "message",
                "Weather data not found."
            )
        )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get(
                "message",
                "Unable to assess weather."
            )
        )

    return result


# =========================================================
# GET /api/weather/admin
# WEATHER RECORDS FOR APPROVED QUOTATIONS ONLY
# =========================================================

@router.get("/admin")
def get_admin_weather(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # -----------------------------------------------------
    # VERIFY ADMIN ACCESS
    # -----------------------------------------------------

    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    # -----------------------------------------------------
    # FETCH APPROVED QUOTATIONS
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

    weather_records = []

    # -----------------------------------------------------
    # GET ROUTE AND WEATHER INFORMATION
    # -----------------------------------------------------

    for quotation in approved_quotations:

        selected_route_id = quotation.selected_route_id

        if not selected_route_id:
            continue

        route = (
            db.query(Route)
            .filter(
                Route.route_id == selected_route_id
            )
            .first()
        )

        if route is None:
            continue

        try:
            weather_result = weather_agent.assess_weather(
                route_id=selected_route_id
            )

        except Exception as error:
            print(
                f"Weather assessment failed for quotation "
                f"#{quotation.id}: {error}"
            )
            continue

        # Only include records with matching weather.csv data.
        if weather_result.get("status") != "success":
            continue

        weather_records.append({
            "quotation_id": quotation.id,
            "route_id": route.route_id,
            "origin": route.origin,
            "destination": route.destination,

            "wind_speed_knots": weather_result.get(
                "wind_speed_knots"
            ),

            "wave_height_m": weather_result.get(
                "wave_height_m"
            ),

            "visibility_km": weather_result.get(
                "visibility_km"
            ),

            "storm_probability_percent": weather_result.get(
                "storm_probability_percent"
            ),

            "weather_condition": weather_result.get(
                "weather_condition"
            ),

            "weather_risk": weather_result.get(
                "weather_risk"
            ),
        })

    # -----------------------------------------------------
    # RETURN RESPONSE FOR ADMIN WEATHER PAGE
    # -----------------------------------------------------

    return {
        "success": True,
        "total_weather_records": len(weather_records),
        "weather": weather_records
    }