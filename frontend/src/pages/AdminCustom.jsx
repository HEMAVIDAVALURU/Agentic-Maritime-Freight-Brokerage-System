import { useEffect, useState } from "react";
import "./AdminCustom.css";

function AdminCustom() {
  const [customsRecords, setCustomsRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCustoms = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:8000/api/customs/admin",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load customs information.");
      }

      const data = await response.json();
      setCustomsRecords(data.customs || []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustoms();
  }, []);

  const renderRequirement = (value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const normalized = String(value).trim().toLowerCase();

    return (
      <span
        className={`customs-requirement ${
          normalized === "yes"
            ? "requirement-yes"
            : normalized === "no"
            ? "requirement-no"
            : ""
        }`}
      >
        {value}
      </span>
    );
  };

  const renderStatus = (status) => {
    const normalized = String(status || "No Data")
      .toLowerCase()
      .replace(/\s+/g, "-");

    return (
      <span className={`customs-status status-${normalized}`}>
        {status || "No Data"}
      </span>
    );
  };

  return (
    <div className="admin-customs-page">
      <div className="customs-page-header">
        <div>
          <h1>Customs Management</h1>
          <p>
            Customs documentation and compliance information
            for approved quotations.
          </p>
        </div>

        <button
          type="button"
          className="customs-refresh-button"
          onClick={fetchCustoms}
          disabled={loading}
        >
          ↻ {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="customs-table-card">
        <div className="customs-table-title">
          <h2>Approved Quotation Customs Assessment</h2>
          <p>Customs records: {customsRecords.length}</p>
        </div>

        {loading ? (
          <div className="customs-message">
            Loading customs information...
          </div>
        ) : error ? (
          <div className="customs-message customs-error">
            {error}
          </div>
        ) : customsRecords.length === 0 ? (
          <div className="customs-message">
            No approved quotation customs records available.
          </div>
        ) : (
          <div className="customs-table-wrapper">
            <table className="customs-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Route ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Cargo Type</th>
                  <th>HS Code Required</th>
                  <th>Commercial Invoice</th>
                  <th>Packing List</th>
                  <th>Certificate of Origin</th>
                  <th>Restricted Cargo</th>
                  <th>Customs Status</th>
                </tr>
              </thead>

              <tbody>
                {customsRecords.map((record, index) => (
                  <tr
                    key={`${record.quotation_id}-${record.route_id}-${index}`}
                  >
                    <td>#{record.quotation_id}</td>

                    <td>
                      <span className="customs-route-id">
                        {record.route_id || "—"}
                      </span>
                    </td>

                    <td>{record.origin || "—"}</td>
                    <td>{record.destination || "—"}</td>
                    <td>{record.cargo_type || "—"}</td>

                    <td>
                      {renderRequirement(record.hs_code_required)}
                    </td>

                    <td>
                      {renderRequirement(record.commercial_invoice)}
                    </td>

                    <td>
                      {renderRequirement(record.packing_list)}
                    </td>

                    <td>
                      {renderRequirement(
                        record.certificate_of_origin
                      )}
                    </td>

                    <td>
                      {renderRequirement(record.restricted_cargo)}
                    </td>

                    <td>
                      {renderStatus(record.customs_status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCustom;