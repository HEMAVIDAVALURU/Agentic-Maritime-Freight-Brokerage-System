import os
import pandas as pd


class RouteAgent:

    def __init__(self):

        current_file = os.path.abspath(__file__)

        project_root = os.path.dirname(
            os.path.dirname(
                os.path.dirname(current_file)
            )
        )

        self.dataset_path = os.path.join(
            project_root,
            "app",
            "data",
            "route.csv"
        )

        self.routes = pd.read_csv(
            self.dataset_path
        )

    def analyze_route(
        self,
        origin,
        destination,
        cargo_type,
        containers
    ):

        # =====================================================
        # 1. FIND MATCHING ROUTES
        # =====================================================

        matching_routes = self.routes[
            (
                self.routes["origin"]
                .astype(str)
                .str.strip()
                .str.lower()
                == origin.strip().lower()
            )
            &
            (
                self.routes["destination"]
                .astype(str)
                .str.strip()
                .str.lower()
                == destination.strip().lower()
            )
        ].copy()

        # =====================================================
        # 2. NO ROUTE FOUND
        # =====================================================

        if matching_routes.empty:

            return {
                "status": "not_found",
                "origin": origin,
                "destination": destination,
                "cargo_type": cargo_type,
                "containers": containers,
                "available_routes": [],
                "top_routes": [],
                "recommended_route": None,
                "alternatives": [],
                "message": (
                    f"No route available from "
                    f"{origin} → {destination}."
                )
            }

        # =====================================================
        # 3. FIND MAXIMUM VALUES
        # =====================================================

        max_transit = matching_routes[
            "transit_days"
        ].max()

        max_distance = matching_routes[
            "distance_nm"
        ].max()

        # =====================================================
        # 4. TRANSIT TIME SCORE - 40%
        # =====================================================

        matching_routes["transit_score"] = (
            100
            - (
                matching_routes["transit_days"]
                / max_transit
                * 100
            )
            if max_transit
            else 100
        )

        # =====================================================
        # 5. DISTANCE SCORE - 25%
        # =====================================================

        matching_routes["distance_score"] = (
            100
            - (
                matching_routes["distance_nm"]
                / max_distance
                * 100
            )
            if max_distance
            else 100
        )

        # =====================================================
        # 6. TRANSSHIPMENT SCORE - 35%
        # =====================================================

        matching_routes["transshipment_score"] = (
            100
            - (
                matching_routes["transshipments"]
                * 20
            )
        )

        # =====================================================
        # 7. OVERALL ROUTE SCORE
        #
        # Transit Time       = 40%
        # Distance           = 25%
        # Transshipment      = 35%
        # =====================================================

        matching_routes["route_score"] = (
            matching_routes["transit_score"] * 0.40
            +
            matching_routes["distance_score"] * 0.25
            +
            matching_routes["transshipment_score"] * 0.35
        ).round(2)

        # =====================================================
        # 8. SORT BY BEST ROUTE SCORE
        # =====================================================

        matching_routes = (
            matching_routes
            .sort_values(
                by="route_score",
                ascending=False
            )
            .reset_index(drop=True)
        )

        # =====================================================
        # 9. TOP 3 ROUTES
        # =====================================================

        top_routes = matching_routes.head(3)

        # =====================================================
        # 10. HELPER FUNCTION FOR MAP DATA
        # =====================================================

        def get_map_data(route):

            def get_float(column):

                value = route.get(column)

                if pd.isna(value):
                    return None

                try:
                    return float(value)
                except (ValueError, TypeError):
                    return None

            def get_text(column):

                value = route.get(column)

                if pd.isna(value):
                    return ""

                return str(value).strip()

            return {

                "origin_lat":
                    get_float("origin_lat"),

                "origin_lng":
                    get_float("origin_lng"),

                "destination_lat":
                    get_float("destination_lat"),

                "destination_lng":
                    get_float("destination_lng"),

                "transshipment_1":
                    get_text("transshipment_1"),

                "transshipment_1_lat":
                    get_float("transshipment_1_lat"),

                "transshipment_1_lng":
                    get_float("transshipment_1_lng"),

                "transshipment_2":
                    get_text("transshipment_2"),

                "transshipment_2_lat":
                    get_float("transshipment_2_lat"),

                "transshipment_2_lng":
                    get_float("transshipment_2_lng")
            }

        # =====================================================
        # 11. ALL AVAILABLE ROUTES
        # =====================================================

        available_routes = []

        for _, route in matching_routes.iterrows():

            route_origin = str(
                route["origin"]
            )

            route_destination = str(
                route["destination"]
            )

            route_data = {

                "route_id":
                    route["route_id"],

                "origin":
                    route_origin,

                "destination":
                    route_destination,

                "route_display":
                    f"{route_origin} → {route_destination}",

                "distance_nm":
                    int(route["distance_nm"]),

                "transit_days":
                    int(route["transit_days"]),

                "transshipments":
                    int(route["transshipments"]),

                "route_type":
                    route["route_type"],

                "base_freight_usd":
                    float(
                        route["base_freight_usd"]
                    ),

                "transit_score":
                    round(
                        float(
                            route["transit_score"]
                        ),
                        2
                    ),

                "distance_score":
                    round(
                        float(
                            route["distance_score"]
                        ),
                        2
                    ),

                "transshipment_score":
                    round(
                        float(
                            route["transshipment_score"]
                        ),
                        2
                    ),

                "route_score":
                    float(
                        route["route_score"]
                    )
            }

            route_data.update(
                get_map_data(route)
            )

            available_routes.append(
                route_data
            )

        # =====================================================
        # 12. CREATE TOP 3 ROUTE OBJECTS
        # =====================================================

        top_routes_list = []

        for rank, (_, route) in enumerate(
            top_routes.iterrows(),
            start=1
        ):

            route_origin = str(
                route["origin"]
            )

            route_destination = str(
                route["destination"]
            )

            route_data = {

                "rank":
                    rank,

                "route_id":
                    route["route_id"],

                "origin":
                    route_origin,

                "destination":
                    route_destination,

                "route_display":
                    f"{route_origin} → {route_destination}",

                "route_type":
                    route["route_type"],

                "transit_time_days":
                    int(
                        route["transit_days"]
                    ),

                "distance_nm":
                    int(
                        route["distance_nm"]
                    ),

                "transshipments":
                    int(
                        route["transshipments"]
                    ),

                "transit_score":
                    round(
                        float(
                            route["transit_score"]
                        ),
                        2
                    ),

                "distance_score":
                    round(
                        float(
                            route["distance_score"]
                        ),
                        2
                    ),

                "transshipment_score":
                    round(
                        float(
                            route["transshipment_score"]
                        ),
                        2
                    ),

                "route_score":
                    float(
                        route["route_score"]
                    ),

                "base_freight_usd":
                    float(
                        route["base_freight_usd"]
                    )
            }

            # Add coordinates and intermediate ports
            route_data.update(
                get_map_data(route)
            )

            top_routes_list.append(
                route_data
            )

        # =====================================================
        # 13. RECOMMENDED ROUTE - RANK 1
        # =====================================================

        best_route = top_routes.iloc[0]

        best_origin = str(
            best_route["origin"]
        )

        best_destination = str(
            best_route["destination"]
        )

        recommended_route = {

            "rank":
                1,

            "route_id":
                best_route["route_id"],

            "origin":
                best_origin,

            "destination":
                best_destination,

            "route_display":
                f"{best_origin} → {best_destination}",

            "route_type":
                best_route["route_type"],

            "transit_time_days":
                int(
                    best_route["transit_days"]
                ),

            "distance_nm":
                int(
                    best_route["distance_nm"]
                ),

            "transshipments":
                int(
                    best_route["transshipments"]
                ),

            "transit_score":
                round(
                    float(
                        best_route["transit_score"]
                    ),
                    2
                ),

            "distance_score":
                round(
                    float(
                        best_route["distance_score"]
                    ),
                    2
                ),

            "transshipment_score":
                round(
                    float(
                        best_route[
                            "transshipment_score"
                        ]
                    ),
                    2
                ),

            "route_score":
                float(
                    best_route["route_score"]
                ),

            "base_freight_usd":
                float(
                    best_route[
                        "base_freight_usd"
                    ]
                )
        }

        recommended_route.update(
            get_map_data(best_route)
        )

        # =====================================================
        # 14. ALTERNATIVE ROUTES - RANK 2 & 3
        # =====================================================

        alternatives = []

        for rank, (_, route) in enumerate(
            top_routes.iloc[1:].iterrows(),
            start=2
        ):

            route_origin = str(
                route["origin"]
            )

            route_destination = str(
                route["destination"]
            )

            route_data = {

                "rank":
                    rank,

                "route_id":
                    route["route_id"],

                "origin":
                    route_origin,

                "destination":
                    route_destination,

                "route_display":
                    f"{route_origin} → {route_destination}",

                "route_type":
                    route["route_type"],

                "transit_time_days":
                    int(
                        route["transit_days"]
                    ),

                "distance_nm":
                    int(
                        route["distance_nm"]
                    ),

                "transshipments":
                    int(
                        route["transshipments"]
                    ),

                "transit_score":
                    round(
                        float(
                            route["transit_score"]
                        ),
                        2
                    ),

                "distance_score":
                    round(
                        float(
                            route["distance_score"]
                        ),
                        2
                    ),

                "transshipment_score":
                    round(
                        float(
                            route[
                                "transshipment_score"
                            ]
                        ),
                        2
                    ),

                "route_score":
                    float(
                        route["route_score"]
                    ),

                "base_freight_usd":
                    float(
                        route[
                            "base_freight_usd"
                        ]
                    )
            }

            route_data.update(
                get_map_data(route)
            )

            alternatives.append(
                route_data
            )

        # =====================================================
        # 15. FINAL RESPONSE
        # =====================================================

        return {

            "status":
                "success",

            "origin":
                origin,

            "destination":
                destination,

            "route_display":
                f"{origin} → {destination}",

            "cargo_type":
                cargo_type,

            "containers":
                containers,

            "candidate_routes":
                len(matching_routes),

            "top_routes":
                top_routes_list,

            "available_routes":
                available_routes,

            "recommended_route":
                recommended_route,

            "alternatives":
                alternatives,

            "reason":
                "Recommended route selected based on the optimal routing score."
        }