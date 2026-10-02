import csv
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import (
    Route,
    QuotationRequestDB,
    QuotationRoute,
)
from app.services.auth_dependency import get_current_user


router = APIRouter(
    prefix="/api/routes",
    tags=["Route Intelligence"]
)


# =========================================================
# DYNAMIC ROUTE OPTIONS FROM CSV
# =========================================================
#
# Reads the current route.csv directly.
#
# Returns:
#   - origins
#   - destinations_by_origin
#   - cargo_types
#
# Therefore:
#
# route.csv
#    ↓
# /api/routes/options
#    ↓
# React Route.jsx
#    ↓
# Origin / Destination / Cargo Type dropdowns
#
# =========================================================

@router.get("/options")
def get_route_options():

    current_file = os.path.abspath(__file__)

    project_root = os.path.dirname(
        os.path.dirname(
            os.path.dirname(current_file)
        )
    )

    route_file = os.path.join(
        project_root,
        "app",
        "data",
        "route.csv"
    )

    origins = set()

    destinations_by_origin = {}

    # NEW:
    # Cargo types are now read directly from route.csv.
    cargo_types = set()

    if not os.path.exists(route_file):

        return {
            "status": "error",
            "message": "Route data file not found.",
            "origins": [],
            "destinations_by_origin": {},
            "cargo_types": [],
        }

    try:

        with open(
            route_file,
            mode="r",
            encoding="utf-8"
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                origin = (
                    row.get("origin") or ""
                ).strip()

                destination = (
                    row.get("destination") or ""
                ).strip()

                # NEW:
                # Read cargo_type from CSV.
                cargo_type = (
                    row.get("cargo_type") or ""
                ).strip()

                if not origin:
                    continue

                origins.add(origin)

                if origin not in destinations_by_origin:

                    destinations_by_origin[origin] = set()

                if destination:

                    destinations_by_origin[
                        origin
                    ].add(destination)

                # NEW:
                # Add every unique cargo type from CSV.
                if cargo_type:

                    cargo_types.add(
                        cargo_type
                    )

    except Exception as error:

        return {
            "status": "error",
            "message":
                f"Unable to read route data: {error}",
            "origins": [],
            "destinations_by_origin": {},
            "cargo_types": [],
        }

    sorted_origins = sorted(
        origins,
        key=lambda value: value.lower()
    )

    sorted_destinations_by_origin = {

        origin: sorted(
            destinations,
            key=lambda value: value.lower()
        )

        for origin, destinations
        in destinations_by_origin.items()
    }

    # NEW:
    # Sort cargo types alphabetically.
    sorted_cargo_types = sorted(
        cargo_types,
        key=lambda value: value.lower()
    )

    return {

        "status": "success",

        "origins":
            sorted_origins,

        "destinations_by_origin":
            sorted_destinations_by_origin,

        # NEW
        "cargo_types":
            sorted_cargo_types,
    }


# =========================================================
# ADMIN - SYNC ROUTES FROM CSV TO MYSQL
# =========================================================

def sync_routes_to_database(
    db: Session
):

    """
    Make sure the MySQL routes table contains
    the routes available in route.csv.

    Existing route_id values are skipped so that
    duplicate routes are never created.
    """

    current_file = os.path.abspath(__file__)

    project_root = os.path.dirname(
        os.path.dirname(
            os.path.dirname(current_file)
        )
    )

    route_file = os.path.join(
        project_root,
        "app",
        "data",
        "route.csv"
    )

    if not os.path.exists(route_file):

        return 0

    # -----------------------------------------------------
    # EXISTING ROUTES
    # -----------------------------------------------------

    existing_route_ids = {

        route_id

        for (route_id,) in (

            db.query(
                Route.route_id
            ).all()
        )
    }

    inserted_count = 0

    # -----------------------------------------------------
    # READ CSV
    # -----------------------------------------------------

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

            if route_id in existing_route_ids:
                continue

            # -------------------------------------------------
            # CREATE MASTER ROUTE
            # -------------------------------------------------

            route = Route(

                route_id=route_id,

                origin=(
                    row.get("origin") or ""
                ).strip(),

                destination=(
                    row.get("destination") or ""
                ).strip(),

                distance_nm=float(
                    row.get("distance_nm") or 0
                ),

                transit_days=int(
                    float(
                        row.get("transit_days") or 0
                    )
                ),

                transshipments=int(
                    float(
                        row.get("transshipments") or 0
                    )
                ),

                route_type=(
                    row.get("route_type") or ""
                ).strip(),

                base_freight_usd=float(
                    row.get("base_freight_usd") or 0
                ),

                # NEW:
                # Save cargo_type into MySQL too.
                cargo_type=(
                    row.get("cargo_type") or ""
                ).strip(),
            )

            db.add(route)

            existing_route_ids.add(
                route_id
            )

            inserted_count += 1

    # -----------------------------------------------------
    # COMMIT NEW MASTER ROUTES
    # -----------------------------------------------------

    if inserted_count > 0:

        db.commit()

    return inserted_count


# =========================================================
# ADMIN - GET ROUTES FROM APPROVED QUOTATIONS ONLY
# =========================================================

@router.get("/admin")
def get_approved_quotation_routes_for_admin(

    current_user=Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )

):

    # =====================================================
    # ADMIN ACCESS CHECK
    # =====================================================

    if current_user.role != "admin":

        return {

            "success": False,

            "message":
                "Admin access required."
        }

    # =====================================================
    # GET APPROVED QUOTATIONS ONLY
    # =====================================================

    approved_quotations = (

        db.query(
            QuotationRequestDB
        )

        .filter(

            QuotationRequestDB.status
            ==
            "approved"

        )

        .order_by(

            QuotationRequestDB.id.desc()

        )

        .all()

    )

    route_list = []

    # =====================================================
    # BUILD APPROVED ROUTE DATA
    # =====================================================

    for quotation in approved_quotations:

        route = (

            db.query(
                Route
            )

            .filter(

                Route.route_id
                ==
                quotation.selected_route_id

            )

            .first()

        )

        if not route:
            continue

        quotation_route = (

            db.query(
                QuotationRoute
            )

            .filter(

                QuotationRoute.quotation_id
                ==
                quotation.id,

                QuotationRoute.route_id
                ==
                quotation.selected_route_id

            )

            .first()

        )

        route_score = (

            quotation_route.route_score

            if quotation_route

            else None

        )

        route_list.append({

            "quotation_id":
                quotation.id,

            "id":
                route.id,

            "route_id":
                route.route_id,

            "origin":
                route.origin,

            "destination":
                route.destination,

            "distance_nm":
                route.distance_nm,

            "transit_days":
                route.transit_days,

            "transshipments":
                route.transshipments,

            "route_type":
                route.route_type,

            "base_freight_usd":
                route.base_freight_usd,

            # NEW:
            "cargo_type":
                route.cargo_type,

            "route_score":
                route_score,

            "container_type":
                quotation.container_type,

            "container_count":
                quotation.container_count,

            "status":
                quotation.status,

            "created_at":
                quotation.created_at

        })

    return {

        "success": True,

        "total_routes":
            len(route_list),

        "routes":
            route_list

    }