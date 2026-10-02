import { useEffect, useState } from "react";
import "./AdminWeather.css";

function AdminWeather() {
  const [weatherRecords, setWeatherRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminWeather();
  }, []);

  const fetchAdminWeather = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:8000/api/weather/admin",
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Authentication required. Please log in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Admin access is required to view weather records."
          );
        }

        throw new Error("Unable to load weather records.");
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(
          data.message || "Unable to load weather records."
        );
      }

      setWeatherRecords(
        Array.isArray(data.weather) ? data.weather : []
      );
    } catch (err) {
      console.error("Admin Weather Error:", err);

      setError(
        err.message || "Unable to load weather records."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    return number.toFixed(decimals);
  };

  const getRiskClass = (risk) => {
    const normalizedRisk = String(risk || "")
      .trim()
      .toLowerCase();

    if (normalizedRisk === "high") {
      return "admin-weather-risk-high";
    }

    if (normalizedRisk === "medium") {
      return "admin-weather-risk-medium";
    }

    if (normalizedRisk === "low") {
      return "admin-weather-risk-low";
    }

    return "admin-weather-risk-unknown";
  };

  const getRiskLabel = (risk) => {
    if (!risk) {
      return "Unavailable";
    }

    return String(risk).toUpperCase();
  };

  if (loading) {
    return (
      <div className="admin-weather-page">
        <div className="admin-weather-header">
          <div>
            <h1>Weather Management</h1>
            <p>
              Weather conditions for approved quotations
            </p>
          </div>
        </div>

        <div className="admin-weather-message">
          Loading weather records...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-weather-page">
      {/* PAGE HEADER */}

      <div className="admin-weather-header">
        <div>
          <h1>Weather Management</h1>

          <p>
            Weather conditions and risk assessments for approved
            quotations.
          </p>
        </div>

        <button
          type="button"
          className="admin-weather-refresh"
          onClick={fetchAdminWeather}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="admin-weather-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={fetchAdminWeather}
          >
            Try Again
          </button>
        </div>
      )}

      {/* WEATHER TABLE */}

      {!error && (
        <div className="admin-weather-table-card">
          <div className="admin-weather-table-heading">
            <div>
              <h2>Approved Quotation Weather Assessment</h2>

              <p>
                Weather records: {weatherRecords.length}
              </p>
            </div>
          </div>

          <div className="admin-weather-table-wrapper">
            <table className="admin-weather-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Route ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Wind Speed</th>
                  <th>Wave Height</th>
                  <th>Visibility</th>
                  <th>Storm Risk</th>
                  <th>Weather Condition</th>
                  <th>Weather Risk</th>
                </tr>
              </thead>

              <tbody>
                {weatherRecords.length > 0 ? (
                  weatherRecords.map((record, index) => (
                    <tr
                      key={`${record.quotation_id}-${record.route_id}-${index}`}
                    >
                      <td className="admin-weather-quotation-id">
                        #{record.quotation_id ?? "—"}
                      </td>

                      <td>
                        <span className="admin-weather-route-badge">
                          {record.route_id || "—"}
                        </span>
                      </td>

                      <td>{record.origin || "—"}</td>

                      <td>{record.destination || "—"}</td>

                      <td className="admin-weather-value">
                        {formatNumber(record.wind_speed_knots)}{" "}
                        <span className="admin-weather-unit">
                          knots
                        </span>
                      </td>

                      <td className="admin-weather-value">
                        {formatNumber(record.wave_height_m)}{" "}
                        <span className="admin-weather-unit">
                          m
                        </span>
                      </td>

                      <td className="admin-weather-value">
                        {formatNumber(record.visibility_km)}{" "}
                        <span className="admin-weather-unit">
                          km
                        </span>
                      </td>

                      <td>
                        <span
                          className={`admin-weather-storm-badge ${
                            Number(
                              record.storm_probability_percent
                            ) >= 40
                              ? "admin-weather-storm-high"
                              : Number(
                                  record.storm_probability_percent
                                ) >= 20
                              ? "admin-weather-storm-medium"
                              : "admin-weather-storm-low"
                          }`}
                        >
                          {record.storm_probability_percent != null
                            ? `${formatNumber(
                                record.storm_probability_percent,
                                0
                              )}%`
                            : "—"}
                        </span>
                      </td>

                      <td>
                        <span className="admin-weather-condition">
                          {record.weather_condition || "—"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`admin-weather-risk-badge ${getRiskClass(
                            record.weather_risk
                          )}`}
                        >
                          <span className="admin-weather-risk-dot" />

                          {getRiskLabel(record.weather_risk)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="10"
                      className="admin-weather-empty"
                    >
                      No weather records found for approved
                      quotations.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminWeather;