import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Users.css";

const API_BASE_URL = "http://localhost:8000/api/admin-users";

function Users() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const navigate = useNavigate();

  // =====================================================
  // LOAD REGISTERED CUSTOMERS
  // =====================================================

  const loadAdminUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError("");

      const response = await fetch(`${API_BASE_URL}/`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        navigate("/admin-login");
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        setUsersError(
          data.detail ||
            data.message ||
            "Unable to load registered users."
        );
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Admin users error:", error);

      setUsersError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadAdminUsers();
  }, []);

  // =====================================================
  // LOAD SELECTED CUSTOMER ACTIVITY
  // =====================================================

  const loadUserActivity = async (user) => {
    try {
      setSelectedUser(user);
      setActivityData(null);
      setActivityError("");
      setActivityLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/${user.id}/activity`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        navigate("/admin-login");
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        setActivityError(
          data.detail ||
            data.message ||
            "Unable to load customer activity."
        );
        return;
      }

      setActivityData(data);
    } catch (error) {
      console.error("User activity error:", error);

      setActivityError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setActivityLoading(false);
    }
  };

  // =====================================================
  // BACK TO USERS LIST
  // =====================================================

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setActivityData(null);
    setActivityError("");
  };

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // =====================================================
  // FORMAT SELLING PRICE
  // =====================================================

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
      return "—";
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
      return "—";
    }

    return numericPrice.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  };

  // =====================================================
  // NORMALIZE STATUS FOR DISPLAY
  // =====================================================

  
const getStatus = (status, type = "quotation") => {
  const value = (status || "pending")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const statusMaps = {
    quotation: {
      approved: ["Approved", "users-status-approved"],
      rejected: ["Rejected", "users-status-rejected"],
      pending: ["Pending", "users-status-pending"],
    },
    payment: {
      verified: ["Paid", "users-status-paid"],
      paid: ["Paid", "users-status-paid"],
      completed: ["Paid", "users-status-paid"],
      pending: ["Pending", "users-status-pending"],
      pending_verification: [
        "Pending Verification",
        "users-status-pending-verification",
      ],
      rejected: ["Rejected", "users-status-rejected"],
      not_paid: ["Not Paid", "users-status-not-paid"],
    },
    shipment: {
      booked: ["Booked", "users-status-booked"],
      pickup: ["Picked Up", "users-status-picked-up"],
      picked_up: ["Picked Up", "users-status-picked-up"],
      in_transit: ["In Transit", "users-status-in-transit"],
      out_for_delivery: [
        "Out for Delivery",
        "users-status-out-for-delivery",
      ],
      delivered: ["Delivered", "users-status-delivered"],
      cancelled: ["Cancelled", "users-status-cancelled"],
      not_booked: ["Not Booked", "users-status-not-booked"],
    },
  };

  const selected = statusMaps[type]?.[value];

  if (selected) {
    return {
      label: selected[0],
      className: selected[1],
    };
  }

  return {
    label: value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    className: "users-status-default",
  };
};


  // =====================================================
  // CUSTOMER ACTIVITY VIEW
  // =====================================================

  if (selectedUser) {
    const summary = activityData?.summary || {
      total_quotations: 0,
      approved_quotations: 0,
      completed_payments: 0,
      shipments_booked: 0,
      successfully_delivered: 0,
};

const quotations = activityData?.quotations || [];

    return (
      <div className="users-page">
        {/* ACTIVITY HEADER */}

        <section className="users-panel">
          <div className="users-activity-header">
            <div className="users-activity-heading">
              <span className="users-eyebrow">
                CUSTOMER MANAGEMENT
              </span>

              <h2>
                User Activity —{" "}
                {activityData?.user?.name ||
                  selectedUser.name ||
                  "Customer"}
              </h2>

              <p>
                {activityData?.user?.email ||
                  selectedUser.email}
              </p>

              {activityData?.user?.company_name && (
                <small>
                  Company: {activityData.user.company_name}
                </small>
              )}
            </div>

            <button
              type="button"
              className="users-back-button"
              onClick={handleBackToUsers}
            >
              ← Back to Users
            </button>
          </div>
        </section>

        {/* LOADING */}

        {activityLoading && (
          <section className="users-state">
            <div className="users-state-icon">⏳</div>
            <h3>Loading user activity...</h3>
            <p>Fetching quotation details for this customer.</p>
          </section>
        )}

        {/* ERROR */}

        {activityError && !activityLoading && (
          <section className="users-error">
            <p>{activityError}</p>

            <button
              type="button"
              className="users-retry-button"
              onClick={() => loadUserActivity(selectedUser)}
            >
              Try Again
            </button>
          </section>
        )}

        {/* SUMMARY AND QUOTATION TABLE */}

        
{activityData && !activityLoading && (
  <>
    <section className="users-summary-section">
      <div className="users-section-heading">
        <div>
          <h3>Customer Activity Summary</h3>
          <p>
            Quotations, payments and shipment progress for this customer.
          </p>
        </div>
      </div>

      <div className="users-summary-grid">
        <div className="users-summary-card users-summary-total">
          <div className="users-summary-top">
            <span>Total Quotations</span>
            <span className="users-summary-icon">▤</span>
          </div>
          <strong>{summary.total_quotations}</strong>
          <small>All quotation requests</small>
        </div>

        <div className="users-summary-card users-summary-approved">
          <div className="users-summary-top">
            <span>Approved Quotations</span>
            <span className="users-summary-icon">✓</span>
          </div>
          <strong>{summary.approved_quotations}</strong>
          <small>Approved requests</small>
        </div>

        <div className="users-summary-card users-summary-paid">
          <div className="users-summary-top">
            <span>Completed Payments</span>
            <span className="users-summary-icon">$</span>
          </div>
          <strong>{summary.completed_payments}</strong>
          <small>Verified payment records</small>
        </div>

        <div className="users-summary-card users-summary-booked">
          <div className="users-summary-top">
            <span>Shipments Booked</span>
            <span className="users-summary-icon">▣</span>
          </div>
          <strong>{summary.shipments_booked}</strong>
          <small>Non-cancelled shipments</small>
        </div>

        <div className="users-summary-card users-summary-delivered">
          <div className="users-summary-top">
            <span>Successfully Delivered</span>
            <span className="users-summary-icon">✓</span>
          </div>
          <strong>{summary.successfully_delivered}</strong>
          <small>Delivered shipments</small>
        </div>
      </div>
    </section>

    <section className="users-panel users-quotation-panel">
      <div className="users-table-heading">
        <div>
          <h3>Quotation, Payment & Shipment Details</h3>
          <p>
            Each row represents one quotation and its latest payment
            and shipment status.
          </p>
        </div>

        <span className="users-record-count">
          {quotations.length}{" "}
          {quotations.length === 1 ? "Record" : "Records"}
        </span>
      </div>

      {quotations.length === 0 ? (
        <div className="users-empty-state">
          <div className="users-state-icon">📄</div>
          <h3>No activity found</h3>
          <p>This customer has not created any quotations yet.</p>
        </div>
      ) : (
        <div className="users-table-wrapper">
          <table className="users-quotation-table users-activity-table">
            <thead>
              <tr>
                <th>Quotation ID</th>
                <th>Shipment ID</th>
                <th>Route ID</th>
                <th>Origin → Destination</th>
                <th>Cargo Type</th>
                <th>Container Quantity</th>
                <th>Quotation Status</th>
                <th>Payment Status</th>
                <th>Shipment Status</th>
              </tr>
            </thead>

            <tbody>
              {quotations.map((quotation) => {
                const quotationStatus = getStatus(
                  quotation.status,
                  "quotation"
                );

                const paymentStatus = getStatus(
                  quotation.payment_status,
                  "payment"
                );

                const shipmentStatus = getStatus(
                  quotation.shipment_status,
                  "shipment"
                );

                return (
                  <tr key={quotation.id}>
                    <td className="users-quotation-id">
                      #{quotation.id}
                    </td>

                    <td className="users-quotation-id">
                      {quotation.shipment_id || "—"}
                    </td>

                    <td>
                      {quotation.route_id ||
                        quotation.selected_route_id ||
                        "—"}
                    </td>

                    <td className="users-route-cell">
                      <span>{quotation.origin || "—"}</span>
                      <span className="users-route-arrow">→</span>
                      <span>{quotation.destination || "—"}</span>
                    </td>

                    <td>{quotation.cargo_type || "—"}</td>

<td>
  <div className="users-container-info">
    <strong>{quotation.container_count ?? "—"}</strong>
  </div>
</td>

                    <td>
                      <span
                        className={`users-status-badge ${quotationStatus.className}`}
                      >
                        {quotationStatus.label}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`users-status-badge ${paymentStatus.className}`}
                      >
                        {paymentStatus.label}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`users-status-badge ${shipmentStatus.className}`}
                      >
                        {shipmentStatus.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>
)}

      </div>
    );
  }

  // =====================================================
  // REGISTERED USERS LIST
  // =====================================================

  return (
    <div className="users-page">
      <section className="users-panel">
        <div className="users-list-header">
          <div>
            <span className="users-eyebrow">
              ADMINISTRATION
            </span>

            <h2>User Management</h2>

            <p>
              View registered customers and their quotation activity.
            </p>
          </div>

          <div className="users-total-badge">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>
        </div>

        {usersError && (
          <div className="users-error">
            <p>{usersError}</p>

            <button
              type="button"
              className="users-retry-button"
              onClick={loadAdminUsers}
            >
              Try Again
            </button>
          </div>
        )}

        {usersLoading ? (
          <div className="users-state">
            <div className="users-state-icon">⏳</div>
            <h3>Loading users...</h3>
            <p>Fetching registered customers from the database.</p>
          </div>
        ) : users.length === 0 && !usersError ? (
          <div className="users-empty-state">
            <div className="users-state-icon">👥</div>
            <h3>No registered customers</h3>
            <p>
              Customer accounts will appear here after registration.
            </p>
          </div>
        ) : (
          <div className="users-list">
            {users.map((user) => (
              <article className="users-user-card" key={user.id}>
                <div className="users-avatar">
                  {user.name
                    ? user.name.charAt(0).toUpperCase()
                    : "U"}
                </div>

                <div className="users-user-information">
                  <h3>{user.name || "Unnamed Customer"}</h3>

                  <p className="users-user-email">
                    ✉ {user.email}
                  </p>

                  <p className="users-company">
                    🏢{" "}
                    {user.company_name || "Company not provided"}
                  </p>

                  <span className="users-customer-id">
                    Customer ID: #{user.id}
                  </span>
                </div>

                <div className="users-user-actions">
                  <span
                    className={`users-verification-badge ${
                      user.is_verified
                        ? "users-verified"
                        : "users-not-verified"
                    }`}
                  >
                    {user.is_verified
                      ? "Verified"
                      : "Not Verified"}
                  </span>

                  <button
                    type="button"
                    className="users-activity-button"
                    onClick={() => loadUserActivity(user)}
                  >
                    User Activity →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Users;