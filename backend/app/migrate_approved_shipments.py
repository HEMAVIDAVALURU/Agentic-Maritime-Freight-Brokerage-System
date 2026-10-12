
from datetime import datetime

from app.database import SessionLocal
from app.db_models import (
    QuotationRequestDB,
    Shipment,
    ShipmentStatusHistory,
    Admin,
)

def migrate_approved_shipments():
    db = SessionLocal()

    try:
        year = datetime.now().year

        quotations = (
            db.query(QuotationRequestDB)
            .filter(QuotationRequestDB.status.ilike("approved"))
            .order_by(QuotationRequestDB.id.asc())
            .with_for_update()
            .all()
        )

        created_count = 0

        for quotation in quotations:
            # Skip quotations that already have a shipment.
            existing = (
                db.query(Shipment)
                .filter(Shipment.quotation_id == quotation.id)
                .first()
            )

            if existing:
                print(
                    f"Skipping quotation {quotation.id}: "
                    f"shipment {existing.shipment_id} already exists"
                )
                continue

            if not quotation.selected_route_id:
                print(
                    f"Skipping quotation {quotation.id}: "
                    "route ID is missing"
                )
                continue

            shipment = Shipment(
                shipment_id=f"TEMP-{quotation.id}-{year}",
                quotation_id=quotation.id,
                user_id=quotation.user_id,
                route_id=quotation.selected_route_id,
                origin=quotation.origin,
                destination=quotation.destination,
                cargo_type=quotation.cargo_type,
                container_type=quotation.container_type,
                container_count=quotation.container_count,
                status="booked",
            )

            db.add(shipment)
            db.flush()

            shipment.shipment_id = (
                f"SHP-{year}-{shipment.id:06d}"
            )

            history = ShipmentStatusHistory(
                shipment_id=shipment.shipment_id,
                previous_status=None,
                new_status="booked",
                note=(
                    f"Initial shipment created from "
                    f"approved quotation #{quotation.id}"
                ),
                updated_by_admin_id=None,
            )

            db.add(history)
            created_count += 1

        db.commit()

        print(
            f"Migration completed. "
            f"Shipments created: {created_count}"
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    migrate_approved_shipments()