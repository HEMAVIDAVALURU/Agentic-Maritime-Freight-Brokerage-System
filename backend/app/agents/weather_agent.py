import os
import pandas as pd


class WeatherAgent:
    """
    Weather Agent for maritime route weather assessment.

    Reads weather information from weather.csv and calculates
    weather risk based on wind speed, wave height, visibility,
    and storm probability.
    """

    def __init__(self):

        # -----------------------------------------------------
        # LOCATE PROJECT DIRECTORY
        # -----------------------------------------------------

        current_file = os.path.abspath(__file__)

        # Expected structure:
        # backend/
        #   app/
        #     agents/
        #       weather_agent.py
        #     data/
        #       weather.csv

        project_root = os.path.dirname(
            os.path.dirname(
                os.path.dirname(current_file)
            )
        )

        self.weather_path = os.path.join(
            project_root,
            "app",
            "data",
            "weather.csv"
        )

        # -----------------------------------------------------
        # LOAD WEATHER DATA
        # -----------------------------------------------------

        if not os.path.exists(self.weather_path):
            raise FileNotFoundError(
                f"Weather data file not found: {self.weather_path}"
            )

        self.weather = pd.read_csv(self.weather_path)

        # Normalize column names to avoid whitespace issues.
        self.weather.columns = (
            self.weather.columns.str.strip()
        )

        # Required columns in weather.csv.
        required_columns = [
            "route_id",
            "wind_speed_knots",
            "wave_height_m",
            "visibility_km",
            "storm_probability",
            "weather_condition",
        ]

        missing_columns = [
            column
            for column in required_columns
            if column not in self.weather.columns
        ]

        if missing_columns:
            raise ValueError(
                "Missing required columns in weather.csv: "
                + ", ".join(missing_columns)
            )

        # Normalize route IDs for reliable matching.
        self.weather["route_id"] = (
            self.weather["route_id"]
            .astype(str)
            .str.strip()
        )

        print(
            f"WeatherAgent initialized successfully. "
            f"Loaded {len(self.weather)} weather records."
        )

    # =========================================================
    # CALCULATE WEATHER RISK
    # =========================================================

    def calculate_risk(
        self,
        wind_speed,
        wave_height,
        visibility,
        storm_probability
    ):

        risk_points = 0

        # Wind speed risk
        if wind_speed >= 35:
            risk_points += 3
        elif wind_speed >= 25:
            risk_points += 2
        else:
            risk_points += 1

        # Wave height risk
        if wave_height >= 4.5:
            risk_points += 3
        elif wave_height >= 3:
            risk_points += 2
        else:
            risk_points += 1

        # Visibility risk
        if visibility < 8:
            risk_points += 3
        elif visibility < 12:
            risk_points += 2
        else:
            risk_points += 1

        # Storm probability risk
        if storm_probability >= 40:
            risk_points += 3
        elif storm_probability >= 20:
            risk_points += 2
        else:
            risk_points += 1

        # Overall weather risk
        if risk_points >= 10:
            risk_level = "HIGH"
        elif risk_points >= 7:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return risk_level, risk_points

    # =========================================================
    # ASSESS WEATHER FOR A ROUTE
    # =========================================================

    def assess_weather(self, route_id):

        # Normalize the requested route ID.
        route_id = str(route_id).strip()

        # Find weather data for the requested route.
        weather_data = self.weather[
            self.weather["route_id"] == route_id
        ]

        # Return a structured response if data is unavailable.
        if weather_data.empty:
            return {
                "status": "not_found",
                "route_id": route_id,
                "message": (
                    f"No weather data found for route {route_id}"
                )
            }

        weather = weather_data.iloc[0]

        # -----------------------------------------------------
        # EXTRACT WEATHER VALUES
        # -----------------------------------------------------

        try:
            wind_speed = float(
                weather["wind_speed_knots"]
            )

            wave_height = float(
                weather["wave_height_m"]
            )

            visibility = float(
                weather["visibility_km"]
            )

            storm_probability = float(
                weather["storm_probability"]
            )

        except (TypeError, ValueError) as error:
            return {
                "status": "error",
                "route_id": route_id,
                "message": (
                    f"Invalid weather data for route "
                    f"{route_id}: {error}"
                )
            }

        # -----------------------------------------------------
        # VALIDATE WEATHER VALUES
        # -----------------------------------------------------

        if (
            wind_speed < 0
            or wave_height < 0
            or visibility < 0
            or not 0 <= storm_probability <= 100
        ):
            return {
                "status": "error",
                "route_id": route_id,
                "message": (
                    f"Weather values are outside the valid "
                    f"range for route {route_id}."
                )
            }

        # -----------------------------------------------------
        # CALCULATE RISK
        # -----------------------------------------------------

        risk_level, risk_points = self.calculate_risk(
            wind_speed=wind_speed,
            wave_height=wave_height,
            visibility=visibility,
            storm_probability=storm_probability
        )

        # -----------------------------------------------------
        # GENERATE RECOMMENDATION
        # -----------------------------------------------------

        if risk_level == "HIGH":
            recommendation = (
                "High weather risk detected. Review the route "
                "and consider delaying or changing the voyage."
            )

        elif risk_level == "MEDIUM":
            recommendation = (
                "Moderate weather risk detected. Monitor "
                "conditions and review the voyage plan."
            )

        else:
            recommendation = (
                "Weather risk is relatively low based on "
                "the available weather data."
            )

        # -----------------------------------------------------
        # RETURN WEATHER ASSESSMENT
        # -----------------------------------------------------

        return {
            "status": "success",
            "route_id": route_id,
            "wind_speed_knots": wind_speed,
            "wave_height_m": wave_height,
            "visibility_km": visibility,
            "storm_probability_percent": storm_probability,
            "weather_condition": str(
                weather["weather_condition"]
            ),
            "weather_risk": risk_level,
            "risk_points": risk_points,
            "recommendation": recommendation
        }