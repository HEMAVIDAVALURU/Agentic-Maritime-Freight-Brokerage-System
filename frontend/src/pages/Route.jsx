import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  Pane as MapPane,
} from "react-leaflet";

import L from "leaflet";
import {
  seaRouteMulti,
} from "searoute-ts";

import {
  analyzeRoute,
  calculatePricing,
  saveQuotation,
  requestQuotationApproval,
} from "../services/quotationApi";

import "leaflet/dist/leaflet.css";
import "./Route.css";


// =========================================================
// LEAFLET MARKER ICON FIX
// =========================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",

  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",

  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


// =========================================================
// MAP AUTO FIT
// =========================================================

function MapAutoFit({ route }) {

  const map = useMap();

  useEffect(() => {

    if (!route) {
      return;
    }

    const routePath = buildSeaRoutePath(route);

    if (routePath.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(routePath);

    map.fitBounds(
      bounds,
      {
        padding: [35, 35],
        maxZoom: 5,
      }
    );

  }, [map, route]);

  return null;
}

// =========================================================
// VALID COORDINATE CHECK
// =========================================================

function isValidCoordinate(lat, lng) {

  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}


// =========================================================
// ROUTE PORT POINTS
//
// transshipments = 0
// Origin → Destination
//
// transshipments = 1
// Origin → Transshipment 1 → Destination
//
// transshipments = 2
// Origin → Transshipment 1 → Transshipment 2 → Destination
// =========================================================

function getRoutePortPoints(route) {
  if (!route) return [];

  const points = [];

  if (isValidCoordinate(route.origin_lat, route.origin_lng)) {
    points.push([
      Number(route.origin_lat),
      Number(route.origin_lng),
    ]);
  }

  const transshipments = Number(route.transshipments || 0);

  if (
    transshipments >= 1 &&
    isValidCoordinate(
      route.transshipment_1_lat,
      route.transshipment_1_lng
    )
  ) {
    points.push([
      Number(route.transshipment_1_lat),
      Number(route.transshipment_1_lng),
    ]);
  }

  if (
    transshipments >= 2 &&
    isValidCoordinate(
      route.transshipment_2_lat,
      route.transshipment_2_lng
    )
  ) {
    points.push([
      Number(route.transshipment_2_lat),
      Number(route.transshipment_2_lng),
    ]);
  }

  if (isValidCoordinate(route.destination_lat, route.destination_lng)) {
    points.push([
      Number(route.destination_lat),
      Number(route.destination_lng),
    ]);
  }

  return points;
}


// =========================================================
// SEA ROUTE BUILDER
//
// IMPORTANT:
// We do NOT draw a straight line between ports.
// Searoute uses a maritime network to calculate a
// sea-only visualization path. Each transshipment is
// treated as a mandatory waypoint for that route.
// =========================================================

function toGeoJsonPoint(latLng) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [
        Number(latLng[1]),
        Number(latLng[0]),
      ],
    },
  };
}

function sameCoordinate(a, b) {
  if (!a || !b) return false;

  return (
    Math.abs(Number(a[0]) - Number(b[0])) < 0.00001 &&
    Math.abs(Number(a[1]) - Number(b[1])) < 0.00001
  );
}

function getSeaFeatureCoordinates(feature) {
  const geometry = feature?.geometry;

  if (!geometry) return [];

  if (geometry.type === "LineString") {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
  }

  if (geometry.type === "MultiLineString") {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flat()
      : [];
  }

  return [];
}

function convertSeaFeatureToLeafletPath(feature) {
  return getSeaFeatureCoordinates(feature)
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        return null;
      }

      const lng = Number(coordinate[0]);
      const lat = Number(coordinate[1]);

      return isValidCoordinate(lat, lng)
        ? [lat, lng]
        : null;
    })
    .filter(Boolean);
}

function buildSeaRoutePath(route) {
  const portPoints = getRoutePortPoints(route);

  if (portPoints.length < 2) {
    return [];
  }

  try {
    const waypoints = portPoints.map((point) => [
      Number(point[1]),
      Number(point[0]),
    ]);

    const feature = seaRouteMulti(
      waypoints,
      {
        appendOriginDestination: true,
        antimeridian: "unwrap",
      }
    );

    const seaPath = convertSeaFeatureToLeafletPath(feature);

    if (seaPath.length < 2) {
      return [];
    }

    return seaPath;
  } catch (error) {
    console.error(
      `Sea route calculation failed for ${route?.route_id || "unknown route"}:`,
      error
    );

    return [];
  }
}


// =========================================================
// GET ORIGIN / DESTINATION MARKER DATA
// =========================================================

function getMarkerPosition(route, type) {
  if (!route) {
    return null;
  }

  if (type === "origin" &&
      isValidCoordinate(route.origin_lat, route.origin_lng)) {
    return [
      Number(route.origin_lat),
      Number(route.origin_lng),
    ];
  }

  if (type === "destination" &&
      isValidCoordinate(route.destination_lat, route.destination_lng)) {
    return [
      Number(route.destination_lat),
      Number(route.destination_lng),
    ];
  }

  return null;
}


// =========================================================
// ROUTE MAP
//
// ONE MAP ONLY
// THREE ROUTE LINES
// =========================================================

function RouteWorldMap({ route }) {

  if (!route) {
    return null;
  }

  const originPosition = getMarkerPosition(
    route,
    "origin"
  );

  const destinationPosition = getMarkerPosition(
    route,
    "destination"
  );

  let mapCenter = [20, 0];

  if (originPosition && destinationPosition) {
    mapCenter = [
      (originPosition[0] + destinationPosition[0]) / 2,
      (originPosition[1] + destinationPosition[1]) / 2,
    ];
  } else if (originPosition) {
    mapCenter = originPosition;
  } else if (destinationPosition) {
    mapCenter = destinationPosition;
  }

  return (
    <div className="route-map-section">
      <div className="route-map-header">
        <div>
          <h2>World Route Map</h2>
          <p>
            Best maritime route from {" "}
            <strong>{route.origin}</strong>{" "}
            to {" "}
            <strong>{route.destination}</strong>
            {" "}• Route ID: {" "}
            <strong>{route.route_id}</strong>
          </p>
        </div>

        <div className="route-map-legend">
          <div className="route-map-legend-item">
            <span className="route-map-legend-line recommended"></span>
            <span>Best Route</span>
          </div>
        </div>
      </div>

      <div className="route-map-container">
        <MapContainer
          center={mapCenter}
          zoom={3}
          scrollWheelZoom={true}
          worldCopyJump={false}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1}
          className="route-world-map"
        >
          <TileLayer
            attribution="&copy; Esri, TomTom, Garmin, FAO, NOAA, USGS"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />

          <MapAutoFit route={route} />

          {/* ONLY THE FIRST / BEST ROUTE IS DRAWN */}
          {(() => {
            const routePath = buildSeaRoutePath(route);

            if (routePath.length < 2) {
              return null;
            }

            return (
              <Polyline
                key={`map-best-route-${route.route_id}`}
                positions={routePath}
                pathOptions={{
                  color: "#2563eb",
                  weight: 6,
                  opacity: 1,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              >
                <Tooltip sticky>
                  {`Route ID: ${route.route_id}`}
                </Tooltip>
              </Polyline>
            );
          })()}

          {originPosition && (
            <Marker position={originPosition}>
              <Tooltip>
                {`Origin: ${route.origin}`}
              </Tooltip>
            </Marker>
          )}

          {destinationPosition && (
            <Marker position={destinationPosition}>
              <Tooltip>
                {`Destination: ${route.destination}`}
              </Tooltip>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

// =========================================================
// MAIN ROUTE COMPONENT
// =========================================================

function Route() {

  // =======================================================
  // ROUTE OPTIONS
  // =======================================================

  const [routeOptions, setRouteOptions] =
    useState({
      origins: [],
      destinations_by_origin: {},
    });

  const [routeOptionsLoading, setRouteOptionsLoading] =
    useState(true);


  // =======================================================
  // CARGO TYPES
  // =======================================================

  const cargoTypes = [
    "Electronics",
    "Automotive",
    "Machinery & Equipment",
    "General Cargo",
  ];


  // =======================================================
  // CURRENT USER
  // =======================================================

  const [currentUser, setCurrentUser] =
    useState(null);

  const [userLoading, setUserLoading] =
    useState(true);


  // =======================================================
  // LOAD CURRENT USER
  // =======================================================

  useEffect(() => {

    const loadCurrentUser =
      async () => {

        try {

          setUserLoading(true);

          const response =
            await fetch(
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

          const data =
            await response.json();

          if (
            data.success &&
            data.user
          ) {

            setCurrentUser(
              data.user
            );

          } else {

            setCurrentUser(null);

          }

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


  // =======================================================
  // LOAD ROUTE OPTIONS
  // =======================================================

  useEffect(() => {

    const loadRouteOptions =
      async () => {

        try {

          setRouteOptionsLoading(true);

          const response =
            await fetch(
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

          const data =
            await response.json();

          console.log(
            "ROUTE OPTIONS:",
            data
          );

          if (
            data.status ===
            "success"
          ) {

            setRouteOptions({

              origins:
                Array.isArray(
                  data.origins
                )
                  ? data.origins
                  : [],

              destinations_by_origin:
                data.destinations_by_origin ||
                {},

            });

          } else {

            setRouteOptions({
              origins: [],
              destinations_by_origin: {},
            });

          }

        } catch (error) {

          console.error(
            "Unable to load route options:",
            error
          );

          setRouteOptions({
            origins: [],
            destinations_by_origin: {},
          });

        } finally {

          setRouteOptionsLoading(
            false
          );

        }

      };

    loadRouteOptions();

  }, []);


  // =======================================================
  // FORM STATE
  // =======================================================

  const [formData, setFormData] =
    useState({
      origin: "",
      destination: "",
      cargo_type: "",
      containers: 1,
    });


  // =======================================================
  // ORIGINS
  // =======================================================

  const origins =
    Array.isArray(
      routeOptions.origins
    )
      ? routeOptions.origins
      : [];


  // =======================================================
  // DESTINATIONS
  //
  // IMPORTANT:
  // Destination is taken directly from
  // destinations_by_origin.
  // =======================================================

  const destinations = (() => {
    if (!formData.origin) {
      return [];
    }

    const destinationMap =
      routeOptions.destinations_by_origin || {};

    if (Array.isArray(destinationMap[formData.origin])) {
      return destinationMap[formData.origin];
    }

    const matchingKey = Object.keys(destinationMap).find(
      (key) =>
        String(key).trim().toLowerCase() ===
        String(formData.origin).trim().toLowerCase()
    );

    return matchingKey &&
      Array.isArray(destinationMap[matchingKey])
      ? destinationMap[matchingKey]
      : [];
  })();


  // =======================================================
  // UI STATES
  // =======================================================

  const [routeResults, setRouteResults] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [pricingResults, setPricingResults] =
    useState({});

  // Keep the latest successful pricing response separately so the
  // quotation result cannot disappear because of object-key/state timing.
  const [activePricingResult, setActivePricingResult] =
    useState(null);

  const [selectedRoute, setSelectedRoute] =
    useState(null);

  const [savedQuotationId, setSavedQuotationId] =
    useState(null);

  const [quotationActionLoading, setQuotationActionLoading] =
    useState("");

  const [pricingLoadingRoute, setPricingLoadingRoute] =
    useState(null);

  const [savedQuotationMessage, setSavedQuotationMessage] =
    useState("");


  // =======================================================
  // FORM CHANGE
  // =======================================================

  const handleChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;

      setFormData(
        (previous) => ({

          ...previous,

          [name]: value,

          ...(name === "origin"
            ? {
                destination: "",
              }
            : {}),

        })
      );

      setErrorMessage("");

      setSavedQuotationMessage("");

      setSelectedRoute(null);

      setSavedQuotationId(null);

      setQuotationActionLoading("");

      setPricingResults({});
      setActivePricingResult(null);

    };


  // =======================================================
  // DECREASE CONTAINERS
  // =======================================================

  const decreaseContainers =
    () => {

      setFormData(
        (previous) => ({

          ...previous,

          containers:
            Math.max(
              1,
              Number(
                previous.containers
              ) - 1
            ),

        })
      );

      setSavedQuotationMessage("");

      setSelectedRoute(null);

      setSavedQuotationId(null);

      setQuotationActionLoading("");

      setPricingResults({});
      setActivePricingResult(null);

    };


  // =======================================================
  // INCREASE CONTAINERS
  // =======================================================

  const increaseContainers =
    () => {

      setFormData(
        (previous) => ({

          ...previous,

          containers:
            Number(
              previous.containers
            ) + 1,

        })
      );

      setSavedQuotationMessage("");

      setSelectedRoute(null);

      setSavedQuotationId(null);

      setQuotationActionLoading("");

      setPricingResults({});
      setActivePricingResult(null);

    };


  // =======================================================
  // ANALYZE ROUTE
  // =======================================================

  const handleAnalyzeRoute =
    async () => {

      setErrorMessage("");

      setSavedQuotationMessage("");

      setSelectedRoute(null);

      setSavedQuotationId(null);

      setQuotationActionLoading("");

      setPricingResults({});
      setActivePricingResult(null);

      setRouteResults(null);


      if (!formData.origin) {

        setErrorMessage(
          "Please select an origin."
        );

        return;

      }


      if (!formData.destination) {

        setErrorMessage(
          "Please select a destination."
        );

        return;

      }


      if (
        formData.origin
          .trim()
          .toLowerCase() ===
        formData.destination
          .trim()
          .toLowerCase()
      ) {

        setErrorMessage(
          "Origin and destination cannot be the same."
        );

        return;

      }


      if (!formData.cargo_type) {

        setErrorMessage(
          "Please select a cargo type."
        );

        return;

      }


      if (
        !formData.containers ||
        Number(
          formData.containers
        ) <= 0
      ) {

        setErrorMessage(
          "Container quantity must be greater than 0."
        );

        return;

      }


      setLoading(true);

      try {

        const result =
          await analyzeRoute({

            origin:
              formData.origin.trim(),

            destination:
              formData.destination.trim(),

            cargo_type:
              formData.cargo_type.trim(),

            containers:
              Number(
                formData.containers
              ),

          });


        console.log(
          "ROUTE ANALYSIS RESULT:",
          result
        );


        setRouteResults(
          result
        );


        const available =
          Array.isArray(
            result.available_routes
          )
            ? result.available_routes
            : [];


        const top =
          Array.isArray(
            result.top_routes
          )
            ? result.top_routes
            : [];


        if (
          result.status ===
            "not_found" ||
          (
            available.length === 0 &&
            top.length === 0
          )
        ) {

          setErrorMessage(
            result.message ||
            "No results found."
          );

          return;

        }

      } catch (error) {

        console.error(
          "Route analysis error:",
          error
        );

        setErrorMessage(
          "Unable to fetch the route at this moment. Try again."
        );

      } finally {

        setLoading(false);

      }

    };


  // =======================================================
  // CALCULATE PRICE
  // =======================================================

  const handleCalculatePrice =
    async (route) => {

      const routeId =
        route.route_id;

      setPricingLoadingRoute(
        routeId
      );

      setQuotationActionLoading("");

      setErrorMessage("");

      setSavedQuotationMessage("");

      setSavedQuotationId(null);

      setSelectedRoute(route);

      setPricingResults({});
      setActivePricingResult(null);


      try {

        const result =
          await calculatePricing({

            route_id:
              routeId,

            containers:
              Number(
                formData.containers
              ),

          });


        if (
          !result ||
          result.status !==
            "success"
        ) {

          setSelectedRoute(null);

          setErrorMessage(
            result?.message ||
            "Unable to calculate price."
          );

          return;

        }


        setPricingResults({

          [routeId]:
            result,

        });

        // This is the pricing response that must remain visible
        // immediately after Calculate Price succeeds.
        setActivePricingResult(result);


        try {

          await fetch(
            "http://localhost:8000/api/activities/log",
            {

              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials:
                "include",

              body:
                JSON.stringify({

                  activity_type:
                    "pricing_analysis",

                  description:
                    `Price calculated for route ${routeId} with ${Number(formData.containers)} containers.`,

                }),

            }
          );

        } catch (
          activityError
        ) {

          console.error(
            "Price activity logging error:",
            activityError
          );

        }

      } catch (error) {

        console.error(
          "Pricing calculation error:",
          error
        );

        setSelectedRoute(null);

        setErrorMessage(
          "Unable to calculate price. Please try again."
        );

      } finally {

        setPricingLoadingRoute(
          null
        );

      }

    };


  // =======================================================
  // BUILD QUOTATION
  // =======================================================

  const buildQuotation =
    (
      route,
      pricing
    ) => {

      return {

        status:
          "success",

        origin:
          formData.origin,

        destination:
          formData.destination,

        cargo_type:
          formData.cargo_type,

        containers:
          Number(
            formData.containers
          ),

        route_id:
          route.route_id,

        selected_route:
          route,

        route_score:
          Number(
            route.route_score
          ),

        transit_time_days:
          Number(
            route.transit_time_days ??
            route.transit_days ??
            0
          ),

        distance_nm:
          Number(
            route.distance_nm ||
            0
          ),

        transshipments:
          Number(
            route.transshipments ||
            0
          ),

        route_type:
          route.route_type,

        base_freight_usd:
          Number(
            pricing.base_freight_usd ||
            route.base_freight_usd ||
            0
          ),

        freight_per_container_usd:
          Number(
            pricing.base_freight_usd ||
            route.base_freight_usd ||
            0
          ),

        total_base_freight_usd:
          Number(
            pricing.base_freight_usd ||
            route.base_freight_usd ||
            0
          ) *
          Number(
            formData.containers
          ),

        fuel_surcharge_usd:
          Number(
            pricing.fuel_surcharge_usd ||
            0
          ),

        port_charge_usd:
          Number(
            pricing.port_charge_usd ||
            0
          ),

        risk_surcharge_usd:
          Number(
            pricing.risk_surcharge_usd ||
            0
          ),

        operating_cost_per_container_usd:
          Number(
            pricing.operating_cost_per_container_usd ||
            0
          ),

        total_operational_cost_usd:
          Number(
            pricing.total_operational_cost_usd ||
            0
          ),

        demand_factor:
          Number(
            pricing.demand_factor ||
            1
          ),

        demand_adjusted_total_cost_usd:
          Number(
            pricing.demand_adjusted_total_cost_usd ||
            0
          ),

        target_margin_percent:
          Number(
            pricing.target_margin_percent ||
            0
          ),

        margin_amount_usd:
          Number(
            pricing.margin_amount_usd ||
            0
          ),

        final_selling_price_usd:
          Number(
            pricing.final_selling_price_usd ||
            0
          ),

        top_routes:
          topRoutes,

        available_routes:
          availableRoutes,

        recommended_route:
          routeResults?.recommended_route,

        alternatives:
          routeResults?.alternatives ||
          [],

        reason:
          routeResults?.reason ||
          "Route selected based on the optimal routing score.",

      };

    };


  // =======================================================
  // SAVE QUOTATION
  // =======================================================

  const handleSaveQuotation =
    async (
      route = selectedRoute
    ) => {

      setSavedQuotationMessage("");

      setErrorMessage("");


      if (!route) {

        setErrorMessage(
          "Please calculate the price for a route first."
        );

        return null;

      }


      const routeId =
        route.route_id;

      const pricing =
        pricingResults[
          routeId
        ];


      if (!pricing) {

        setErrorMessage(
          "Please calculate the price before saving the quotation."
        );

        return null;

      }


      if (
        pricing.final_selling_price_usd ===
          undefined ||
        pricing.final_selling_price_usd ===
          null ||
        Number(
          pricing.final_selling_price_usd
        ) <= 0
      ) {

        setErrorMessage(
          "Final selling price is not available. Please calculate the price again."
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


      if (savedQuotationId) {

        setSavedQuotationMessage(
          "Quotation is already saved."
        );

        return savedQuotationId;

      }


      setQuotationActionLoading(
        "save"
      );


      try {

        const result =
          await saveQuotation({

            user_id:
              Number(
                currentUser.id
              ),

            quotation:
              buildQuotation(
                route,
                pricing
              ),

          });


        if (
          result?.status ===
            "success" ||
          result?.status ===
            "already_saved"
        ) {

          const quotationId =
            result?.quotation_id ||
            result?.saved_quotation_id ||
            null;


          if (quotationId) {

            setSavedQuotationId(
              quotationId
            );

          }


          setSavedQuotationMessage(

            result?.status ===
              "already_saved"

              ? "Quotation is already saved."

              : "Quotation saved successfully."

          );


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

      } finally {

        setQuotationActionLoading(
          ""
        );

      }

    };


  // =======================================================
  // REQUEST APPROVAL
  // =======================================================

  const handleRequestApproval =
    async () => {

      setErrorMessage("");

      setSavedQuotationMessage("");


      if (!selectedRoute) {

        setErrorMessage(
          "Please calculate the price for a route first."
        );

        return;

      }


      if (userLoading) {

        setErrorMessage(
          "Please wait while your account is being verified."
        );

        return;

      }


      if (!currentUser?.id) {

        setErrorMessage(
          "Please login before requesting approval."
        );

        return;

      }


      setQuotationActionLoading(
        "approval"
      );


      try {

        let quotationId =
          savedQuotationId;


        if (!quotationId) {

          quotationId =
            await handleSaveQuotation(
              selectedRoute
            );

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


        setSavedQuotationId(
          quotationId
        );


        setSavedQuotationMessage(
          "Quotation saved and submitted for admin approval successfully."
        );

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

        setQuotationActionLoading(
          ""
        );

      }

    };


  // =======================================================
  // FORMAT CURRENCY
  // =======================================================

  const formatCurrency =
    (value) => {

      const number =
        Number(value) || 0;

      return number.toLocaleString(
        "en-US",
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        }
      );

    };


  // =======================================================
  // RESULTS
  // =======================================================

  const availableRoutes =
    Array.isArray(
      routeResults?.available_routes
    )
      ? routeResults.available_routes
      : [];


  const topRoutes =
    Array.isArray(
      routeResults?.top_routes
    )
      ? routeResults.top_routes
      : [];


  const hasResults =
    routeResults &&
    (
      availableRoutes.length >
        0 ||
      topRoutes.length >
        0
    );


  // =======================================================
  // RENDER
  // =======================================================

  return (

    <div className="route-page">


      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="route-page-header">

        <div>

          <h1>
            New Route Search
          </h1>

          <p>
            Find the optimal maritime route
            based on transit time, distance,
            and transshipments.
          </p>

        </div>

      </div>


      {/* ===================================================
          SEARCH CARD
      =================================================== */}

      <div className="route-search-card">


        {/* =================================================
            FORM GRID
        ================================================= */}

        <div className="route-form-grid">


          {/* ===============================================
              ORIGIN
          =============================================== */}

          <div className="route-form-group">

            <label>
              Origin
            </label>

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


          {/* ===============================================
              DESTINATION
          =============================================== */}

          <div className="route-form-group">

            <label>
              Destination
            </label>

            <select
              name="destination"
              value={formData.destination}
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


          {/* ===============================================
              CARGO TYPE
          =============================================== */}

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
            >

              <option value="">
                Select Cargo Type
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


          {/* ===============================================
              CONTAINER QUANTITY
          =============================================== */}

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


        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (

          <div className="route-error-message">

            {errorMessage}

          </div>

        )}


        {/* =================================================
            ANALYZE
        ================================================= */}

        <button
          className="analyze-route-button"
          onClick={
            handleAnalyzeRoute
          }
          disabled={loading}
        >

          {loading
            ? "Analyzing Route..."
            : "Analyze Route"}

        </button>

      </div>


      {/* ===================================================
          RESULTS
      =================================================== */}

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

                  {availableRoutes.length ||
                    routeResults.candidate_routes ||
                    0}{" "}

                  route
                  {(
                    availableRoutes.length ||
                    routeResults.candidate_routes ||
                    0
                  ) !== 1
                    ? "s"
                    : ""}{" "}

                  available from{" "}

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


            {availableRoutes.length >
              0 && (

              <div className="available-routes-list">

                {availableRoutes.map(
                  (
                    route,
                    index
                  ) => (

                    <div
                      className="available-route-row"
                      key={
                        route.route_id ||
                        `${route.origin}-${route.destination}-${index}`
                      }
                    >

                      <div className="available-route-main">

                        <div className="available-route-id">

                          <span>
                            Route ID
                          </span>

                          <strong>
                            {route.route_id}
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
                            {route.destination}
                          </strong>

                          <small>
                            {route.route_type}
                          </small>

                        </div>

                      </div>


                      <div className="available-route-info">

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
                            {route.transshipments ??
                              0}
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

                  )
                )}

              </div>

            )}

          </div>


          {/* =================================================
              TOP 3 ROUTES
          ================================================= */}

          {topRoutes.length >
            0 && (

            <div className="top-routes-section">

              <div className="top-routes-heading">

                <div>

                  <h2>
                    Top 3 Best Routes
                  </h2>

                  <p>
                    Routes ranked by the optimal
                    routing score.
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

                      const isPricingLoading =
                        pricingLoadingRoute ===
                        route.route_id;

                      const isSelected =
                        selectedRoute?.route_id ===
                          route.route_id &&
                        activePricingResult?.status ===
                          "success" &&
                        activePricingResult?.route_id ===
                          route.route_id;

                      const pricing =
                        isSelected
                          ? activePricingResult
                          : pricingResults[
                              route.route_id
                            ];


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


                          {/* CARD HEADER */}

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

                                {route.destination}

                                <small>
                                  {route.route_type}
                                </small>

                              </h3>

                            </div>


                            <div className="route-score-box">

                              <span>
                                Route Score
                              </span>

                              <strong>

                                {Number(
                                  route.route_score ||
                                  0
                                ).toFixed(2)}

                                /100

                              </strong>

                            </div>

                          </div>


                          {/* RECOMMENDATION */}

                          {isRecommended && (

                            <div className="recommended-text">

                              Recommended route selected based on the optimal routing score.

                            </div>

                          )}


                          {/* ROUTE DETAILS */}

                          <div className="top-route-details">


                            <div className="route-detail-item">

                              <span>
                                Route ID
                              </span>

                              <strong>
                                {route.route_id}
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
                                {route.transshipments ??
                                  0}
                              </strong>

                            </div>


                            <div className="route-detail-item">

                              <span>
                                Base Freight
                              </span>

                              <strong>

                                $
                                {formatCurrency(
                                  route.base_freight_usd
                                )}

                              </strong>

                              <small>
                                per container
                              </small>

                            </div>

                          </div>


                          {/* CALCULATE PRICE */}

                          <div className="route-card-actions single-price-action">

                            <button
                              type="button"
                              className="price-button"
                              onClick={() =>
                                handleCalculatePrice(
                                  route
                                )
                              }
                              disabled={
                                pricingLoadingRoute !==
                                null
                              }
                            >

                              {isPricingLoading
                                ? "Calculating..."
                                : "Calculate Price"}

                            </button>

                          </div>


                          {/* PRICING RESULT */}

                          {isSelected && (

                            <div className="selected-quotation-result-card">

                              <div className="selected-quotation-result-header">

                                <div>

                                  <span className="selected-route-label">

                                    Selected Route

                                  </span>


                                  <h2>

                                    {selectedRoute.origin}
                                    {" "}
                                    →
                                    {" "}
                                    {selectedRoute.destination}

                                  </h2>


                                  <p>

                                    {selectedRoute.route_id}
                                    {" · "}
                                    Final quotation details

                                  </p>

                                </div>


                                <div className="selected-price-highlight">

                                  <span>
                                    Final Selling Price
                                  </span>

                                  <strong>

                                    $
                                    {formatCurrency(
                                      pricing.final_selling_price_usd
                                    )}

                                  </strong>

                                </div>

                              </div>


                              <div className="selected-quotation-details-grid">


                                <div className="selected-quotation-detail">

                                  <span>
                                    Cargo Type
                                  </span>

                                  <strong>
                                    {formData.cargo_type}
                                  </strong>

                                </div>


                                <div className="selected-quotation-detail">

                                  <span>
                                    Containers
                                  </span>

                                  <strong>
                                    {formData.containers}
                                  </strong>

                                </div>


                                <div className="selected-quotation-detail">

                                  <span>
                                    Distance
                                  </span>

                                  <strong>

                                    {Number(
                                      selectedRoute.distance_nm ||
                                      0
                                    ).toLocaleString()}{" "}

                                    NM

                                  </strong>

                                </div>


                                <div className="selected-quotation-detail">

                                  <span>
                                    Transit Time
                                  </span>

                                  <strong>

                                    {selectedRoute.transit_time_days ??
                                      selectedRoute.transit_days ??
                                      0}{" "}

                                    days

                                  </strong>

                                </div>


                                <div className="selected-quotation-detail">

                                  <span>
                                    Transshipments
                                  </span>

                                  <strong>

                                    {selectedRoute.transshipments ??
                                      0}

                                  </strong>

                                </div>


                                <div className="selected-quotation-detail">

                                  <span>
                                    Base Cost
                                  </span>

                                  <strong>

                                    $
                                    {formatCurrency(
                                      selectedRoute.base_freight_usd
                                    )}

                                  </strong>

                                  <small>
                                    per container
                                  </small>

                                </div>

                              </div>


                              <div className="selected-quotation-actions">

                                <button
                                  type="button"
                                  className="save-quotation-button"
                                  onClick={() =>
                                    handleSaveQuotation(
                                      selectedRoute
                                    )
                                  }
                                  disabled={
                                    quotationActionLoading !==
                                    ""
                                  }
                                >

                                  {quotationActionLoading ===
                                  "save"
                                    ? "Saving..."
                                    : "Save Quotation"}

                                </button>


                                <button
                                  type="button"
                                  className="request-approval-button"
                                  onClick={
                                    handleRequestApproval
                                  }
                                  disabled={
                                    quotationActionLoading !==
                                    ""
                                  }
                                >

                                  {quotationActionLoading ===
                                  "approval"
                                    ? "Submitting..."
                                    : "Request Approval"}

                                </button>

                              </div>


                              {savedQuotationMessage && (

                                <div className="saved-quotation-message">

                                  {savedQuotationMessage}

                                </div>

                              )}

                            </div>

                          )}

                        </div>

                      );

                    }
                  )}

              </div>


              {/* =================================================
                  ONE WORLD MAP
              ================================================= */}

              <RouteWorldMap
                route={topRoutes[0]}
              />

            </div>

          )}

        </div>

      )}

    </div>

  );

}

export default Route;