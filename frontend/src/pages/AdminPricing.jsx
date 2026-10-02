import { useEffect, useState } from "react";
import "./AdminPricing.css";

function AdminPricing() {
  const [pricingRecords, setPricingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminPricing();
  }, []);

  const fetchAdminPricing = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:8000/api/pricing/admin",
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
            "Admin access is required to view pricing records."
          );
        }

        throw new Error("Unable to load pricing records.");
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(
          data.message || "Unable to load pricing records."
        );
      }

      const records = Array.isArray(data.pricing)
        ? data.pricing
        : [];

      // Only approved quotations should appear.
      const approvedRecords = records.filter(
        (record) =>
          String(record.status || "").toLowerCase() === "approved"
      );

      setPricingRecords(approvedRecords);
    } catch (err) {
      console.error("Admin Pricing Error:", err);

      setError(
        err.message || "Unable to load pricing records."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return `$${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getBaseCost = (record) => {
    // Prefer the total base freight if the API provides it.
    if (record.total_base_freight_usd != null) {
      return Number(record.total_base_freight_usd);
    }

    if (record.pricing?.total_base_freight_usd != null) {
      return Number(record.pricing.total_base_freight_usd);
    }

    // The existing main.py endpoint returns per-container
    // base freight, so calculate the shipment total.
    const baseFreight = Number(
      record.base_freight_usd ??
        record.base_freight_per_container_usd ??
        record.pricing?.base_freight_usd ??
        0
    );

    const containerCount = Number(
      record.container_count ?? 0
    );

    return baseFreight * containerCount;
  };

  if (loading) {
    return (
      <div className="admin-pricing-page">
        <div className="admin-pricing-header">
          <div>
            <h1>Pricing Management</h1>
            <p>Pricing details for approved quotations</p>
          </div>
        </div>

        <div className="admin-pricing-message">
          Loading pricing records...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-pricing-page">
      {/* PAGE HEADER */}

      <div className="admin-pricing-header">
        <div>
          <h1>Pricing Management</h1>
          <p>
            Base freight and surcharges for approved quotations.
          </p>
        </div>

        <button
          type="button"
          className="admin-pricing-refresh"
          onClick={fetchAdminPricing}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="admin-pricing-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={fetchAdminPricing}
          >
            Try Again
          </button>
        </div>
      )}

      {/* PRICING TABLE */}

      {!error && (
        <div className="admin-pricing-table-card">
          <div className="admin-pricing-table-heading">
            <div>
              <h2>Approved Quotation Pricing</h2>
              <p>
                Pricing records: {pricingRecords.length}
              </p>
            </div>
          </div>

          <div className="admin-pricing-table-wrapper">
            <table className="admin-pricing-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Route ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Base Cost</th>
                  <th>Fuel Surcharge</th>
                  <th>Port Surcharge</th>
                  <th>Risk Surcharge</th>
                </tr>
              </thead>

              <tbody>
                {pricingRecords.length > 0 ? (
                  pricingRecords.map((record, index) => (
                    <tr
                      key={
                        record.quotation_id ??
                        record.id ??
                        index
                      }
                    >
                      <td className="admin-pricing-quotation-id">
                        #{record.quotation_id ?? "—"}
                      </td>

                      <td>
                        <span className="admin-pricing-route-badge">
                          {record.route_id ??
                            record.selected_route_id ??
                            "—"}
                        </span>
                      </td>

                      <td>{record.origin || "—"}</td>

                      <td>{record.destination || "—"}</td>

                      <td className="admin-pricing-money">
                        {formatCurrency(getBaseCost(record))}
                      </td>

                      <td className="admin-pricing-money">
                        {formatCurrency(
                          record.fuel_surcharge ??
                            record.fuel_surcharge_usd ??
                            record.pricing?.fuel_surcharge_usd ??
                            0
                        )}
                      </td>

                      <td className="admin-pricing-money">
                        {formatCurrency(
                          record.port_charge ??
                            record.port_charge_usd ??
                            record.pricing?.port_charge_usd ??
                            0
                        )}
                      </td>

                      <td className="admin-pricing-money">
                        {formatCurrency(
                          record.risk_surcharge ??
                            record.risk_surcharge_usd ??
                            record.pricing?.risk_surcharge_usd ??
                            0
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="admin-pricing-empty"
                    >
                      No approved quotation pricing records found.
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

export default AdminPricing;