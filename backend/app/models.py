from pydantic import BaseModel


class RouteRequest(BaseModel):
    origin: str
    destination: str
    cargo_type: str
    containers: int


class QuotationRequest(BaseModel):
    origin: str
    destination: str
    cargo_type: str
    containers: int
    route_id: str


class PricingRequest(BaseModel):
    route_id: str
    containers: int