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

  const getStatus = (status) => {
    const normalizedStatus = (status || "pending")
      .trim()
      .toLowerCase();

    if (normalizedStatus === "approved") {
      return {
        label: "Approved",
        className: "users-status-approved",
      };
    }

    if (normalizedStatus === "rejected") {
      return {
        label: "Rejected",
        className: "users-status-rejected",
      };
    }

    if (normalizedStatus === "pending") {
      return {
        label: "Pending",
        className: "users-status-pending",
      };
    }

    return {
      label: normalizedStatus
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
      pending_quotations: 0,
      rejected_quotations: 0,
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
                  <h3>Quotation Summary</h3>
                  <p>
                    Overview of this customer's quotation requests.
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
                    <span>Approved</span>
                    <span className="users-summary-icon">✓</span>
                  </div>

                  <strong>{summary.approved_quotations}</strong>
                  <small>Approved quotations</small>
                </div>

                <div className="users-summary-card users-summary-pending">
                  <div className="users-summary-top">
                    <span>Pending</span>
                    <span className="users-summary-icon">◷</span>
                  </div>

                  <strong>{summary.pending_quotations}</strong>
                  <small>Awaiting a decision</small>
                </div>

                <div className="users-summary-card users-summary-rejected">
                  <div className="users-summary-top">
                    <span>Rejected</span>
                    <span className="users-summary-icon">×</span>
                  </div>

                  <strong>{summary.rejected_quotations}</strong>
                  <small>Rejected quotations</small>
                </div>
              </div>
            </section>

            {/* QUOTATION DETAILS TABLE */}

            <section className="users-panel users-quotation-panel">
              <div className="users-table-heading">
                <div>
                  <h3>Quotation Details</h3>
                  <p>
                    All quotations created by this customer.
                  </p>
                </div>

                <span className="users-record-count">
                  {quotations.length}{" "}
                  {quotations.length === 1
                    ? "Quotation"
                    : "Quotations"}
                </span>
              </div>

              {quotations.length === 0 ? (
                <div className="users-empty-state">
                  <div className="users-state-icon">📄</div>
                  <h3>No quotations found</h3>
                  <p>
                    This customer has not created any quotations yet.
                  </p>
                </div>
              ) : (
                <div className="users-table-wrapper">
                  <table className="users-quotation-table">
                    <thead>
                      <tr>
                        <th>Quotation ID</th>
                        <th>Origin</th>
                        <th>Destination</th>
                        <th>Cargo Type</th>
                        <th>Containers</th>
                        <th>Selected Route</th>
                        <th>Selling Price</th>
                        <th>Status</th>
                        <th>Created Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {quotations.map((quotation) => {
                        const status = getStatus(quotation.status);

                        return (
                          <tr key={quotation.id}>
                            <td className="users-quotation-id">
                              #{quotation.id}
                            </td>

                            <td>{quotation.origin || "—"}</td>

                            <td>{quotation.destination || "—"}</td>

                            <td>{quotation.cargo_type || "—"}</td>

                            <td>
                              <div className="users-container-info">
                                <strong>
                                  {quotation.container_count ?? "—"}
                                </strong>

                                <small>
                                  {quotation.container_type || ""}
                                </small>
                              </div>
                            </td>

                            <td>
                              {quotation.selected_route_id || "—"}
                            </td>

                            <td className="users-selling-price">
                              {formatPrice(quotation.selling_price)}
                            </td>

                            <td>
                              <span
                                className={`users-status-badge ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </td>

                            <td>
                              {formatDate(quotation.created_at)}
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