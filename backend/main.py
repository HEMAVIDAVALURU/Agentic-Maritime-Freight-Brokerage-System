import csv
import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import db_models

from app.routes.auth_routes import router as auth_router
from app.routes.route_routes import router as route_router
from app.routes.pricing_routes import router as pricing_router
from app.routes.quotation_routes import router as quotation_router
from app.routes.feedback_routes import router as feedback_router
from app.routes.user_dashboard_routes import router as user_dashboard_router
from app.routes.admin_dashboard_routes import router as admin_dashboard_router
from app.routes.admin_users_routes import router as admin_users_router
from app.routes.admin_quotations_routes import router as admin_quotations_router
from app.routes.weather_routes import router as weather_router
from app.routes.customs_routes import router as customs_router




from app.models import (
    RouteRequest,
    QuotationRequest,
    PricingRequest
)

from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent
from app.services.quotation_service import QuotationService
from app.services.route_comparison_service import RouteComparisonService
from app.services.auth_dependency import get_current_user


from app.db_models import (
    Activity,
    Route,
    QuotationRequestDB,
    Pricing
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# LOAD / SYNC ROUTES FROM CSV INTO MYSQL
# ============================================================

def load_routes_into_database():
    """
    Loads routes from route.csv into the MySQL routes table.

    Existing route_id values are updated.
    New route_id values are inserted.

    This keeps the existing Route Agent and other backend
    functionality unchanged while synchronizing the MySQL
    routes table with the latest route.csv data.
    """

    current_file = os.path.abspath(__file__)

    project_root = os.path.dirname(current_file)

    route_file = os.path.join(
        project_root,
        "app",
        "data",
        "route.csv"
    )

    if not os.path.exists(route_file):
        print(
            "Route CSV file not found:",
            route_file
        )
        return

    db = next(get_db())

    try:

        inserted_count = 0
        updated_count = 0

        with open(
            route_file,
            mode="r",
            encoding="utf-8"
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                route_id = (
                    row.get("route_id") or ""
                ).strip()

                if not route_id:
                    continue

                origin = (
                    row.get("origin") or ""
                ).strip()

                destination = (
                    row.get("destination") or ""
                ).strip()

                distance_nm = float(
                    row.get("distance_nm") or 0
                )

                transit_days = int(
                    float(
                        row.get("transit_days") or 0
                    )
                )

                transshipments = int(
                    float(
                        row.get("transshipments") or 0
                    )
                )

                route_type = (
                    row.get("route_type") or ""
                ).strip()

                base_freight_usd = float(
                    row.get("base_freight_usd") or 0
                )

                cargo_type = (
                    row.get("cargo_type") or ""
                ).strip()

                # ------------------------------------------------
                # CHECK WHETHER ROUTE ALREADY EXISTS
                # ------------------------------------------------

                existing_route = (
                    db.query(Route)
                    .filter(
                        Route.route_id == route_id
                    )
                    .first()
                )

                # ------------------------------------------------
                # UPDATE EXISTING ROUTE
                # ------------------------------------------------

                if existing_route:

                    existing_route.origin = origin

                    existing_route.destination = destination

                    existing_route.distance_nm = distance_nm

                    existing_route.transit_days = transit_days

                    existing_route.transshipments = transshipments

                    existing_route.route_type = route_type

                    existing_route.base_freight_usd = (
                        base_freight_usd
                    )

                    existing_route.cargo_type = cargo_type

                    updated_count += 1

                # ------------------------------------------------
                # INSERT NEW ROUTE
                # ------------------------------------------------

                else:

                    route = Route(
                        route_id=route_id,

                        origin=origin,

                        destination=destination,

                        distance_nm=distance_nm,

                        transit_days=transit_days,

                        transshipments=transshipments,

                        route_type=route_type,

                        base_freight_usd=base_freight_usd,

                        cargo_type=cargo_type
                    )

                    db.add(route)

                    inserted_count += 1

        db.commit()

        total_routes = (
            db.query(Route).count()
        )

        print(
            f"Route database sync completed. "
            f"Inserted: {inserted_count}, "
            f"Updated: {updated_count}, "
            f"Total routes in MySQL: {total_routes}"
        )

    except Exception as error:

        db.rollback()

        print(
            "Route database sync failed:",
            error
        )

    finally:

        db.close()


# ============================================================
# INITIAL ROUTE DATABASE SYNC
# ============================================================

load_routes_into_database()


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Agentic AI for Maritime Freight Pricing and Route Optimization",
    description="AI-powered maritime freight quotation and route optimization platform",
    version="1.0.0"
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(user_dashboard_router)

app.include_router(admin_dashboard_router)

app.include_router(admin_users_router)

app.include_router(admin_quotations_router)

app.include_router(auth_router)

app.include_router(route_router)

app.include_router(pricing_router)

app.include_router(quotation_router)

app.include_router(feedback_router)

app.include_router(weather_router)

app.include_router(customs_router)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AGENTS / SERVICES
# ============================================================

route_agent = RouteAgent()

quotation_service = QuotationService()

pricing_agent = PricingAgent()

weather_agent = WeatherAgent()

customs_agent = CustomsAgent()


route_comparison_service = RouteComparisonService(
    pricing_agent=pricing_agent,
    weather_agent=weather_agent,
    customs_agent=customs_agent
)

# ============================================================
# ACTIVITY REQUEST
# ============================================================

class ActivityRequest(BaseModel):
    activity_type: str
    description: str


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Agentic AI API is running",
        "project": "Maritime Freight Pricing and Route Optimization",
        "milestone": "Module 1 - Route Intelligence"
    }


# ============================================================
# ROUTE ANALYSIS
# ============================================================

@app.post("/api/routes/analyze")
def analyze_route(
    request: RouteRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    result = route_agent.analyze_route(
        origin=request.origin,
        destination=request.destination,
        cargo_type=request.cargo_type,
        containers=request.containers
    )

    activity = Activity(
        user_id=current_user.id,
        activity_type="route_analysis",
        description=(
            f"Route analysis performed for "
            f"{request.origin} to {request.destination}."
        )
    )

    db.add(activity)

    db.commit()

    return result


@app.post("/api/routes/analyze-price-weather")
def analyze_price_weather(
    request: RouteRequest,
    current_user=Depends(get_current_user)
):
    # =========================================================
    # STEP 1
    # Route Agent analyzes the shipment
    # =========================================================

    route_result = route_agent.analyze_route(
        origin=request.origin,
        destination=request.destination,
        cargo_type=request.cargo_type,
        containers=request.containers
    )

    # If Route Agent could not find routes,
    # return its original result.
    if route_result.get("status") != "success":
        return route_result

    # =========================================================
    # STEP 2
    # Use ALL candidate routes
    #
    # Important:
    # Do NOT use route_result["top_routes"] here.
    #
    # available_routes contains all matching candidates.
    # =========================================================

    candidate_routes = route_result.get(
        "available_routes",
        []
    )

    # =========================================================
    # STEP 3
    # Compare:
    #
    # Route Agent score
    # +
    # Pricing Agent
    # +
    # Weather Agent
    # =========================================================

    comparison_result = (
        route_comparison_service.compare_routes(
            candidate_routes=candidate_routes,
            containers=request.containers
        )
    )

    # =========================================================
    # STEP 4
    # Add shipment information
    # =========================================================

    comparison_result["origin"] = request.origin

    comparison_result["destination"] = (
        request.destination
    )

    comparison_result["cargo_type"] = (
        request.cargo_type
    )

    comparison_result["containers"] = (
        request.containers
    )

    return comparison_result


# ============================================================
# QUOTATION GENERATION
# ============================================================

@app.post("/api/quotations/generate")
def generate_quotation(
    request: QuotationRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    result = quotation_service.generate_quotation(
        origin=request.origin,
        destination=request.destination,
        cargo_type=request.cargo_type,
        containers=request.containers,
        route_id=request.route_id
    )

    if result.get("status") == "success":

        activity = Activity(
            user_id=current_user.id,
            activity_type="quotation_generated",
            description=(
                f"Quotation generated for "
                f"{request.origin} to {request.destination} "
                f"using route {request.route_id}."
            )
        )

        db.add(activity)

        db.commit()

    return result


# ============================================================
# PRICING CALCULATION
# ============================================================

@app.post("/api/pricing/calculate")
def calculate_pricing(
    request: PricingRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    result = pricing_agent.calculate_pricing(
        route_id=request.route_id,
        containers=request.containers
    )

    if result.get("status") == "success":

        activity = Activity(
            user_id=current_user.id,
            activity_type="pricing_analysis",
            description=(
                f"Pricing analysis performed for "
                f"route {request.route_id} "
                f"with {request.containers} containers."
            )
        )

        db.add(activity)

        db.commit()

    return result


# ============================================================
# ADMIN PRICING
# ONLY APPROVED QUOTATIONS
# ============================================================

@app.get("/api/pricing/admin")
def get_admin_pricing(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    """Return pricing records belonging to approved quotations only."""

    if current_user.role != "admin":

        return {
            "success": False,
            "message": "Admin access required."
        }

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

    pricing_records = []

    for quotation in approved_quotations:

        route = (
            db.query(Route)
            .filter(
                Route.route_id == quotation.selected_route_id
            )
            .first()
        )

        if not route:
            continue

        stored_pricing = (
            db.query(Pricing)
            .filter(
                Pricing.route_id == quotation.selected_route_id
            )
            .order_by(
                Pricing.id.desc()
            )
            .first()
        )

        # Recalculate using the same Pricing Agent used by the
        # quotation flow. This also fixes older records whose
        # Pricing row was saved with zero values.

        calculated_pricing = {}

        try:

            calculated_pricing = pricing_agent.calculate_pricing(
                route_id=route.route_id,
                containers=quotation.container_count
            ) or {}

        except Exception as pricing_error:

            print(
                f"Admin pricing calculation failed for quotation #{quotation.id}:",
                pricing_error
            )

        stored_has_values = (
            stored_pricing is not None
            and (
                float(stored_pricing.fuel_surcharge or 0) != 0
                or float(stored_pricing.port_charge or 0) != 0
                or float(stored_pricing.risk_surcharge or 0) != 0
                or float(stored_pricing.operating_cost or 0) != 0
                or float(stored_pricing.demand_adjusted_cost or 0) != 0
            )
        )

        if stored_has_values:

            fuel_surcharge = float(
                stored_pricing.fuel_surcharge or 0
            )

            port_charge = float(
                stored_pricing.port_charge or 0
            )

            risk_surcharge = float(
                stored_pricing.risk_surcharge or 0
            )

            operating_cost = float(
                stored_pricing.operating_cost or 0
            )

            demand_factor = float(
                stored_pricing.demand_factor or 1.0
            )

            demand_adjusted_cost = float(
                stored_pricing.demand_adjusted_cost or 0
            )

        else:

            fuel_surcharge = float(
                calculated_pricing.get(
                    "fuel_surcharge_usd",
                    0
                )
            )

            port_charge = float(
                calculated_pricing.get(
                    "port_charge_usd",
                    0
                )
            )

            risk_surcharge = float(
                calculated_pricing.get(
                    "risk_surcharge_usd",
                    0
                )
            )

            operating_cost = float(
                calculated_pricing.get(
                    "total_operational_cost_usd",
                    calculated_pricing.get(
                        "operating_cost_per_container_usd",
                        calculated_pricing.get(
                            "operating_cost_usd",
                            0
                        )
                    )
                )
            )

            demand_factor = float(
                calculated_pricing.get(
                    "demand_factor",
                    1.0
                )
            )

            demand_adjusted_cost = float(
                calculated_pricing.get(
                    "demand_adjusted_total_cost_usd",
                    calculated_pricing.get(
                        "demand_adjusted_cost_usd",
                        calculated_pricing.get(
                            "demand_adjusted_cost",
                            0
                        )
                    )
                )
            )
        # -------------------------------------------------
        # PERSIST PRICING RECORD FOR APPROVED QUOTATION
        # -------------------------------------------------

        if (
            not stored_has_values
            and calculated_pricing.get("status") == "success"
        ):

            try:

                if stored_pricing is None:

                    stored_pricing = Pricing(
                        route_id=quotation.selected_route_id
                    )

                    db.add(stored_pricing)

                stored_pricing.fuel_surcharge = fuel_surcharge

                stored_pricing.port_charge = port_charge

                stored_pricing.risk_surcharge = risk_surcharge

                stored_pricing.operating_cost = operating_cost

                stored_pricing.demand_factor = demand_factor

                stored_pricing.demand_adjusted_cost = (
                    demand_adjusted_cost
                )

            except Exception as pricing_error:

                print(
                    f"Unable to persist pricing for quotation #{quotation.id}:",
                    pricing_error
                )

        pricing_records.append({

            "id": (
                stored_pricing.id
                if stored_pricing
                else quotation.id
            ),

            "quotation_id":
                quotation.id,

            "route_id":
                route.route_id,

            "origin":
                route.origin,

            "destination":
                route.destination,

            "cargo_type":
                quotation.cargo_type,

            "container_count":
                quotation.container_count,

            "base_freight_usd":
                float(
                    route.base_freight_usd or 0
                ),

            "fuel_surcharge":
                fuel_surcharge,

            "port_charge":
                port_charge,

            "risk_surcharge":
                risk_surcharge,

            "operating_cost":
                operating_cost,

            "demand_factor":
                demand_factor,

            "demand_adjusted_cost":
                demand_adjusted_cost,

            "target_margin_percent":
                float(
                    quotation.target_margin or 0
                ) * 100,

            "final_selling_price_usd":
                float(
                    quotation.selling_price or 0
                ),

            "status":
                quotation.status,

            "created_at":
                quotation.created_at

        })

    try:

        db.commit()

    except Exception as error:

        db.rollback()

        print(
            "Admin pricing persistence commit failed:",
            error
        )

    return {

        "success": True,

        "count":
            len(pricing_records),

        "pricing":
            pricing_records
    }


# ============================================================
# LOG ACTIVITY
# ============================================================

@app.post("/api/activities/log")
def log_activity(
    request: ActivityRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    activity = Activity(
        user_id=current_user.id,
        activity_type=request.activity_type,
        description=request.description
    )

    db.add(activity)

    db.commit()

    db.refresh(activity)

    return {

        "status": "success",

        "message":
            "Activity logged successfully.",

        "activity_id":
            activity.id
    }



@app.post("/api/customs/validate")
def validate_customs(route_id: str):

    return customs_agent.validate_customs(route_id)