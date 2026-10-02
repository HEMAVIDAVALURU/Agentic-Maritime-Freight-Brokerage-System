class RouteComparisonService:

    # =========================================================
    # FINAL COMPARISON WEIGHTS
    # =========================================================
    # Route Agent  = 25%
    # Pricing      = 25%
    # Weather      = 25%
    # Customs      = 25%
    #
    # TOTAL        = 100%
    # =========================================================

    ROUTE_WEIGHT = 0.25
    PRICING_WEIGHT = 0.25
    WEATHER_WEIGHT = 0.25
    CUSTOMS_WEIGHT = 0.25

    # =========================================================
    # SCORE LIMITS
    # =========================================================

    MIN_ROUTE_SCORE = 0.0
    MAX_ROUTE_SCORE = 100.0

    # =========================================================
    # WEATHER RISK RANGE
    # =========================================================

    MIN_WEATHER_RISK = 4.0
    MAX_WEATHER_RISK = 12.0

    # =========================================================
    # CUSTOMS SCORE
    # =========================================================
    # Valid      -> 100
    # Warning    -> 50
    # Restricted -> 0
    # =========================================================

    VALID_CUSTOMS_SCORE = 100.0
    WARNING_CUSTOMS_SCORE = 50.0
    RESTRICTED_CUSTOMS_SCORE = 0.0

    def __init__(
        self,
        pricing_agent,
        weather_agent,
        customs_agent
    ):
        self.pricing_agent = pricing_agent
        self.weather_agent = weather_agent
        self.customs_agent = customs_agent

    # =========================================================
    # ROUTE SCORE
    # =========================================================

    def calculate_route_score(
        self,
        route_score
    ):
        """
        Route Agent already returns a score on a 0-100 scale.

        Therefore, keep the actual Route Agent score.
        """

        score = float(route_score)

        return max(
            self.MIN_ROUTE_SCORE,
            min(
                score,
                self.MAX_ROUTE_SCORE
            )
        )

    # =========================================================
    # PRICE SCORE
    # =========================================================

    def calculate_price_score(
        self,
        price,
        min_price,
        max_price
    ):
        """
        Converts the actual selling price into a 0-100
        pricing score using the prices of the candidate routes.

        Lowest price  -> 100
        Highest price -> 0
        Other prices  -> Proportionate score
        """

        price = float(price)
        min_price = float(min_price)
        max_price = float(max_price)

        # -----------------------------------------------------
        # If every candidate route has the same price
        # -----------------------------------------------------

        if max_price == min_price:
            return 50.0

        # -----------------------------------------------------
        # Lower price = higher score
        # -----------------------------------------------------

        score = (
            (
                max_price - price
            )
            /
            (
                max_price - min_price
            )
        ) * 100

        return max(
            0.0,
            min(
                score,
                100.0
            )
        )

    # =========================================================
    # WEATHER SCORE
    # =========================================================

    def calculate_weather_score(
        self,
        risk_points
    ):
        """
        Converts Weather Agent risk points into a
        0-100 weather score.

        Lower risk = higher score.

            4 risk points  -> 100
            12 risk points -> 0
        """

        risk_points = float(
            risk_points
        )

        if (
            self.MAX_WEATHER_RISK
            ==
            self.MIN_WEATHER_RISK
        ):
            return 50.0

        score = (
            (
                self.MAX_WEATHER_RISK
                - risk_points
            )
            /
            (
                self.MAX_WEATHER_RISK
                - self.MIN_WEATHER_RISK
            )
        ) * 100

        return max(
            0.0,
            min(
                score,
                100.0
            )
        )

    # =========================================================
    # CUSTOMS SCORE
    # =========================================================

    def calculate_customs_score(
        self,
        customs_status
    ):
        """
        Converts Customs Agent status into a 0-100 score.

        Valid      -> 100
        Warning    -> 50
        Restricted -> 0
        """

        status = str(
            customs_status
        ).strip().lower()

        if status == "valid":

            return self.VALID_CUSTOMS_SCORE

        elif status == "warning":

            return self.WARNING_CUSTOMS_SCORE

        elif status == "restricted":

            return self.RESTRICTED_CUSTOMS_SCORE

        return 0.0

    # =========================================================
    # COMPARE ROUTES
    # =========================================================

    def compare_routes(
        self,
        candidate_routes,
        containers
    ):

        if not candidate_routes:

            return {
                "status": "not_found",
                "message": "No candidate routes available.",
                "routes": [],
                "top_routes": []
            }

        analyzed_routes = []

        # =====================================================
        # 1. RUN PRICING + WEATHER + CUSTOMS
        #    FOR ALL CANDIDATE ROUTES
        # =====================================================

        for route in candidate_routes:

            route_id = route["route_id"]

            # -------------------------------------------------
            # PRICING AGENT
            # -------------------------------------------------

            pricing_result = (
                self.pricing_agent.calculate_pricing(
                    route_id=route_id,
                    containers=containers
                )
            )

            # -------------------------------------------------
            # WEATHER AGENT
            # -------------------------------------------------

            weather_result = (
                self.weather_agent.assess_weather(
                    route_id=route_id
                )
            )

            # -------------------------------------------------
            # CUSTOMS AGENT
            # -------------------------------------------------

            customs_result = (
                self.customs_agent.validate_customs(
                    route_id=route_id
                )
            )

            # -------------------------------------------------
            # VALIDATE PRICING
            # -------------------------------------------------

            if (
                pricing_result.get("status")
                !=
                "success"
            ):
                continue

            # -------------------------------------------------
            # VALIDATE WEATHER
            # -------------------------------------------------

            if (
                weather_result.get("status")
                !=
                "success"
            ):
                continue

            # -------------------------------------------------
            # VALIDATE CUSTOMS
            # -------------------------------------------------

            if (
                customs_result.get("status")
                !=
                "success"
            ):
                continue

            analyzed_routes.append({

                "route":
                    route,

                "pricing":
                    pricing_result,

                "weather":
                    weather_result,

                "customs":
                    customs_result
            })

        # =====================================================
        # IF NO ROUTES COULD BE ANALYZED
        # =====================================================

        if not analyzed_routes:

            return {
                "status": "error",
                "message": (
                    "Unable to calculate "
                    "pricing, weather, and customs analysis."
                ),
                "routes": [],
                "top_routes": []
            }

        # =====================================================
        # 2. GET ACTUAL PRICE RANGE FROM CANDIDATE ROUTES
        # =====================================================
        #
        # No fixed $15,000 / $30,000 reference anymore.
        #
        # The score is based on the actual prices returned
        # for this particular route search.
        # =====================================================

        candidate_prices = [
            float(
                item["pricing"][
                    "final_selling_price_usd"
                ]
            )
            for item in analyzed_routes
        ]

        min_candidate_price = min(
            candidate_prices
        )

        max_candidate_price = max(
            candidate_prices
        )

        # =====================================================
        # 3. CALCULATE SCORES
        # =====================================================

        comparison_results = []

        for item in analyzed_routes:

            route = item["route"]

            pricing = item["pricing"]

            weather = item["weather"]

            customs = item["customs"]

            # -------------------------------------------------
            # ACTUAL ROUTE AGENT SCORE
            # -------------------------------------------------

            actual_route_score = float(
                route.get(
                    "route_score",
                    0
                )
            )

            route_score = (
                self.calculate_route_score(
                    actual_route_score
                )
            )

            # -------------------------------------------------
            # ACTUAL SELLING PRICE
            # -------------------------------------------------

            final_price = float(
                pricing[
                    "final_selling_price_usd"
                ]
            )

            # -------------------------------------------------
            # PRICE SCORE
            # -------------------------------------------------

            price_score = (
                self.calculate_price_score(
                    price=final_price,
                    min_price=min_candidate_price,
                    max_price=max_candidate_price
                )
            )

            # -------------------------------------------------
            # WEATHER RISK
            # -------------------------------------------------

            weather_risk_points = float(
                weather[
                    "risk_points"
                ]
            )

            # -------------------------------------------------
            # WEATHER SCORE
            # -------------------------------------------------

            weather_score = (
                self.calculate_weather_score(
                    weather_risk_points
                )
            )

            # -------------------------------------------------
            # CUSTOMS STATUS
            # -------------------------------------------------

            customs_status = customs.get(
                "customs_status",
                "Restricted"
            )

            # -------------------------------------------------
            # CUSTOMS SCORE
            # -------------------------------------------------

            customs_score = (
                self.calculate_customs_score(
                    customs_status
                )
            )

            # =================================================
            # FINAL SCORE / 100
            # =================================================
            #
            # Each factor contributes 25%.
            #
            # Route   = 25%
            # Price   = 25%
            # Weather = 25%
            # Customs = 25%
            # =================================================

            final_score = (

                route_score
                * self.ROUTE_WEIGHT

                +

                price_score
                * self.PRICING_WEIGHT

                +

                weather_score
                * self.WEATHER_WEIGHT

                +

                customs_score
                * self.CUSTOMS_WEIGHT
            )

            comparison_results.append({

                # ---------------------------------------------
                # ROUTE INFORMATION
                # ---------------------------------------------

                "route_id":
                    route["route_id"],

                "origin":
                    route["origin"],

                "destination":
                    route["destination"],

                "route_display":
                    route.get(
                        "route_display",
                        (
                            f'{route["origin"]}'
                            f' → '
                            f'{route["destination"]}'
                        )
                    ),

                "route_type":
                    route.get(
                        "route_type"
                    ),

                "transit_time_days":
                    route.get(
                        "transit_days"
                    ),

                "distance_nm":
                    route.get(
                        "distance_nm"
                    ),

                "transshipments":
                    route.get(
                        "transshipments"
                    ),

                # ---------------------------------------------
                # ROUTE SCORE
                # ---------------------------------------------

                "route_score":
                    round(
                        route_score,
                        2
                    ),

                # ---------------------------------------------
                # PRICING SCORE
                # ---------------------------------------------

                "price_score":
                    round(
                        price_score,
                        2
                    ),

                # Keep old field name for compatibility
                "price_comparison_score":
                    round(
                        price_score,
                        2
                    ),

                # ---------------------------------------------
                # WEATHER SCORE
                # ---------------------------------------------

                "weather_score":
                    round(
                        weather_score,
                        2
                    ),

                # Keep old field name for compatibility
                "weather_comparison_score":
                    round(
                        weather_score,
                        2
                    ),

                # ---------------------------------------------
                # CUSTOMS SCORE
                # ---------------------------------------------

                "customs_score":
                    round(
                        customs_score,
                        2
                    ),

                # ---------------------------------------------
                # ACTUAL SELLING PRICE
                # ---------------------------------------------

                "final_selling_price_usd":
                    round(
                        final_price,
                        2
                    ),

                # ---------------------------------------------
                # WEATHER DATA
                # ---------------------------------------------

                "wind_speed_knots":
                    weather[
                        "wind_speed_knots"
                    ],

                "wave_height_m":
                    weather[
                        "wave_height_m"
                    ],

                "visibility_km":
                    weather[
                        "visibility_km"
                    ],

                "storm_probability_percent":
                    weather[
                        "storm_probability_percent"
                    ],

                "weather_condition":
                    weather[
                        "weather_condition"
                    ],

                "weather_risk":
                    weather[
                        "weather_risk"
                    ],

                "risk_points":
                    weather[
                        "risk_points"
                    ],

                # ---------------------------------------------
                # CUSTOMS DATA
                # ---------------------------------------------

                "customs_id":
                    customs.get(
                        "customs_id"
                    ),

                "customs_status":
                    customs_status,

                "hs_code_required":
                    customs.get(
                        "hs_code_required"
                    ),

                "commercial_invoice":
                    customs.get(
                        "commercial_invoice"
                    ),

                "packing_list":
                    customs.get(
                        "packing_list"
                    ),

                "certificate_of_origin":
                    customs.get(
                        "certificate_of_origin"
                    ),

                "restricted_cargo":
                    customs.get(
                        "restricted_cargo"
                    ),

                "missing_documents":
                    customs.get(
                        "missing_documents",
                        []
                    ),

                "customs_recommendation":
                    customs.get(
                        "recommendation"
                    ),

                # ---------------------------------------------
                # FINAL SCORE
                # ---------------------------------------------

                "final_score":
                    round(
                        final_score,
                        2
                    )
            })

        # =====================================================
        # 4. SORT ALL ROUTES BY FINAL SCORE
        # =====================================================

        comparison_results.sort(
            key=lambda item: item["final_score"],
            reverse=True
        )

        # =====================================================
        # 5. ASSIGN RANK
        # =====================================================

        for rank, route in enumerate(
            comparison_results,
            start=1
        ):

            route["rank"] = rank

        # =====================================================
        # 6. REMOVE RESTRICTED ROUTES FROM RECOMMENDATION
        # =====================================================

        eligible_routes = [

            route

            for route in comparison_results

            if str(
                route.get(
                    "customs_status",
                    ""
                )
            ).lower()
            != "restricted"
        ]

        # =====================================================
        # 7. TOP 3 ELIGIBLE ROUTES
        # =====================================================

        top_routes = eligible_routes[:3]

        # =====================================================
        # 8. ALTERNATIVE ROUTES
        # =====================================================

        alternatives = top_routes[1:]

        # =====================================================
        # 9. FINAL RESPONSE
        # =====================================================

        return {

            "status":
                "success",

            "candidate_routes":
                len(candidate_routes),

            "analyzed_routes":
                len(comparison_results),

            "eligible_routes":
                len(eligible_routes),

            # ---------------------------------------------
            # WEIGHTS
            # ---------------------------------------------

            "route_weight":
                self.ROUTE_WEIGHT,

            "pricing_weight":
                self.PRICING_WEIGHT,

            "weather_weight":
                self.WEATHER_WEIGHT,

            "customs_weight":
                self.CUSTOMS_WEIGHT,

            # ---------------------------------------------
            # ROUTES
            # ---------------------------------------------

            "routes":
                comparison_results,

            "top_routes":
                top_routes,

            "recommended_route":
                (
                    top_routes[0]
                    if top_routes
                    else None
                ),

            "alternatives":
                alternatives,

            # ---------------------------------------------
            # REASON
            # ---------------------------------------------

            "reason": (
                "Final ranking is based on "
                "Route Agent score, pricing score, "
                "weather score, and customs score, "
                "with each factor contributing 25%."
            )
        }