import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

import Route from "./Route";
import SavedQuotations from "./SavedQuotations";
import Feedback from "./Feedback";

function UserDashboard() {
  const navigate = useNavigate();

  const [activePage, setActivePage] =
    useState("activity");

  const [currentUser, setCurrentUser] =
    useState(null);

  const [dashboardData, setDashboardData] =
    useState(null);

  const [loadingDashboard, setLoadingDashboard] =
    useState(true);

  const [dashboardError, setDashboardError] =
    useState("");

  /* =========================================================
     LOAD CURRENT USER + DASHBOARD DATA
     ========================================================= */

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoadingDashboard(true);
        setDashboardError("");

        /* =====================================================
           STEP 1 — GET CURRENT USER FROM JWT COOKIE
           ===================================================== */

        const userResponse = await fetch(
          "http://localhost:8000/api/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!userResponse.ok) {
          navigate("/login");
          return;
        }

        const userData =
          await userResponse.json();

        if (
          !userData.success ||
          !userData.user
        ) {
          navigate("/login");
          return;
        }

        setCurrentUser(userData.user);

        /* =====================================================
           STEP 2 — GET DASHBOARD DATA
           ===================================================== */

        const dashboardResponse =
          await fetch(
            "http://localhost:8000/api/user-dashboard/",
            {
              method: "GET",
              credentials: "include",
            }
          );

        if (!dashboardResponse.ok) {
          throw new Error(
            "Failed to load dashboard data."
          );
        }

        const dashboardResult =
          await dashboardResponse.json();

        if (
          dashboardResult.status !==
          "success"
        ) {
          throw new Error(
            dashboardResult.message ||
              "Unable to load dashboard data."
          );
        }

        setDashboardData(
          dashboardResult
        );
      } catch (error) {
        console.error(
          "Dashboard Error:",
          error
        );

        setDashboardError(
          "Unable to load dashboard data at this moment."
        );
      } finally {
        setLoadingDashboard(false);
      }
    };

    loadDashboard();
  }, [navigate, activePage]);

  /* =========================================================
     USER NAME
     ========================================================= */

  const userName =
    currentUser?.name || "User";

  /* =========================================================
     LOGOUT
     ========================================================= */

  const handleLogout = async () => {
    try {
      await fetch(
        "http://localhost:8000/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    } finally {
      navigate("/");
    }
  };

  /* =========================================================
     NAVIGATION
     ========================================================= */

  const handleNavigation = (page) => {
    setActivePage(page);
  };

  /* =========================================================
     KPI VALUES
     ========================================================= */

  const kpis =
    dashboardData?.kpis || {};

  const totalRoutes =
    kpis.total_routes ?? 0;

  const savedQuotations =
    kpis.saved_quotations ?? 0;

  const averageFreightCost =
    Number(
      kpis.average_freight_cost ?? 0
    );

  const averageTransitTime =
    Number(
      kpis.average_transit_time ?? 0
    );

  const approvedQuotations =
    kpis.approved_quotations ?? 0;

  const pendingQuotations =
    kpis.pending_quotations ?? 0;

  const rejectedQuotations =
    kpis.rejected_quotations ?? 0;

  /* =========================================================
     GRAPH DATA
     ========================================================= */

  const graphData =
    dashboardData?.graphs || {};

  /* =========================================================
     GRAPH 1 — QUOTATION STATUS
     ========================================================= */

  const quotationStatus =
    graphData
      ?.quotation_status_overview || {};

  const quotationStatusData = [
    {
      name: "Approved",
      value:
        Number(
          quotationStatus.approved ?? 0
        ),
    },
    {
      name: "Pending",
      value:
        Number(
          quotationStatus.pending ?? 0
        ),
    },
    {
      name: "Rejected",
      value:
        Number(
          quotationStatus.rejected ?? 0
        ),
    },
  ];

  /* =========================================================
     DONUT COLORS
     EXACTLY MATCHING THE LEGEND COLORS
     ========================================================= */

  const quotationStatusColors = [
    "#6C3D25",
    "#C08A45",
    "#A85F4F",
  ];

  /* =========================================================
     GRAPH 2 — FREIGHT COST BY ROUTE
     ========================================================= */

  const freightCostData =
    graphData
      ?.freight_cost_by_route || [];

  /* =========================================================
     GRAPH 3 — TRANSIT TIME
     ========================================================= */

  const transitTimeData =
    graphData
      ?.transit_time_overview || [];

  /* =========================================================
     RECENT ACTIVITY
     ========================================================= */

  const recentActivity =
    dashboardData?.recent_activity || [];

  /* =========================================================
     ACTIVITY LABEL
     ========================================================= */

  const getActivityLabel = (
    activityType
  ) => {
    switch (activityType) {
      case "route_analysis":
        return "Route Analyzed";

      case "route_saved":
        return "Route Saved";

      case "base_cost_calculation":
        return "Base Cost Calculated";

      case "pricing_analysis":
        return "Price Calculated";

      case "quotation_saved":
        return "Quotation Saved";

      case "quotation_approval_requested":
        return "Quotation Approval Requested";

      case "quotation_pdf_downloaded":
        return "Quotation PDF Downloaded";

      default:
        return "Activity";
    }
  };

  /* =========================================================
     ACTIVITY ICON
     ========================================================= */

  const getActivityIcon = (
    activityType
  ) => {
    switch (activityType) {
      case "route_analysis":
        return "⌕";

      case "route_saved":
        return "✓";

      case "base_cost_calculation":
        return "◈";

      case "pricing_analysis":
        return "₹";

      case "quotation_saved":
        return "▥";

      case "quotation_approval_requested":
        return "↗";

      case "quotation_pdf_downloaded":
        return "↓";

      default:
        return "•";
    }
  };

  /* =========================================================
     ACTIVITY DATE
     ========================================================= */

  const formatActivityDate = (
    dateValue
  ) => {
    if (!dateValue) {
      return "";
    }

    const date =
      new Date(dateValue);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="user-dashboard-page">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="user-sidebar">

        <div className="sidebar-header">

          <h2>
            MARITIME
          </h2>

          <p>
            USER DASHBOARD
          </p>

        </div>

        <nav className="sidebar-navigation">

          {/* =================================================
              ACTIVITY
              ================================================= */}

          <button
            className={`sidebar-item ${
              activePage === "activity"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "activity"
              )
            }
          >
            <span className="sidebar-icon">
              ⌂
            </span>

            <span>
              Activity
            </span>
          </button>

          {/* =================================================
              ROUTE INTELLIGENCE
              ================================================= */}

          <div className="sidebar-section">

            <div className="sidebar-section-title">
              ROUTE INTELLIGENCE
            </div>

            <button
              className={`sidebar-item ${
                activePage ===
                "new-route-search"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleNavigation(
                  "new-route-search"
                )
              }
            >
              <span className="sidebar-icon">
                ⌕
              </span>

              <span>
                New Route Search
              </span>
            </button>

          </div>

          {/* =================================================
              PRICE INTELLIGENCE
              ================================================= */}

          <div className="sidebar-section">

            <div className="sidebar-section-title">
              PRICE INTELLIGENCE
            </div>

            <button
              className={`sidebar-item ${
                activePage ===
                "saved-quotations"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleNavigation(
                  "saved-quotations"
                )
              }
            >
              <span className="sidebar-icon">
                ▥
              </span>

              <span>
                Saved Quotations
              </span>
            </button>

          </div>

          {/* =================================================
              FEEDBACK
              ================================================= */}

          <button
            className={`sidebar-item ${
              activePage === "feedback"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "feedback"
              )
            }
          >
            <span className="sidebar-icon">
              ✦
            </span>

            <span>
              Feedback
            </span>
          </button>

        </nav>

        {/* ===================================================
            SIDEBAR BOTTOM
            =================================================== */}

        <div className="sidebar-bottom">

          <div className="logged-user">

            <div className="user-avatar">
              {userName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="logged-user-info">

              <span className="logged-user-label">
                Logged in as
              </span>

              <strong>
                {userName}
              </strong>

            </div>

          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <span>
              ↪
            </span>

            Logout
          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="user-dashboard-main">

        {/* ===================================================
            ACTIVITY DASHBOARD
            =================================================== */}

        {activePage === "activity" && (

          <section className="activity-page">

            {/* =================================================
                PAGE HEADER
                ================================================= */}

            <div className="dashboard-page-header">

              <div>

                <p className="dashboard-eyebrow">
                  MARITIME INTELLIGENCE
                </p>

                <h1>
                  Activity Dashboard
                </h1>

                <p>
                  Monitor your route and freight
                  pricing information from one place.
                </p>

              </div>

            </div>

            {/* =================================================
                ERROR
                ================================================= */}

            {dashboardError && (
              <div className="dashboard-error-message">
                {dashboardError}
              </div>
            )}

            {/* =================================================
                8 KPI CARDS
                ================================================= */}

            <div
              className="dashboard-kpi-grid"
              style={{
                gridTemplateColumns:
                  "repeat(7, minmax(0, 1fr))",
                gap: "14px",
              }}
            >

              {/* KPI 1 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ◉
                </div>

                <div className="kpi-card-content">

                  <span>
                    Total Routes
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : totalRoutes}
                  </strong>

                  <small>
                    Available routes
                  </small>

                </div>

              </div>

              {/* KPI 3 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ▥
                </div>

                <div className="kpi-card-content">

                  <span>
                    Saved Quotations
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : savedQuotations}
                  </strong>

                  <small>
                    Quotations saved by you
                  </small>

                </div>

              </div>

              {/* KPI 4 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  $
                </div>

                <div className="kpi-card-content">

                  <span>
                    Average Freight Cost
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : `$${averageFreightCost.toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}`}
                  </strong>

                  <small>
                    Average per container
                  </small>

                </div>

              </div>

              {/* KPI 5 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ◷
                </div>

                <div className="kpi-card-content">

                  <span>
                    Average Transit Time
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : `${averageTransitTime.toFixed(
                          1
                        )} days`}
                  </strong>

                  <small>
                    Average route transit time
                  </small>

                </div>

              </div>

              {/* KPI 6 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ✓
                </div>

                <div className="kpi-card-content">

                  <span>
                    Approved Quotations
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : approvedQuotations}
                  </strong>

                  <small>
                    Quotations approved by Admin
                  </small>

                </div>

              </div>

              {/* KPI 7 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ◷
                </div>

                <div className="kpi-card-content">

                  <span>
                    Pending Quotations
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : pendingQuotations}
                  </strong>

                  <small>
                    Waiting for Admin review
                  </small>

                </div>

              </div>

              {/* KPI 8 */}

              <div className="dashboard-kpi-card">

                <div className="kpi-card-icon">
                  ×
                </div>

                <div className="kpi-card-content">

                  <span>
                    Rejected Quotations
                  </span>

                  <strong>
                    {loadingDashboard
                      ? "..."
                      : rejectedQuotations}
                  </strong>

                  <small>
                    Quotations rejected by Admin
                  </small>

                </div>

              </div>

            </div>

            {/* =================================================
                GRAPH ROW
                ================================================= */}

            <div
              className="dashboard-graph-grid"
              style={{
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: "18px",
              }}
            >

              {/* =================================================
                  GRAPH 1 — QUOTATION STATUS
                  ================================================= */}

              <div className="dashboard-graph-card">

                <div className="graph-card-header">

                  <h2>
                    Quotation Status Overview
                  </h2>

                  <p>
                    Your quotation approval status
                  </p>

                </div>

                <div className="graph-container">

                  {loadingDashboard ? (

                    <div className="graph-loading">
                      Loading chart...
                    </div>

                  ) : quotationStatusData.every(
                      (item) =>
                        item.value === 0
                    ) ? (

                    <div className="graph-empty">
                      No quotation data available
                    </div>

                  ) : (

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <PieChart>

                        <Pie
                          data={
                            quotationStatusData
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                        >

                          {/* EXACT LEGEND COLORS */}

                          {quotationStatusData.map(
                            (
                              entry,
                              index
                            ) => (

                              <Cell
                                key={`status-${index}`}
                                fill={
                                  quotationStatusColors[
                                    index
                                  ]
                                }
                              />

                            )
                          )}

                        </Pie>

                        <Tooltip />

                        <Legend />

                      </PieChart>

                    </ResponsiveContainer>

                  )}

                </div>

              </div>

              {/* =================================================
                  GRAPH 2 — FREIGHT COST BY ROUTE
                  ================================================= */}

              <div className="dashboard-graph-card">

                <div className="graph-card-header">

                  <h2>
                    Freight Cost by Route
                  </h2>

                  <p>
                    Base freight per container
                  </p>

                </div>

                <div className="graph-container">

                  {loadingDashboard ? (

                    <div className="graph-loading">
                      Loading chart...
                    </div>

                  ) : freightCostData.length ===
                    0 ? (

                    <div className="graph-empty">
                      No route quotation data available
                    </div>

                  ) : (

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart
                        data={
                          freightCostData
                        }
                        margin={{
                          top: 10,
                          right: 15,
                          left: 0,
                          bottom: 45,
                        }}
                      >

                        <CartesianGrid />

                        <XAxis
                          dataKey="route_id"
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />

                        <YAxis />

                        <Tooltip />

                        <Bar
                          dataKey="freight_cost"
                          name="Freight Cost (USD)"
                          fill="#8B5E3C"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  )}

                </div>

              </div>

              {/* =================================================
                  GRAPH 3 — TRANSIT TIME
                  ================================================= */}

              <div className="dashboard-graph-card">

                <div className="graph-card-header">

                  <h2>
                    Transit Time Overview
                  </h2>

                  <p>
                    Transit days by selected route
                  </p>

                </div>

                <div className="graph-container">

                  {loadingDashboard ? (

                    <div className="graph-loading">
                      Loading chart...
                    </div>

                  ) : transitTimeData.length ===
                    0 ? (

                    <div className="graph-empty">
                      No transit time data available
                    </div>

                  ) : (

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <LineChart
                        data={
                          transitTimeData
                        }
                        margin={{
                          top: 10,
                          right: 15,
                          left: 0,
                          bottom: 45,
                        }}
                      >

                        <CartesianGrid />

                        <XAxis
                          dataKey="route_id"
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />

                        <YAxis />

                        <Tooltip />

                        <Line
                          type="monotone"
                          dataKey="transit_days"
                          name="Transit Days"
                          stroke="#8B5E3C"
                          strokeWidth={4}
                          dot={{
                            r: 4,
                          }}
                          activeDot={{
                            r: 6,
                          }}
                        />

                      </LineChart>

                    </ResponsiveContainer>

                  )}

                </div>

              </div>

            </div>

            {/* =================================================
                RECENT ACTIVITY
                ================================================= */}

            <div className="dashboard-section-card">

              <div className="section-card-header">

                <div>

                  <h2>
                    Recent Activity
                  </h2>

                  <p>
                    Your latest route and freight
                    pricing activities will appear here.
                  </p>

                </div>

              </div>

              {/* =================================================
                  LOADING STATE
                  ================================================= */}

              {loadingDashboard ? (

                <div className="empty-activity-state">

                  <div className="empty-activity-icon">
                    ◌
                  </div>

                  <h3>
                    Loading activity...
                  </h3>

                  <p>
                    Fetching your latest activities.
                  </p>

                </div>

              ) : recentActivity.length ===
                0 ? (

                <div className="empty-activity-state">

                  <div className="empty-activity-icon">
                    ◌
                  </div>

                  <h3>
                    No recent activity
                  </h3>

                  <p>
                    Start by analyzing a route to see
                    your activity history here.
                  </p>

                  <button
                    className="primary-dashboard-button"
                    onClick={() =>
                      handleNavigation(
                        "new-route-search"
                      )
                    }
                  >
                    Start New Route Search
                  </button>

                </div>

              ) : (

                <div className="recent-activity-list">

                  {recentActivity.map(
                    (activity) => (

                      <div
                        className="recent-activity-item"
                        key={activity.id}
                      >

                        <div className="recent-activity-icon">

                          {getActivityIcon(
                            activity.activity_type
                          )}

                        </div>

                        <div className="recent-activity-content">

                          <strong>
                            {getActivityLabel(
                              activity.activity_type
                            )}
                          </strong>

                          <p>
                            {activity.description ||
                              "Activity completed"}
                          </p>

                        </div>

                        <div className="recent-activity-date">

                          {formatActivityDate(
                            activity.created_at
                          )}

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          </section>

        )}

        {/* ===================================================
            NEW ROUTE SEARCH
            =================================================== */}

        {activePage === "new-route-search" && (
          <Route />
        )}

        {/* ===================================================
            PRICING ANALYSIS
            =================================================== */}

        {activePage === "saved-quotations" && (
          <SavedQuotations />
        )}

        {/* ===================================================
            FEEDBACK
            =================================================== */}

        {activePage === "feedback" && (
          <Feedback />
        )}

      </main>

    </div>
  );
}

export default UserDashboard;