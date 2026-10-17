
from app.services.quotation_service import QuotationService
from app.services.route_comparison_service import RouteComparisonService
from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.customs_agent import CustomsAgent


class FreightIntelligenceService:

    def __init__(self):
        self.quotation_service = QuotationService()

        self.route_agent = RouteAgent()
        self.pricing_agent = PricingAgent()
        self.weather_agent = WeatherAgent()
        self.customs_agent = CustomsAgent()

        self.route_comparison_service = RouteComparisonService(
            pricing_agent=self.pricing_agent,
            weather_agent=self.weather_agent,
            customs_agent=self.customs_agent
        )

    def generate_freight_intelligence(
        self,
        origin,
        destination,
        cargo_type,
        containers
    ):
        # Step 1: Analyze available routes
        route_result = self.route_agent.analyze_route(
            origin=origin,
            destination=destination,
            cargo_type=cargo_type,
            containers=containers
        )

        # Validate RouteAgent response
        if not isinstance(route_result, dict):
            return {
                "status": "error",
                "message": (
                    "RouteAgent returned an invalid response. "
                    f"Expected dict, received "
                    f"{type(route_result).__name__}."
                )
            }

        if route_result.get("status") != "success":
            return route_result

        # Step 2: Extract an actual list of route dictionaries.
        # candidate_routes may be an integer count in older responses,
        # so validate each field before using it.
        candidate_routes = route_result.get("candidate_routes")

        if not isinstance(candidate_routes, (list, tuple)):
            candidate_routes = route_result.get("available_routes")

        if not isinstance(candidate_routes, (list, tuple)):
            candidate_routes = route_result.get("top_routes")

        if not isinstance(candidate_routes, (list, tuple)):
            candidate_routes = route_result.get("routes")

        if not isinstance(candidate_routes, (list, tuple)):
            return {
                "status": "error",
                "message": (
                    "RouteAgent did not return a route list. "
                    "Expected candidate_routes, available_routes, "
                    "top_routes, or routes to be a list."
                )
            }

        # Keep only valid route dictionaries containing route_id.
        candidate_routes = [
            route
            for route in candidate_routes
            if isinstance(route, dict)
            and route.get("route_id") is not None
        ]

        if not candidate_routes:
            return {
                "status": "error",
                "message": (
                    "No valid candidate routes were returned "
                    "by RouteAgent."
                )
            }

        # Step 3: Compare routes using pricing, weather, and customs.
        comparison_result = (
            self.route_comparison_service.compare_routes(
                candidate_routes=candidate_routes,
                containers=containers
            )
        )

        if not isinstance(comparison_result, dict):
            return {
                "status": "error",
                "message": (
                    "RouteComparisonService returned an invalid response."
                )
            }

        if comparison_result.get("status") != "success":
            return comparison_result

        recommended_route = comparison_result.get(
            "recommended_route"
        )

        if not isinstance(recommended_route, dict):
            return {
                "status": "error",
                "message": (
                    "No eligible route is available. "
                    "Check pricing, weather, and customs data."
                )
            }

        # Step 4: Generate quotation for the recommended route.
        quotation_result = (
            self.quotation_service.generate_quotation(
                origin=origin,
                destination=destination,
                containers=containers,
                cargo_type=cargo_type,
                route_id=recommended_route.get("route_id")
            )
        )

        if not isinstance(quotation_result, dict):
            return {
                "status": "error",
                "message":(
                    "QuotationService returned an invalid response."
                )
            }

        if quotation_result.get("status") != "success":
            return quotation_result

        # Step 5: Build the unified freight intelligence response.
        pricing = quotation_result.get("pricing", {})

        if not isinstance(pricing, dict):
            pricing = {}

        route_weights = {
            "route": comparison_result.get("route_weight", 0.25),
            "pricing": comparison_result.get("pricing_weight", 0.25),
            "weather": comparison_result.get("weather_weight", 0.25),
            "customs": comparison_result.get("customs_weight", 0.25)
        }

        return {
            "status": "success",

            "shipment": {
                "origin": origin,
                "destination": destination,
                "cargo_type": cargo_type,
                "containers": containers
            },

            "route_intelligence": {
                "recommended_route": recommended_route,
                "route_score": recommended_route.get("route_score"),
                "final_score": recommended_route.get("final_score"),
                "transit_time_days": recommended_route.get(
                    "transit_time_days"
                ),
                "distance_nm": recommended_route.get("distance_nm"),
                "alternatives": comparison_result.get(
                    "alternatives", []
                )
            },

            "pricing_intelligence": {
                "route_id": pricing.get(
                    "route_id",
                    recommended_route.get("route_id")
                ),
                "total_cost_usd": pricing.get(
                    "total_operational_cost_usd"
                ),
                "total_profit_usd": pricing.get("profit_usd"),
                "total_quotation_usd": pricing.get(
                    "final_selling_price_usd"
                ),
                "target_margin_percent": pricing.get(
                    "target_margin_percent"
                ),
                "actual_margin_percent": pricing.get(
                    "actual_margin_percent"
                )
            },

            "risk_intelligence": {
                "weather_risk": recommended_route.get(
                    "weather_risk"
                ),
                "weather_condition": recommended_route.get(
                    "weather_condition"
                ),
                "customs_status": recommended_route.get(
                    "customs_status"
                ),
                "missing_documents": recommended_route.get(
                    "missing_documents", []
                ),
                "customs_recommendation": recommended_route.get(
                    "customs_recommendation"
                )
            },

            "route_comparison": {
                "total_routes_analyzed": comparison_result.get(
                    "analyzed_routes", 0
                ),
                "candidate_routes": comparison_result.get(
                    "candidate_routes", len(candidate_routes)
                ),
                "eligible_routes": comparison_result.get(
                    "eligible_routes", 0
                ),
                "routes": comparison_result.get("routes", []),
                "weights": route_weights
            },

            "business_recommendation": comparison_result.get(
                "reason",
                "Review the recommended route and its risk details."
            )
        }
