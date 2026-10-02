import { useEffect, useState } from "react";
import "./AdminRoutes.css";

const API_URL = "http://localhost:8000/api/routes/admin";

function AdminRoutes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchApprovedRoutes = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL, {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Authentication required. Please login again."
            );
          }

          throw new Error(
            "Unable to load approved route information."
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.message || "Unable to load route information."
          );
        }

        setRoutes(
          Array.isArray(data.routes) ? data.routes : []
        );
      } catch (err) {
        console.error("Admin Routes Error:", err);

        setError(
          err.message || "Unable to load route information."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedRoutes();
  }, []);

  return (
    <div className="admin-routes-page">
      <div className="admin-routes-header">
        <div>
          <h1>Route Information</h1>
          <p>
            Route details for approved quotations
          </p>
        </div>
      </div>

      {loading ? (
        <div className="admin-routes-message">
          Loading approved routes...
        </div>
      ) : error ? (
        <div className="admin-routes-error">
          {error}
        </div>
      ) : routes.length === 0 ? (
        <div className="admin-routes-message">
          No approved quotation routes found.
        </div>
      ) : (
        <div className="admin-routes-table-wrapper">
          <table className="admin-routes-table">
            <thead>
              <tr>
                <th>Quotation ID</th>
                <th>Route ID</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Cargo Type</th>
                <th>Number of Containers</th>
                <th>Transshipments</th>
                <th>Transit Days</th>
              </tr>
            </thead>

            <tbody>
              {routes.map((route) => (
                <tr
                  key={`${route.quotation_id}-${route.route_id}`}
                >
                  <td>
                    #{route.quotation_id}
                  </td>

                  <td>
                    {route.route_id || "—"}
                  </td>

                  <td>
                    {route.origin || "—"}
                  </td>

                  <td>
                    {route.destination || "—"}
                  </td>

                  <td>
                    {route.cargo_type || "—"}
                  </td>

                  <td>
                    {route.container_count ?? "—"}
                  </td>

                  <td>
                    {route.transshipments ?? "—"}
                  </td>

                  <td>
                    {route.transit_days ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminRoutes;