import os
import pandas as pd


class CustomsAgent:
    """
    Customs Agent for maritime freight compliance assessment.

    Validates customs documentation requirements and identifies
    restricted cargo based on customs.csv.
    """

    def __init__(self):

        # Locate app/data/customs.csv
        current_file = os.path.abspath(__file__)
        app_folder = os.path.dirname(
            os.path.dirname(current_file)
        )

        self.customs_file = os.path.join(
            app_folder,
            "data",
            "customs.csv"
        )

        # Verify that the customs file exists
        if not os.path.exists(self.customs_file):
            raise FileNotFoundError(
                f"Customs data file not found: "
                f"{self.customs_file}"
            )

        # Load customs data
        self.customs_data = pd.read_csv(
            self.customs_file
        )

        # Normalize column names
        self.customs_data.columns = (
            self.customs_data.columns.str.strip()
        )

        # Required columns
        required_columns = [
            "customs_id",
            "route_id",
            "cargo_type",
            "hs_code_required",
            "commercial_invoice",
            "packing_list",
            "certificate_of_origin",
            "restricted_cargo",
        ]

        missing_columns = [
            column
            for column in required_columns
            if column not in self.customs_data.columns
        ]

        if missing_columns:
            raise ValueError(
                "Missing required columns in customs.csv: "
                + ", ".join(missing_columns)
            )

        # Normalize identifiers and text values
        self.customs_data["route_id"] = (
            self.customs_data["route_id"]
            .astype(str)
            .str.strip()
            .str.upper()
        )

        self.customs_data["cargo_type"] = (
            self.customs_data["cargo_type"]
            .astype(str)
            .str.strip()
        )

        # Normalize Yes/No values
        boolean_columns = [
            "hs_code_required",
            "commercial_invoice",
            "packing_list",
            "certificate_of_origin",
            "restricted_cargo",
        ]

        for column in boolean_columns:
            self.customs_data[column] = (
                self.customs_data[column]
                .astype(str)
                .str.strip()
                .str.capitalize()
            )

        print(
            "CustomsAgent initialized successfully. "
            f"Loaded {len(self.customs_data)} records."
        )

    # =====================================================
    # VALIDATE CUSTOMS REQUIREMENTS
    # =====================================================

    def validate_customs(self, route_id, cargo_type=None):

        route_id = str(route_id).strip().upper()

        # Customs records are related by route + cargo type.
        customs_data = self.customs_data[
            self.customs_data["route_id"] == route_id
        ]

        if cargo_type is not None and not customs_data.empty:
            normalized_cargo = str(cargo_type).strip().casefold()
            cargo_matches = customs_data[
                customs_data["cargo_type"].astype(str).str.strip().str.casefold()
                == normalized_cargo
            ]
            if not cargo_matches.empty:
                customs_data = cargo_matches

        if customs_data.empty:
            return {
                "status": "not_found",
                "route_id": route_id,
                "message": (
                    f"No customs data found for route "
                    f"{route_id}."
                ),
            }

        # Use the first matching record
        customs = customs_data.iloc[0]

        # Check documentation requirements
        document_fields = {
            "hs_code_required": "HS Code",
            "commercial_invoice": "Commercial Invoice",
            "packing_list": "Packing List",
            "certificate_of_origin": "Certificate of Origin",
        }

        missing_documents = []

        for column, document_name in document_fields.items():
            if customs[column] != "Yes":
                missing_documents.append(document_name)

        restricted_value = customs["restricted_cargo"]

        # Determine customs status from the actual validation fields.
        #
        # Business rule:
        #   1. Restricted cargo always requires compliance review.
        #   2. If cargo is not restricted AND all required documents
        #      are marked Yes, the quotation is Valid.
        #   3. Otherwise it is Warning.
        #
        # We intentionally do NOT blindly trust a precomputed
        # customs_status value from the CSV because the dashboard
        # status must reflect the individual document fields shown
        # to the admin.

        if restricted_value == "Yes":

            customs_status = "Restricted"

            recommendation = (
                "Shipment requires additional compliance "
                "review before proceeding."
            )

        elif (
            restricted_value == "No"
            and not missing_documents
        ):

            customs_status = "Valid"

            recommendation = (
                "All required customs documentation "
                "is marked as available."
            )

        else:

            customs_status = "Warning"

            recommendation = (
                "Review customs requirements and obtain "
                "any missing documentation before shipment."
            )

        # Return structured assessment
        return {
            "status": "success",
            "customs_id": str(customs["customs_id"]),
            "route_id": str(customs["route_id"]),
            "cargo_type": str(customs["cargo_type"]),
            "hs_code_required": customs[
                "hs_code_required"
            ],
            "commercial_invoice": customs[
                "commercial_invoice"
            ],
            "packing_list": customs["packing_list"],
            "certificate_of_origin": customs[
                "certificate_of_origin"
            ],
            "restricted_cargo": restricted_value,
            "customs_status": customs_status,
            "missing_documents": missing_documents,
            "recommendation": recommendation,
        }