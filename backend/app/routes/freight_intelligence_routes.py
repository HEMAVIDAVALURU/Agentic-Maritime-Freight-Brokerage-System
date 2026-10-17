
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.freight_intelligence_service import (
    FreightIntelligenceService
)

router = APIRouter(
    prefix="/api/freight-intelligence",
    tags=["Freight Intelligence"]
)

freight_intelligence_service = FreightIntelligenceService()


class FreightIntelligenceRequest(BaseModel):
    origin: str
    destination: str
    cargo_type: str
    containers: int = Field(gt=0)


@router.post("/generate")
def generate_freight_intelligence(
    request: FreightIntelligenceRequest
):
    try:
        result = (
            freight_intelligence_service
            .generate_freight_intelligence(
                origin=request.origin,
                destination=request.destination,
                cargo_type=request.cargo_type,
                containers=request.containers
            )
        )

        if result.get("status") != "success":
            raise HTTPException(
                status_code=400,
                detail=result
            )

        return result

    except HTTPException:
        raise

    except Exception as exc:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Freight intelligence generation failed: {str(exc)}"
        ) from exc
