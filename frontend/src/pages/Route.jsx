import { useEffect, useRef, useState } from "react";

import {
  analyzeRoute,
  calculatePricing,
  saveQuotation,
  requestQuotationApproval,
} from "../services/quotationApi";

import { RouteWorldMap } from "./Map";

import "./Route.css";

function Route() {
  const [routeOptions, setRouteOptions] = useState({
    origins: [],
    destinations_by_origin: {},
    cargo_types: [],
  });

  const [routeOptionsLoading, setRouteOptionsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    cargo_type: "",
    containers: 1,
  });

  const [routeResults, setRouteResults] = useState(null);
  const [comparisonResults, setComparisonResults] = useState({});
  const [pricingResults, setPricingResults] = useState({});
  const [weatherResults, setWeatherResults] = useState({});

  const [mapOpen, setMapOpen] = useState(false);
  const [mapRoute, setMapRoute] = useState(null);
  const [whyBestOpenRoute, setWhyBestOpenRoute] = useState(null);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [savedQuotationIds, setSavedQuotationIds] = useState({});
  const [saveQuotationMessages, setSaveQuotationMessages] = useState({});
  const [approvalQuotationMessages, setApprovalQuotationMessages] = useState({});
  const [quotationActionLoading, setQuotationActionLoading] = useState("");

  // Prevent Save / Request Approval from being triggered twice
  // before React has a chance to re-render.
  const quotationActionLockRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // =========================================================
  // LOAD CURRENT USER
  // =========================================================

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setUserLoading(true);

        const response = await fetch(
          "http://localhost:8000/api/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          setCurrentUser(null);
          return;
        }

        const data = await response.json();

        setCurrentUser(
          data.success && data.user
            ? data.user
            : null
        );
      } catch (error) {
        console.error(
          "Unable to load current user:",
          error
        );

        setCurrentUser(null);
      } finally {
        setUserLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

  // =========================================================
  // LOAD ROUTE OPTIONS
  // Origin / Destination / Cargo Type
  // COME FROM route.csv THROUGH BACKEND
  // =========================================================

  useEffect(() => {
    const loadRouteOptions = async () => {
      try {
        setRouteOptionsLoading(true);

        const response = await fetch(
          "http://localhost:8000/api/routes/options",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load route options."
          );
        }

        const data = await response.json();

        if (data.status === "success") {
          setRouteOptions({
            origins: Array.isArray(data.origins)
              ? data.origins
              : [],

            destinations_by_origin:
              data.destinations_by_origin || {},

            cargo_types: Array.isArray(data.cargo_types)
              ? data.cargo_types
              : [],
          });
        }
      } catch (error) {
        console.error(
          "Unable to load route options:",
          error
        );
      } finally {
        setRouteOptionsLoading(false);
      }
    };

    loadRouteOptions();
  }, []);

  // =========================================================
  // DROPDOWN DATA
  // =========================================================

  const origins = Array.isArray(routeOptions.origins)
    ? routeOptions.origins
    : [];

  const cargoTypes = Array.isArray(
    routeOptions.cargo_types
  )
    ? routeOptions.cargo_types
    : [];

  const destinations = (() => {
    if (!formData.origin) {
      return [];
    }

    const map =
      routeOptions.destinations_by_origin || {};

    if (Array.isArray(map[formData.origin])) {
      return map[formData.origin];
    }

    const key = Object.keys(map).find(
      (item) =>
        String(item).trim().toLowerCase() ===
        String(formData.origin)
          .trim()
          .toLowerCase()
    );

    return key && Array.isArray(map[key])
      ? map[key]
      : [];
  })();

  // =========================================================
  // RESET RESULTS WHEN INPUT CHANGES
  // =========================================================

  const resetAfterInputChange = () => {
    setRouteResults(null);
    setComparisonResults({});
    setPricingResults({});
    setWeatherResults({});

    setMapOpen(false);
    setMapRoute(null);
    setWhyBestOpenRoute(null);
    setSelectedRoute(null);

    setSavedQuotationIds({});
    setSaveQuotationMessages({});
    setApprovalQuotationMessages({});
    setQuotationActionLoading("");

    setErrorMessage("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,

      ...(name === "origin"
        ? { destination: "" }
        : {}),
    }));

    resetAfterInputChange();
  };

  // =========================================================
  // CONTAINER QUANTITY
  // =========================================================

  const decreaseContainers = () => {
    setFormData((previous) => ({
      ...previous,
      containers: Math.max(
        1,
        Number(previous.containers) - 1
      ),
    }));

    resetAfterInputChange();
  };

  const increaseContainers = () => {
    setFormData((previous) => ({
      ...previous,
      containers:
        Number(previous.containers) + 1,
    }));

    resetAfterInputChange();
  };

  // =========================================================
  // COMPLETE ROUTE COMPARISON
  // Route + Pricing + Weather + Customs
  // =========================================================

  const fetchComparison = async () => {
    const response = await fetch(
      "http://localhost:8000/api/routes/analyze-price-weather",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
          origin: formData.origin.trim(),
          destination: formData.destination.trim(),
          cargo_type: formData.cargo_type.trim(),
          containers: Number(formData.containers),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        "Unable to analyze route, price, weather, and customs."
      );
    }

    return response.json();
  };

  // =========================================================
  // WEATHER
  // =========================================================

  const fetchWeather = async (routeId) => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/weather/assess",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            route_id: routeId,
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Weather assessment failed for ${routeId}:`,
        error
      );

      return null;
    }
  };

  // =========================================================
  // ANALYZE ROUTE
  // =========================================================

  const handleAnalyzeRoute = async () => {
    setErrorMessage("");
    setLoading(true);

    setRouteResults(null);
    setComparisonResults({});
    setPricingResults({});
    setWeatherResults({});

    setMapOpen(false);
    setMapRoute(null);
    setWhyBestOpenRoute(null);
    setSelectedRoute(null);

    setSavedQuotationIds({});
    setSaveQuotationMessages({});
    setApprovalQuotationMessages({});

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!formData.origin) {
      setErrorMessage("Please select an origin.");
      setLoading(false);
      return;
    }

    if (!formData.destination) {
      setErrorMessage(
        "Please select a destination."
      );
      setLoading(false);
      return;
    }

    if (
      formData.origin.trim().toLowerCase() ===
      formData.destination.trim().toLowerCase()
    ) {
      setErrorMessage(
        "Origin and destination cannot be the same."
      );
      setLoading(false);
      return;
    }

    if (!formData.cargo_type) {
      setErrorMessage(
        "Please select a cargo type."
      );
      setLoading(false);
      return;
    }

    if (
      !formData.containers ||
      Number(formData.containers) <= 0
    ) {
      setErrorMessage(
        "Container quantity must be greater than 0."
      );
      setLoading(false);
      return;
    }

    try {
      // -----------------------------------------------------
      // ROUTE AGENT
      // -----------------------------------------------------

      const result = await analyzeRoute({
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        cargo_type: formData.cargo_type.trim(),
        containers: Number(formData.containers),
      });

      const available = Array.isArray(
        result?.available_routes
      )
        ? result.available_routes
        : [];

      const routeOnlyTop = Array.isArray(
        result?.top_routes
      )
        ? result.top_routes
        : [];

      if (
        result?.status === "not_found" ||
        (available.length === 0 &&
          routeOnlyTop.length === 0)
      ) {
        setErrorMessage(
          result?.message || "No results found."
        );
        return;
      }

      // -----------------------------------------------------
      // ROUTE + PRICE + WEATHER + CUSTOMS COMPARISON
      // -----------------------------------------------------

      let comparisonData = null;

      try {
        comparisonData = await fetchComparison();
      } catch (comparisonError) {
        console.error(
          "Route comparison error:",
          comparisonError
        );

        setErrorMessage(
          comparisonError.message ||
            "Unable to complete route comparison."
        );

        return;
      }

      const comparisonRoutes = Array.isArray(
        comparisonData?.routes
      )
        ? comparisonData.routes
        : [];

      const comparisonById =
        Object.fromEntries(
          comparisonRoutes.map((item) => [
            item.route_id,
            item,
          ])
        );

       console.log(
  "PRICE SCORES FROM BACKEND:",
  comparisonRoutes.map((item) => ({
    route_id: item.route_id,
    price_score: item.price_score,
    final_selling_price_usd: item.final_selling_price_usd,
  }))
);
      // -----------------------------------------------------
      // PRICING DETAILS
      // -----------------------------------------------------

      const pricingPairs = await Promise.all(
        available.map(async (route) => {
          try {
            const pricing =
              await calculatePricing({
                route_id: route.route_id,
                containers:
                  Number(formData.containers),
              });

            return [
              route.route_id,
              pricing,
            ];
          } catch (error) {
            console.error(
              `Pricing failed for ${route.route_id}:`,
              error
            );

            return [
              route.route_id,
              null,
            ];
          }
        })
      );

      const pricingMap =
        Object.fromEntries(
          pricingPairs.filter(
            ([, value]) => value
          )
        );

      // -----------------------------------------------------
      // WEATHER DETAILS
      // -----------------------------------------------------

      const weatherPairs = await Promise.all(
        available.map(async (route) => [
          route.route_id,
          await fetchWeather(
            route.route_id
          ),
        ])
      );

      const weatherMap =
        Object.fromEntries(
          weatherPairs.filter(
            ([, value]) => value
          )
        );

      // -----------------------------------------------------
      // ENRICH AVAILABLE ROUTES
      // INCLUDING CUSTOMS
      // -----------------------------------------------------

      const enrichedAvailable =
        available.map((route) => {
          const comparison =
            comparisonById[
              route.route_id
            ] || {};

          const pricing =
            pricingMap[
              route.route_id
            ] || {};

          const weather =
            weatherMap[
              route.route_id
            ] || {};

          return {
            ...route,

            cargo_type:
              formData.cargo_type,

            // Pricing
            final_selling_price_usd:
              Number(
                comparison.final_selling_price_usd ??
                  pricing.final_selling_price_usd ??
                  0
              ),

            // Weather
            weather_risk:
              comparison.weather_risk ??
              weather.risk_level ??
              weather.weather_risk ??
              "—",

            weather_condition:
              comparison.weather_condition ??
              weather.weather_condition ??
              "—",

            risk_points:
              comparison.risk_points ??
              weather.risk_points ??
              null,

            // -------------------------------------------------
            // CUSTOMS
            // -------------------------------------------------

            customs_id:
              comparison.customs_id ??
              null,

            customs_status:
              comparison.customs_status ??
              "—",

            customs_score:
              Number(
                comparison.customs_score ??
                  0
              ),

            hs_code_required:
              comparison.hs_code_required ??
              "—",

            commercial_invoice:
              comparison.commercial_invoice ??
              "—",

            packing_list:
              comparison.packing_list ??
              "—",

            certificate_of_origin:
              comparison.certificate_of_origin ??
              "—",

            restricted_cargo:
              comparison.restricted_cargo ??
              "—",

            missing_documents:
              Array.isArray(
                comparison.missing_documents
              )
                ? comparison.missing_documents
                : [],

            customs_recommendation:
              comparison.customs_recommendation ??
              "",
          };
        });

      const enrichedById =
        Object.fromEntries(
          enrichedAvailable.map((route) => [
            route.route_id,
            route,
          ])
        );

      // -----------------------------------------------------
      // TOP 3
      // Backend already filters Restricted routes.
      // -----------------------------------------------------

      const comparisonTop =
        Array.isArray(
          comparisonData?.top_routes
        )
          ? comparisonData.top_routes
          : [];

      const topSource =
        comparisonTop.length > 0
          ? comparisonTop
          : routeOnlyTop;

      const finalTopRoutes =
        topSource
          .slice(0, 3)
          .map((route) => {
            const enriched =
              enrichedById[
                route.route_id
              ] || {};

            return {
              ...enriched,
              ...route,

              cargo_type:
                formData.cargo_type,

              // Pricing
              final_selling_price_usd:
                Number(
                  route.final_selling_price_usd ??
                    enriched.final_selling_price_usd ??
                    0
                ),

              // Weather
              weather_risk:
                route.weather_risk ??
                enriched.weather_risk ??
                "—",

              weather_condition:
                route.weather_condition ??
                enriched.weather_condition ??
                "—",

              // Customs
              customs_id:
                route.customs_id ??
                enriched.customs_id ??
                null,

              customs_status:
                route.customs_status ??
                enriched.customs_status ??
                "—",

              customs_score:
                Number(
                  route.customs_score ??
                    enriched.customs_score ??
                    0
                ),

              hs_code_required:
                route.hs_code_required ??
                enriched.hs_code_required ??
                "—",

              commercial_invoice:
                route.commercial_invoice ??
                enriched.commercial_invoice ??
                "—",

              packing_list:
                route.packing_list ??
                enriched.packing_list ??
                "—",

              certificate_of_origin:
                route.certificate_of_origin ??
                enriched.certificate_of_origin ??
                "—",

              restricted_cargo:
                route.restricted_cargo ??
                enriched.restricted_cargo ??
                "—",

              missing_documents:
                Array.isArray(
                  route.missing_documents
                )
                  ? route.missing_documents
                  : Array.isArray(
                      enriched.missing_documents
                    )
                    ? enriched.missing_documents
                    : [],

              customs_recommendation:
                route.customs_recommendation ??
                enriched.customs_recommendation ??
                "",
            };
          });

      // -----------------------------------------------------
      // COMPARISON STATE
      // -----------------------------------------------------

      const nextComparison = {};

      enrichedAvailable.forEach((route) => {
        nextComparison[
          route.route_id
        ] = {
          ...(comparisonById[
            route.route_id
          ] || {}),

          route_id:
            route.route_id,

          final_selling_price_usd:
            route.final_selling_price_usd,

          weather_risk:
            route.weather_risk,

          weather_condition:
            route.weather_condition,

          // Customs
          customs_id:
            route.customs_id,

          customs_status:
            route.customs_status,

          customs_score:
            route.customs_score,

          hs_code_required:
            route.hs_code_required,

          commercial_invoice:
            route.commercial_invoice,

          packing_list:
            route.packing_list,

          certificate_of_origin:
            route.certificate_of_origin,

          restricted_cargo:
            route.restricted_cargo,

          missing_documents:
            route.missing_documents,

          customs_recommendation:
            route.customs_recommendation,
        };
      });

      setPricingResults(pricingMap);
      setWeatherResults(weatherMap);
      setComparisonResults(nextComparison);

      setRouteResults({
        ...result,
        ...comparisonData,

        available_routes:
          enrichedAvailable,

        top_routes:
          finalTopRoutes,

        recommended_route:
          comparisonData?.recommended_route ||
          finalTopRoutes[0] ||
          null,

        alternatives:
          comparisonData?.alternatives ||
          finalTopRoutes.slice(1),

        reason:
          comparisonData?.reason ||
          result?.reason ||
          "Route selected based on route, pricing, weather, and customs comparison.",
      });
    } catch (error) {
      console.error(
        "Route analysis error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to analyze the route at this moment. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // BUILD QUOTATION
  // Existing quotation functionality preserved
  // Customs fields added
  // =========================================================

  const buildQuotation = (
    route,
    pricing,
    comparison,
    weather
  ) => ({
    status: "success",

    origin: formData.origin,
    destination: formData.destination,
    cargo_type: formData.cargo_type,
    containers: Number(formData.containers),

    route_id: route.route_id,
    selected_route: route,

    // Route
    route_score: Number(
      route.route_score || 0
    ),

    transit_time_days: Number(
      route.transit_time_days ??
        route.transit_days ??
        0
    ),

    distance_nm: Number(
      route.distance_nm || 0
    ),

    transshipments: Number(
      route.transshipments || 0
    ),

    route_type:
      route.route_type,

    // Pricing
    base_freight_usd: Number(
      pricing?.base_freight_usd ??
        route.base_freight_usd ??
        0
    ),

    freight_per_container_usd: Number(
      pricing?.base_freight_usd ??
        route.base_freight_usd ??
        0
    ),

    total_base_freight_usd:
      Number(
        pricing?.base_freight_usd ??
          route.base_freight_usd ??
          0
      ) *
      Number(formData.containers),

    fuel_surcharge_usd: Number(
      pricing?.fuel_surcharge_usd || 0
    ),

    port_charge_usd: Number(
      pricing?.port_charge_usd || 0
    ),

    risk_surcharge_usd: Number(
      pricing?.risk_surcharge_usd || 0
    ),

    operating_cost_per_container_usd:
      Number(
        pricing?.operating_cost_per_container_usd ||
          0
      ),

    total_operational_cost_usd:
      Number(
        pricing?.total_operational_cost_usd ||
          0
      ),

    demand_factor: Number(
      pricing?.demand_factor || 1
    ),

    demand_adjusted_total_cost_usd:
      Number(
        pricing?.demand_adjusted_total_cost_usd ||
          0
      ),

    target_margin_percent:
      Number(
        pricing?.target_margin_percent || 0
      ),

    margin_amount_usd:
      Number(
        pricing?.margin_amount_usd || 0
      ),

    final_selling_price_usd:
      Number(
        pricing?.final_selling_price_usd ||
          comparison?.final_selling_price_usd ||
          0
      ),

    // Scores
    route_score: Number(
      comparison?.route_score ??
        route.route_score ??
        0
    ),

    price_score: Number(
      comparison?.price_score || 0
    ),

    weather_score: Number(
      comparison?.weather_score || 0
    ),

    customs_score: Number(
      comparison?.customs_score ??
        route.customs_score ??
        0
    ),

    final_score: Number(
      comparison?.final_score ||
        route.final_score ||
        0
    ),

    // Customs
    customs_id:
      comparison?.customs_id ??
      route.customs_id ??
      null,

    customs_status:
      comparison?.customs_status ??
      route.customs_status ??
      "—",

    hs_code_required:
      comparison?.hs_code_required ??
      route.hs_code_required ??
      "—",

    commercial_invoice:
      comparison?.commercial_invoice ??
      route.commercial_invoice ??
      "—",

    packing_list:
      comparison?.packing_list ??
      route.packing_list ??
      "—",

    certificate_of_origin:
      comparison?.certificate_of_origin ??
      route.certificate_of_origin ??
      "—",

    restricted_cargo:
      comparison?.restricted_cargo ??
      route.restricted_cargo ??
      "—",

    missing_documents:
      Array.isArray(
        comparison?.missing_documents
      )
        ? comparison.missing_documents
        : Array.isArray(
            route.missing_documents
          )
          ? route.missing_documents
          : [],

    customs_recommendation:
      comparison?.customs_recommendation ??
      route.customs_recommendation ??
      "",

    // Weather
    weather_condition:
      comparison?.weather_condition ||
      weather?.weather_condition ||
      "",

    weather_risk:
      comparison?.weather_risk ||
      weather?.risk_level ||
      "",

    risk_points: Number(
      comparison?.risk_points ??
        weather?.risk_points ??
        0
    ),

    wind_speed_knots: Number(
      weather?.wind_speed_knots || 0
    ),

    wave_height_m: Number(
      weather?.wave_height_m || 0
    ),

    visibility_km: Number(
      weather?.visibility_km || 0
    ),

    storm_probability_percent:
      Number(
        weather?.storm_probability ??
          weather?.storm_probability_percent ??
          0
      ),

    // Comparison data
    top_routes: topRoutes,
    available_routes: availableRoutes,

    recommended_route:
      routeResults?.recommended_route,

    alternatives:
      routeResults?.alternatives || [],

    reason:
      routeResults?.reason ||
      "Route selected based on route, pricing, weather, and customs comparison.",
  });

  // =========================================================
  // SAVE / REQUEST APPROVAL
  //
  // IMPORTANT:
  // Save Quotation and Request Approval use separate message
  // states. Request Approval performs an internal save without
  // displaying the normal "Quotation saved successfully."
  // message.
  // =========================================================

  const saveQuotationInternal = async (route) => {
    const routeId = route?.route_id;

    const pricing = pricingResults[routeId];
    const comparison = comparisonResults[routeId] || {};
    const weather = weatherResults[routeId] || {};

    if (!route || !pricing) {
      setErrorMessage(
        "Pricing information is not available for this route."
      );
      return null;
    }

    if (
      Number(
        pricing.final_selling_price_usd || 0
      ) <= 0
    ) {
      setErrorMessage(
        "Final selling price is not available for this route."
      );
      return null;
    }

    if (userLoading) {
      setErrorMessage(
        "Please wait while your account is being verified."
      );
      return null;
    }

    if (!currentUser?.id) {
      setErrorMessage(
        "Please login before saving the quotation."
      );
      return null;
    }

    // If this route is already saved, reuse its quotation ID.
    if (savedQuotationIds[routeId]) {
      return savedQuotationIds[routeId];
    }

    try {
      const result = await saveQuotation({
        user_id: Number(currentUser.id),
        quotation: buildQuotation(
          route,
          pricing,
          comparison,
          weather
        ),
      });

      if (
        result?.status === "success" ||
        result?.status === "already_saved"
      ) {
        const quotationId =
          result?.quotation_id ||
          result?.saved_quotation_id ||
          null;

        if (quotationId) {
          setSavedQuotationIds((previous) => ({
            ...previous,
            [routeId]: quotationId,
          }));
        }

        return quotationId;
      }

      setErrorMessage(
        result?.message ||
          "Unable to save quotation. Please try again."
      );

      return null;
    } catch (error) {
      console.error(
        "Save quotation error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to save quotation. Please try again."
      );

      return null;
    }
  };

  const handleSaveQuotation = async (route) => {
    if (quotationActionLockRef.current) {
      return;
    }

    quotationActionLockRef.current = true;

    const routeId = route?.route_id;

    setErrorMessage("");
    setSelectedRoute(route);

    // Clear both action messages first.
    // This guarantees that only the current action's message
    // can be visible.
    setSaveQuotationMessages({});
    setApprovalQuotationMessages({});

    setQuotationActionLoading(
      `save:${routeId}`
    );

    try {
      const alreadySaved =
        Boolean(savedQuotationIds[routeId]);

      const quotationId =
        await saveQuotationInternal(route);

      if (!quotationId) {
        return;
      }

      setSavedQuotationIds((previous) => ({
        ...previous,
        [routeId]: quotationId,
      }));

      setSaveQuotationMessages({
        [routeId]:
          alreadySaved
            ? "Quotation is already saved."
            : "Quotation saved successfully.",
      });
    } finally {
      setQuotationActionLoading("");
      quotationActionLockRef.current = false;
    }
  };

  const handleRequestApproval = async (route) => {
    if (quotationActionLockRef.current) {
      return;
    }

    quotationActionLockRef.current = true;

    const routeId = route?.route_id;

    setErrorMessage("");
    setSelectedRoute(route);

    // Remove any previous Save/Approval message immediately.
    setSaveQuotationMessages({});
    setApprovalQuotationMessages({});

    if (userLoading) {
      setErrorMessage(
        "Please wait while your account is being verified."
      );
      quotationActionLockRef.current = false;
      return;
    }

    if (!currentUser?.id) {
      setErrorMessage(
        "Please login before requesting approval."
      );
      quotationActionLockRef.current = false;
      return;
    }

    setQuotationActionLoading(
      `approval:${routeId}`
    );

    try {
      // Internal save:
      // IMPORTANT — this does NOT display
      // "Quotation saved successfully."
      let quotationId =
        savedQuotationIds[routeId];

      if (!quotationId) {
        quotationId =
          await saveQuotationInternal(route);
      }

      if (!quotationId) {
        return;
      }

      const result =
        await requestQuotationApproval(
          quotationId
        );

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "Unable to request quotation approval. Please try again."
        );
        return;
      }

      setSavedQuotationIds((previous) => ({
        ...previous,
        [routeId]: quotationId,
      }));

      // ONLY the approval message is shown.
      setApprovalQuotationMessages({
        [routeId]:
          "Quotation saved and submitted for admin approval successfully.",
      });
    } catch (error) {
      console.error(
        "Quotation approval request error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to request quotation approval. Please try again."
      );
    } finally {
      setQuotationActionLoading("");
      quotationActionLockRef.current = false;
    }
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const formatCurrency = (value) =>
    (Number(value) || 0).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );

  const availableRoutes = Array.isArray(
    routeResults?.available_routes
  )
    ? routeResults.available_routes
    : [];

  const topRoutes = Array.isArray(
    routeResults?.top_routes
  )
    ? routeResults.top_routes
    : [];

  const hasResults =
    availableRoutes.length > 0 ||
    topRoutes.length > 0;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="route-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="route-page-header">
        <div>
          <h1>New Route Search</h1>

          <p>
            Find the optimal maritime route based
            on transit time, distance, and
            transshipments.
          </p>
        </div>
      </div>

      {/* =====================================================
          SEARCH CARD
      ===================================================== */}

      <div className="route-search-card">

        <div className="route-form-grid">

          {/* ORIGIN */}

          <div className="route-form-group">
            <label>Origin</label>

            <select
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              disabled={
                routeOptionsLoading
              }
            >
              <option value="">
                {routeOptionsLoading
                  ? "Loading Origins..."
                  : "Select Origin"}
              </option>

              {origins.map(
                (origin) => (
                  <option
                    key={origin}
                    value={origin}
                  >
                    {origin}
                  </option>
                )
              )}
            </select>
          </div>

          {/* DESTINATION */}

          <div className="route-form-group">
            <label>
              Destination
            </label>

            <select
              name="destination"
              value={
                formData.destination
              }
              onChange={handleChange}
              disabled={
                !formData.origin
              }
            >
              <option value="">
                {!formData.origin
                  ? "Select Destination"
                  : destinations.length ===
                      0
                    ? "No Destinations Available"
                    : "Select Destination"}
              </option>

              {destinations.map(
                (destination) => (
                  <option
                    key={destination}
                    value={destination}
                  >
                    {destination}
                  </option>
                )
              )}
            </select>
          </div>

          {/* CARGO TYPE */}

          <div className="route-form-group">
            <label>
              Cargo Type
            </label>

            <select
              name="cargo_type"
              value={
                formData.cargo_type
              }
              onChange={handleChange}
              disabled={
                routeOptionsLoading ||
                cargoTypes.length === 0
              }
            >
              <option value="">
                {routeOptionsLoading
                  ? "Loading Cargo Types..."
                  : cargoTypes.length ===
                      0
                    ? "No Cargo Types Available"
                    : "Select Cargo Type"}
              </option>

              {cargoTypes.map(
                (cargoType) => (
                  <option
                    key={cargoType}
                    value={cargoType}
                  >
                    {cargoType}
                  </option>
                )
              )}
            </select>
          </div>

          {/* CONTAINERS */}

          <div className="route-form-group">
            <label>
              Container Quantity
            </label>

            <div className="container-quantity-control">

              <button
                type="button"
                onClick={
                  decreaseContainers
                }
              >
                −
              </button>

              <span>
                {formData.containers}
              </span>

              <button
                type="button"
                onClick={
                  increaseContainers
                }
              >
                +
              </button>

            </div>
          </div>

        </div>

        {errorMessage && (
          <div className="route-error-message">
            {errorMessage}
          </div>
        )}

        <button
          className="analyze-route-button"
          onClick={
            handleAnalyzeRoute
          }
          disabled={loading}
        >
          {loading
            ? "Analyzing Route, Price, Weather & Customs..."
            : "Analyze Route"}
        </button>

      </div>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      {hasResults && (
        <div className="route-results-section">

          {/* =================================================
              AVAILABLE ROUTES
          ================================================= */}

          <div className="available-routes-section">

            <div className="available-routes-header">
              <div>
                <h2>
                  Available Routes
                </h2>

                <p>
                  {availableRoutes.length}{" "}
                  routes available from{" "}
                  <strong>
                    {formData.origin}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formData.destination}
                  </strong>
                </p>
              </div>
            </div>

            <div className="available-routes-list">

              {availableRoutes.map(
                (route, index) => {
                  const pricing =
                    pricingResults[
                      route.route_id
                    ] || {};

                  const comparison =
                    comparisonResults[
                      route.route_id
                    ] || {};

                  const customsStatus =
                    route.customs_status ??
                    comparison.customs_status ??
                    "—";

                  return (
                    <div
                      className="available-route-row"
                      key={
                        route.route_id ||
                        index
                      }
                    >

                      <div className="available-route-main">

                        <div className="available-route-id">
                          <span>
                            Route ID
                          </span>

                          <strong>
                            {
                              route.route_id
                            }
                          </strong>
                        </div>

                        <div className="available-route-path">

                          <strong>
                            {route.origin}
                          </strong>

                          <span>
                            →
                          </span>

                          <strong>
                            {
                              route.destination
                            }
                          </strong>

                          <small>
                            {
                              route.route_type
                            }
                          </small>

                        </div>

                      </div>

                      <div className="available-route-info">

                        <div>
                          <span>
                            Cargo Type
                          </span>

                          <strong>
                            {
                              formData.cargo_type
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Distance
                          </span>

                          <strong>
                            {Number(
                              route.distance_nm ||
                                0
                            ).toLocaleString()}{" "}
                            NM
                          </strong>
                        </div>

                        <div>
                          <span>
                            Transit
                          </span>

                          <strong>
                            {route.transit_time_days ??
                              route.transit_days ??
                              0}{" "}
                            days
                          </strong>
                        </div>

                        <div>
                          <span>
                            Transshipments
                          </span>

                          <strong>
                            {
                              route.transshipments ??
                              0
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Selling Price
                          </span>

                          <strong>
                            {Number(
                              route.final_selling_price_usd ??
                                pricing.final_selling_price_usd ??
                                0
                            ) > 0
                              ? `$${formatCurrency(
                                  route.final_selling_price_usd ??
                                    pricing.final_selling_price_usd
                                )}`
                              : "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Weather Risk
                          </span>

                          <strong
                            className={`weather-risk-text ${String(
                              route.weather_risk ??
                                comparison.weather_risk ??
                                ""
                            ).toLowerCase()}`}
                          >
                            {route.weather_risk ??
                              comparison.weather_risk ??
                              "—"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Weather Condition
                          </span>

                          <strong>
                            {route.weather_condition ??
                              comparison.weather_condition ??
                              "—"}
                          </strong>
                        </div>

                        {/* CUSTOMS STATUS */}

                        <div>
                          <span>
                            Customs Status
                          </span>

                          <strong
                            className={`customs-status-text ${String(
                              customsStatus
                            ).toLowerCase()}`}
                          >
                            {customsStatus}
                          </strong>
                        </div>

                        <div className="available-route-score">

                          <span>
                            Route Score
                          </span>

                          <strong>
                            {Number(
                              route.route_score ||
                                0
                            ).toFixed(2)}
                          </strong>

                        </div>

                      </div>
                    </div>
                  );
                }
              )}

            </div>
          </div>

          {/* =================================================
              TOP 3
          ================================================= */}

          {topRoutes.length > 0 && (
            <div className="top-routes-section">

              <div className="top-routes-heading">

                <div>
                  <h2>
                    Top 3 Best Routes
                  </h2>

                  <p>
                    Routes ranked using
                    route, price, weather,
                    and customs comparison.
                  </p>
                </div>

                <span className="top-routes-count">
                  {Math.min(
                    topRoutes.length,
                    3
                  )}{" "}
                  Best Routes
                </span>

              </div>

              <div className="top-routes-container">

                {topRoutes
                  .slice(0, 3)
                  .map(
                    (
                      route,
                      index
                    ) => {

                      const rank =
                        Number(
                          route.rank
                        ) ||
                        index + 1;

                      const isRecommended =
                        index === 0;

                      const pricing =
                        pricingResults[
                          route.route_id
                        ] || {};

                      const weather =
                        weatherResults[
                          route.route_id
                        ] || {};

                      const comparison =
                        comparisonResults[
                          route.route_id
                        ] || {};

                      const isThisMapOpen =
                        mapOpen &&
                        mapRoute?.route_id ===
                          route.route_id;

                      const saveMessage =
                        saveQuotationMessages[
                          route.route_id
                        ];

                      const approvalMessage =
                        approvalQuotationMessages[
                          route.route_id
                        ];

                      const quotationMessage =
                        approvalMessage ||
                        saveMessage;

                      const saveLoading =
                        quotationActionLoading ===
                        `save:${route.route_id}`;

                      const approvalLoading =
                        quotationActionLoading ===
                        `approval:${route.route_id}`;

                      const customsStatus =
                        route.customs_status ??
                        comparison.customs_status ??
                        "—";



                      return (
                        <div
                          key={
                            route.route_id ||
                            `${route.origin}-${route.destination}-${index}`
                          }
                          className={
                            isRecommended
                              ? "top-route-card recommended-route-card"
                              : "top-route-card alternative-route-card"
                          }
                        >

                          {/* =================================
                              ROUTE HEADER
                          ================================= */}

                          <div className="top-route-header">

                            <div>

                              <span
                                className={
                                  isRecommended
                                    ? "route-badge recommended-badge"
                                    : "route-badge alternative-badge"
                                }
                              >
                                {isRecommended
                                  ? "Recommended Route"
                                  : `Alternative Route ${rank}`}
                              </span>

                              <h3 className="top-route-name">

                                {route.origin}

                                <span>
                                  →
                                </span>

                                {
                                  route.destination
                                }

                                <small>
                                  {
                                    route.route_type
                                  }
                                </small>

                              </h3>

                            </div>

                            {/* OVERALL SCORE */}

                            <div className="route-score-box">

                              <span>
                                Overall Score
                              </span>

                              <strong>
                                {Number(
                                  route.final_score ||
                                    comparison.final_score ||
                                    0
                                ).toFixed(2)}
                                /100
                              </strong>

                            </div>

                          </div>

                          {isRecommended && (
                            <div className="recommended-text">
                              Recommended route selected from the combined route, price, weather, and customs analysis.
                            </div>
                          )}

                          {/* =================================
                              ROUTE DETAILS
                          ================================= */}

                          <div className="top-route-details">

                            <div className="route-detail-item">
                              <span>
                                Route ID
                              </span>

                              <strong>
                                {
                                  route.route_id
                                }
                              </strong>
                            </div>

                            <div className="route-detail-item">
                              <span>
                                Cargo Type
                              </span>

                              <strong>
                                {
                                  formData.cargo_type
                                }
                              </strong>
                            </div>

                            <div className="route-detail-item">
                              <span>
                                Distance
                              </span>

                              <strong>
                                {Number(
                                  route.distance_nm ||
                                    0
                                ).toLocaleString()}{" "}
                                NM
                              </strong>
                            </div>

                            <div className="route-detail-item">
                              <span>
                                Transit Time
                              </span>

                              <strong>
                                {route.transit_time_days ??
                                  route.transit_days ??
                                  0}{" "}
                                days
                              </strong>
                            </div>

                            <div className="route-detail-item">
                              <span>
                                Transshipments
                              </span>

                              <strong>
                                {
                                  route.transshipments ??
                                  0
                                }
                              </strong>
                            </div>

                          </div>

                          {/* =================================
                              MAP
                              EXISTING FUNCTIONALITY
                          ================================= */}

                          <div className="route-map-action-row">

                            <button
                              type="button"
                              className="view-mapping-button"
                              onClick={() => {
                                if (
                                  isThisMapOpen
                                ) {
                                  setMapOpen(
                                    false
                                  );

                                  setMapRoute(
                                    null
                                  );
                                } else {
                                  setMapRoute(
                                    route
                                  );

                                  setMapOpen(
                                    true
                                  );
                                }
                              }}
                              aria-expanded={
                                isThisMapOpen
                              }
                            >
                              <span aria-hidden="true">
                                ⌖
                              </span>

                              {isThisMapOpen
                                ? "Hide Mapping"
                                : "View Mapping"}
                            </button>

                          </div>

                          {isThisMapOpen && (
                            <RouteWorldMap
                              key={`map-${route.route_id}`}
                              route={
                                mapRoute
                              }
                              onClose={() => {
                                setMapOpen(
                                  false
                                );

                                setMapRoute(
                                  null
                                );
                              }}
                            />
                          )}

                          {/* =================================
                              THREE FACTOR CARDS
                          ================================= */}

                          <div className="route-factor-cards">

                            {/* ---------------------------------
                                PRICE CARD
                            --------------------------------- */}

                            <div className="price-analysis-card">

                              <div className="analysis-card-header">
                                <span>
                                  PRICING
                                </span>

                                <h3>
                                  Price Breakdown
                                </h3>
                              </div>

                              <div className="pricing-charge-list">

                                <div className="pricing-charge-item">
                                  <span>
                                    Base Cost
                                  </span>

                                  <strong>
                                    $
                                    {formatCurrency(
                                      pricing.base_freight_usd ??
                                        route.base_freight_usd
                                    )}
                                  </strong>
                                </div>

                                <div className="pricing-charge-item">
                                  <span>
                                    Fuel Charge
                                  </span>

                                  <strong>
                                    $
                                    {formatCurrency(
                                      pricing.fuel_surcharge_usd
                                    )}
                                  </strong>
                                </div>

                                <div className="pricing-charge-item">
                                  <span>
                                    Port Charge
                                  </span>

                                  <strong>
                                    $
                                    {formatCurrency(
                                      pricing.port_charge_usd
                                    )}
                                  </strong>
                                </div>

                                <div className="pricing-charge-item">
                                  <span>
                                    Risk Surcharge
                                  </span>

                                  <strong>
                                    $
                                    {formatCurrency(
                                      pricing.risk_surcharge_usd
                                    )}
                                  </strong>
                                </div>

                                <div className="pricing-charge-item other-charges-item">
                                  <span>
                                    Other Charges
                                  </span>

                                  <strong>
                                    Other Charges
                                  </strong>
                                </div>

                              </div>

                              <div className="final-selling-price-box">

                                <span>
                                  Total Selling Price
                                </span>

                                <strong>
                                  $
                                  {formatCurrency(
                                    pricing.final_selling_price_usd ??
                                      route.final_selling_price_usd
                                  )}
                                </strong>

                              </div>

                            </div>

                            {/* ---------------------------------
                                WEATHER CARD
                            --------------------------------- */}

                            <div className="weather-analysis-card">

                              <div className="analysis-card-header">

                                <span>
                                  WEATHER
                                </span>

                                <h3>
                                  Weather Assessment
                                </h3>

                              </div>

                              <div className="weather-analysis-details">

                                <div>
                                  <span>
                                    Wind Speed
                                  </span>

                                  <strong>
                                    {weather.wind_speed_knots ??
                                      "—"}{" "}
                                    knots
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Wave Height
                                  </span>

                                  <strong>
                                    {weather.wave_height_m ??
                                      "—"}{" "}
                                    m
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Visibility
                                  </span>

                                  <strong>
                                    {weather.visibility_km ??
                                      "—"}{" "}
                                    km
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Storm Probability
                                  </span>

                                  <strong>
                                    {weather.storm_probability_percent ??
                                      weather.storm_probability ??
                                      "—"}%
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Weather Condition
                                  </span>

                                  <strong>
                                    {weather.weather_condition ??
                                      comparison.weather_condition ??
                                      route.weather_condition ??
                                      "—"}
                                  </strong>
                                </div>

                              </div>

                              <div
                                className={`weather-risk-box ${String(
                                  comparison.weather_risk ??
                                    route.weather_risk ??
                                    ""
                                ).toLowerCase()}`}
                              >
                                <span>
                                  Weather Risk
                                </span>

                                <strong>
                                  {comparison.weather_risk ??
                                    route.weather_risk ??
                                    "—"}
                                </strong>
                              </div>

                            </div>

                            {/* ---------------------------------
                                CUSTOMS CARD
                            --------------------------------- */}

                            <div className="customs-analysis-card">

                              <div className="analysis-card-header">

                                <span>
                                  CUSTOMS
                                </span>

                                <h3>
                                  Customs Compliance
                                </h3>

                              </div>

                              <div className="customs-analysis-details">

                                <div>
                                  <span>
                                    Customs ID
                                  </span>

                                  <strong>
                                    {route.customs_id ??
                                      comparison.customs_id ??
                                      "—"}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    HS Code
                                  </span>

                                  <strong>
                                    {route.hs_code_required ??
                                      comparison.hs_code_required ??
                                      "—"}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Commercial Invoice
                                  </span>

                                  <strong>
                                    {route.commercial_invoice ??
                                      comparison.commercial_invoice ??
                                      "—"}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Packing List
                                  </span>

                                  <strong>
                                    {route.packing_list ??
                                      comparison.packing_list ??
                                      "—"}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Certificate of Origin
                                  </span>

                                  <strong>
                                    {route.certificate_of_origin ??
                                      comparison.certificate_of_origin ??
                                      "—"}
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Restricted Cargo
                                  </span>

                                  <strong>
                                    {route.restricted_cargo ??
                                      comparison.restricted_cargo ??
                                      "—"}
                                  </strong>
                                </div>

                              </div>

                              <div
                                className={`customs-status-box ${String(
                                  customsStatus
                                ).toLowerCase()}`}
                              >

                                <span>
                                  Customs Status
                                </span>

                                <strong>
                                  {customsStatus}
                                </strong>

                              </div>

                            </div>

                          </div>

                          {/* =================================
                              WHY THIS ROUTE IS BEST
                          ================================= */}

                          <div className="why-best-section">

                            <button
                              type="button"
                              className="why-best-button"
                              onClick={() =>
                                setWhyBestOpenRoute(
                                  whyBestOpenRoute ===
                                    route.route_id
                                    ? null
                                    : route.route_id
                                )
                              }
                            >
                              Why is this route best?

                              <span>
                                {whyBestOpenRoute ===
                                route.route_id
                                  ? " ▲"
                                  : " ▼"}
                              </span>
                            </button>

                            {whyBestOpenRoute ===
                              route.route_id && (
                              <div className="score-comparison-section">

                                {/* 25% WEIGHT SUMMARY */}

                                <div className="score-weight-summary">

                                  <span>
                                    Route
                                    <strong>
                                      25%
                                    </strong>
                                  </span>

                                  <span>
                                    Pricing
                                    <strong>
                                      25%
                                    </strong>
                                  </span>

                                  <span>
                                    Weather
                                    <strong>
                                      25%
                                    </strong>
                                  </span>

                                  <span>
                                    Customs
                                    <strong>
                                      25%
                                    </strong>
                                  </span>

                                </div>

                                {/* SCORE BARS */}

                                {[
                                  [
                                    "Route Score",
                                    "route_score",
                                    "route-score-fill",
                                  ],

                                  [
                                    "Price Score",
                                    "price_score",
                                    "price-score-fill",
                                  ],

                                  [
                                    "Weather Score",
                                    "weather_score",
                                    "weather-score-fill",
                                  ],

                                  [
                                    "Customs Score",
                                    "customs_score",
                                    "customs-score-fill",
                                  ],

                                  [
                                    "Overall Score",
                                    "final_score",
                                    "final-score-fill",
                                  ],
                                ].map(
                                  ([
                                    label,
                                    key,
                                    fillClass,
                                  ]) => {

                                    const value =
                                      Number(
                                        comparison[
                                          key
                                        ] ??
                                          route[
                                            key
                                          ] ??
                                          0
                                      );

                                    return (
                                      <div
                                        className="score-bar-card"
                                        key={key}
                                      >

                                        <div className="score-bar-header">

                                          <span>
                                            {
                                              label
                                            }
                                          </span>

                                          <strong>
                                            {value.toFixed(
                                              2
                                            )}
                                            /100
                                          </strong>

                                        </div>

                                        <div className="score-bar-track">

                                          <div
                                            className={`score-bar-fill ${fillClass}`}
                                            style={{
                                              width: `${Math.max(
                                                0,
                                                Math.min(
                                                  100,
                                                  value
                                                )
                                              )}%`,
                                            }}
                                          />

                                        </div>

                                      </div>
                                    );
                                  }
                                )}

                              </div>
                            )}

                          </div>

                          {/* =================================
                              SAVE / APPROVAL
                              EXISTING FUNCTIONALITY
                          ================================= */}

                          <div className="selected-quotation-actions">

                            <button
                              type="button"
                              className="save-quotation-button"
                              onClick={() =>
                                handleSaveQuotation(
                                  route
                                )
                              }
                              disabled={
                                quotationActionLoading !==
                                ""
                              }
                            >
                              {saveLoading
                                ? "Saving..."
                                : "Save Quotation"}
                            </button>

                            <button
                              type="button"
                              className="request-approval-button"
                              onClick={() =>
                                handleRequestApproval(
                                  route
                                )
                              }
                              disabled={
                                quotationActionLoading !==
                                ""
                              }
                            >
                              {approvalLoading
                                ? "Submitting..."
                                : "Request Approval"}
                            </button>

                          </div>

                          {quotationMessage && (
                            <div className="saved-quotation-message">
                              {quotationMessage}
                            </div>
                          )}

                        </div>
                      );
                    }
                  )}

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default Route;