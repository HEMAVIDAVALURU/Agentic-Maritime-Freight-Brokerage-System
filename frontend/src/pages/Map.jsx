import { useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import { seaRoute } from "searoute-ts";
import { DEFAULT_MARNET as MARNET_20KM } from "searoute-ts/marnet-20km";

import {
  analyzeRoute,
  calculatePricing,
  saveQuotation,
  requestQuotationApproval,
} from "../services/quotationApi";

import routeMapData from "../data/routeMapData.json";

import "leaflet/dist/leaflet.css";
import "./Map.css";


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

function MapAutoFit({ routeSegments, portPoints }) {
  const map = useMap();

  useEffect(() => {
    const pathPoints = (routeSegments || []).flat();

    const markerPoints = (portPoints || []).map(
      (port) => port.position
    );

    const allPoints = [
      ...pathPoints,
      ...markerPoints,
    ];

    if (!allPoints.length) return;

    const bounds = L.latLngBounds(allPoints);

    if (!bounds.isValid()) return;

    map.fitBounds(bounds, {
      paddingTopLeft: [48, 48],
      paddingBottomRight: [48, 48],
      maxZoom: 6,
      animate: false,
    });
  }, [
    map,
    routeSegments,
    portPoints,
  ]);

  return null;
}


// =========================================================
// VALID COORDINATE CHECK
// =========================================================

function isValidCoordinate(lat, lng) {
  if (
    lat === null ||
    lat === undefined ||
    String(lat).trim() === "" ||
    lng === null ||
    lng === undefined ||
    String(lng).trim() === ""
  ) {
    return false;
  }

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
// GET ROUTE PORT POINTS
//
// IMPORTANT:
// Route map information now comes from:
//
// frontend/src/data/routeMapData.json
//
// JSON structure:
//
// {
//   "ports": {
//      "Chennai": {
//         "latitude": ...,
//         "longitude": ...
//      }
//   },
//   "routes": {
//      "R001": {
//         "port_sequence": [
//            "Chennai",
//            "Colombo",
//            "Rotterdam"
//         ]
//      }
//   }
// }
//
// This allows the map to display:
//
// 0 transshipments:
// Origin → Destination
//
// 1 transshipment:
// Origin → TS1 → Destination
//
// 2 transshipments:
// Origin → TS1 → TS2 → Destination
// =========================================================

function getRoutePortPoints(route) {
  if (!route) return [];

  const routeId = String(
    route.route_id || ""
  ).trim();

  const mapRoute =
    routeMapData?.routes?.[routeId];

  let portSequence = [];

  // ---------------------------------------------------------
  // USE JSON PORT SEQUENCE
  // ---------------------------------------------------------

  if (
    mapRoute &&
    Array.isArray(mapRoute.port_sequence) &&
    mapRoute.port_sequence.length >= 2
  ) {
    portSequence = mapRoute.port_sequence;
  }

  // ---------------------------------------------------------
  // FALLBACK
  //
  // If a route does not exist in routeMapData.json,
  // still show origin → destination using route coordinates
  // returned by backend.
  // ---------------------------------------------------------

  if (portSequence.length < 2) {
    portSequence = [
      route.origin,
      route.destination,
    ];
  }

  const points = [];

  // ---------------------------------------------------------
  // CREATE PORT POINTS
  // ---------------------------------------------------------

  portSequence.forEach(
    (portName, index) => {
      const cleanPortName =
        String(portName || "").trim();

      if (!cleanPortName) return;

      const coordinates =
        routeMapData?.ports?.[cleanPortName];

      // -----------------------------------------------------
      // JSON COORDINATES
      // -----------------------------------------------------

      if (
        coordinates &&
        isValidCoordinate(
          coordinates.latitude,
          coordinates.longitude
        )
      ) {
        let type = "transshipment";

        if (index === 0) {
          type = "origin";
        } else if (
          index ===
          portSequence.length - 1
        ) {
          type = "destination";
        }

        points.push({
          name: cleanPortName,
          type,
          position: [
            Number(coordinates.latitude),
            Number(coordinates.longitude),
          ],
        });

        return;
      }

      // -----------------------------------------------------
      // FALLBACK FOR ORIGIN
      // -----------------------------------------------------

      if (
        index === 0 &&
        isValidCoordinate(
          route.origin_lat,
          route.origin_lng
        )
      ) {
        points.push({
          name:
            route.origin ||
            cleanPortName,
          type: "origin",
          position: [
            Number(route.origin_lat),
            Number(route.origin_lng),
          ],
        });

        return;
      }

      // -----------------------------------------------------
      // FALLBACK FOR DESTINATION
      // -----------------------------------------------------

      if (
        index ===
          portSequence.length - 1 &&
        isValidCoordinate(
          route.destination_lat,
          route.destination_lng
        )
      ) {
        points.push({
          name:
            route.destination ||
            cleanPortName,
          type: "destination",
          position: [
            Number(route.destination_lat),
            Number(route.destination_lng),
          ],
        });
      }
    }
  );

  return points;
}


// =========================================================
// CONVERT SEAROUTE GEOMETRY
// =========================================================

function convertSeaFeatureToSegments(feature) {
  const geometry = feature?.geometry;

  if (!geometry) return [];

  let lines = [];

  if (
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates)
  ) {
    lines = [
      geometry.coordinates,
    ];
  } else if (
    geometry.type === "MultiLineString" &&
    Array.isArray(geometry.coordinates)
  ) {
    lines = geometry.coordinates;
  } else {
    return [];
  }

  return lines
    .map((line) =>
      line
        .map((coordinate) => {
          if (
            !Array.isArray(coordinate) ||
            coordinate.length < 2
          ) {
            return null;
          }

          const lng =
            Number(coordinate[0]);

          const lat =
            Number(coordinate[1]);

          return (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90
          )
            ? [lat, lng]
            : null;
        })
        .filter(Boolean)
    )
    .filter(
      (line) => line.length >= 2
    );
}


// =========================================================
// LONGITUDE ALIGNMENT
// =========================================================

function longitudeNear(
  lng,
  referenceLng
) {
  let result = Number(lng);

  while (
    result - referenceLng >
    180
  ) {
    result -= 360;
  }

  while (
    result - referenceLng <
    -180
  ) {
    result += 360;
  }

  return result;
}


// =========================================================
// ALIGN PORT POINTS
// =========================================================

function alignPortPointsForMap(
  portPoints
) {
  if (!portPoints.length) {
    return [];
  }

  let previousLng =
    Number(
      portPoints[0].position[1]
    );

  return portPoints.map(
    (port, index) => {
      const rawLng =
        Number(
          port.position[1]
        );

      const alignedLng =
        index === 0
          ? rawLng
          : longitudeNear(
              rawLng,
              previousLng
            );

      previousLng =
        alignedLng;

      return {
        ...port,

        position: [
          Number(
            port.position[0]
          ),
          alignedLng,
        ],
      };
    }
  );
}


// =========================================================
// BUILD SEA ROUTE SEGMENTS
//
// Each consecutive port pair is calculated separately:
//
// Origin → TS1
// TS1 → TS2
// TS2 → Destination
//
// No straight-line fallback.
// =========================================================

function buildSeaRouteSegments(
  route,
  alignedPorts
) {
  const rawPorts =
    getRoutePortPoints(route);

  const ports =
    alignedPorts ||
    alignPortPointsForMap(
      rawPorts
    );

  if (
    rawPorts.length < 2 ||
    ports.length < 2
  ) {
    return {
      segments: [],
      error:
        "Valid origin and destination coordinates are required.",
    };
  }

  const segments = [];
  const errors = [];

  for (
    let index = 0;
    index <
      rawPorts.length - 1;
    index += 1
  ) {
    const from =
      rawPorts[index].position;

    const to =
      rawPorts[index + 1].position;

    const alignedFrom =
      ports[index].position;

    const alignedTo =
      ports[index + 1].position;

    try {
      const feature =
        seaRoute(
          [
            Number(from[1]),
            Number(from[0]),
          ],
          [
            Number(to[1]),
            Number(to[0]),
          ],
          {
            units: "kilometers",

            network:
              MARNET_20KM,

            appendOriginDestination:
              true,

            antimeridian:
              "unwrap",
          }
        );

      const rawSegments =
        convertSeaFeatureToSegments(
          feature
        );

      if (
        !rawSegments.length
      ) {
        errors.push(
          `No maritime path returned for ${rawPorts[index].name} → ${rawPorts[index + 1].name}.`
        );

        continue;
      }

      let routeLastLng =
        Number(
          alignedFrom[1]
        );

      const unwrappedSegments =
        rawSegments.map(
          (line) => {
            return line.map(
              ([lat, lng]) => {
                const alignedLng =
                  longitudeNear(
                    lng,
                    routeLastLng
                  );

                routeLastLng =
                  alignedLng;

                return [
                  lat,
                  alignedLng,
                ];
              }
            );
          }
        );

      // -----------------------------------------------------
      // EXACT START / END ATTACHMENT
      // -----------------------------------------------------

      if (
        unwrappedSegments.length
      ) {
        const first =
          unwrappedSegments[0];

        const last =
          unwrappedSegments[
            unwrappedSegments.length - 1
          ];

        const exactFrom = [
          Number(
            alignedFrom[0]
          ),
          Number(
            alignedFrom[1]
          ),
        ];

        const exactTo = [
          Number(
            alignedTo[0]
          ),
          Number(
            alignedTo[1]
          ),
        ];

        first[0] =
          exactFrom;

        last[last.length - 1] =
          exactTo;
      }

      unwrappedSegments.forEach(
        (line) => {
          if (
            line.length >= 2
          ) {
            segments.push(line);
          }
        }
      );
    } catch (error) {
      console.error(
        `Maritime route calculation failed for ${rawPorts[index].name} → ${rawPorts[index + 1].name}:`,
        error
      );

      errors.push(
        error?.message ||
          `Could not calculate ${rawPorts[index].name} → ${rawPorts[index + 1].name}.`
      );
    }
  }

  return {
    segments,
    error:
      errors.join(" "),
  };
}


// =========================================================
// PORT ICONS
// =========================================================

function makePortIcon(type) {
  return L.divIcon({
    className:
      "route-port-icon-shell",

    html: `
      <span class="route-port-pin route-port-pin--${type}">
        <span></span>
      </span>
    `,

    iconSize: [
      30,
      38,
    ],

    iconAnchor: [
      15,
      36,
    ],

    tooltipAnchor: [
      0,
      -31,
    ],
  });
}


const PORT_ICONS = {
  origin:
    makePortIcon(
      "origin"
    ),

  destination:
    makePortIcon(
      "destination"
    ),

  transshipment:
    makePortIcon(
      "transshipment"
    ),
};


// =========================================================
// ROUTE WORLD MAP
// =========================================================

export function RouteWorldMap({
  route,
  onClose,
}) {
  if (!route) return null;

  const rawPortPoints =
    getRoutePortPoints(
      route
    );

  const portPoints =
    alignPortPointsForMap(
      rawPortPoints
    );

  const {
    segments: routeSegments,
    error: routeError,
  } =
    buildSeaRouteSegments(
      route,
      portPoints
    );

  const originPosition =
    portPoints.find(
      (port) =>
        port.type === "origin"
    )?.position;

  const mapCenter =
    originPosition ||
    [20, 0];

  return (
    <div className="route-map-section">

      <div className="route-map-header">

        <div>

          <h2>
            Maritime Shipment Route
          </h2>

          <p>
            Sea route from{" "}
            <strong>
              {route.origin}
            </strong>{" "}
            to{" "}
            <strong>
              {route.destination}
            </strong>

            {" "}• Route ID:{" "}

            <strong>
              {route.route_id}
            </strong>
          </p>

        </div>


        <div className="route-map-header-actions">

          <div className="route-map-legend">

            <div className="route-map-legend-item">

              <span className="route-map-legend-line recommended" />

              <span>
                Maritime shipping route
              </span>

            </div>

          </div>


          <button
            type="button"
            className="route-map-close-button"
            onClick={onClose}
          >
            Close Map{" "}
            <span aria-hidden="true">
              ×
            </span>
          </button>

        </div>

      </div>


      {routeError && (
        <div
          className="route-map-status"
          role="status"
        >
          {routeSegments.length
            ? `Some maritime route sections could not be drawn: ${routeError}`
            : `Maritime route could not be calculated: ${routeError} Check routeMapData.json coordinates and searoute-ts installation.`}
        </div>
      )}


      <div className="route-map-container">

        <MapContainer
          center={mapCenter}
          zoom={3}
          scrollWheelZoom
          worldCopyJump={false}
          className="route-world-map"
        >

          <TileLayer
            attribution="&copy; Esri, HERE, Garmin, FAO, NOAA, USGS"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />


          <MapAutoFit
            routeSegments={
              routeSegments
            }
            portPoints={
              portPoints
            }
          />


          {/* WHITE CASING */}

          {routeSegments.map(
            (
              segment,
              index
            ) => (
              <Polyline
                key={`sea-route-casing-${route.route_id}-${index}`}
                positions={segment}
                pathOptions={{
                  color:
                    "#ffffff",

                  weight: 10,

                  opacity: 0.92,

                  lineCap:
                    "round",

                  lineJoin:
                    "round",
                }}
                interactive={false}
              />
            )
          )}


          {/* BLUE SEA ROUTE */}

          {routeSegments.map(
            (
              segment,
              index
            ) => (
              <Polyline
                key={`sea-route-line-${route.route_id}-${index}`}
                positions={segment}
                pathOptions={{
                  color:
                    "#1769e0",

                  weight: 6,

                  opacity: 1,

                  lineCap:
                    "round",

                  lineJoin:
                    "round",
                }}
              >

                <Tooltip sticky>
                  {`Maritime route • ${route.route_id}`}
                </Tooltip>

              </Polyline>
            )
          )}


          {/* PORT MARKERS */}

          {portPoints.map(
            (
              port,
              index
            ) => (
              <Marker
                key={`${route.route_id}-${port.type}-${index}`}
                position={
                  port.position
                }
                icon={
                  PORT_ICONS[
                    port.type
                  ] ||
                  PORT_ICONS.transshipment
                }
                zIndexOffset={
                  port.type ===
                    "origin" ||
                  port.type ===
                    "destination"
                    ? 1000
                    : 500
                }
              >

                <Tooltip
                  permanent
                  direction="top"
                  offset={[
                    0,
                    -22,
                  ]}
                >

                  <strong>
                    {
                      port.type ===
                      "origin"
                        ? "Origin"
                        : port.type ===
                          "destination"
                        ? "Destination"
                        : "Transshipment"
                    }
                    :
                  </strong>

                  {" "}

                  {port.name}

                </Tooltip>

              </Marker>
            )
          )}

        </MapContainer>

      </div>

    </div>
  );
}


// =========================================================
