import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";

import Route from "./Route";
import SavedQuotations from "./SavedQuotations";
import Feedback from "./Feedback";
import UserSettings from "./UserSettings";
import UserIntroduction from "./UserIntroduction";
import MyShipments from "./MyShipments";
import UserPayment from "./UserPayment";

function UserDashboard() {
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState("introduction");

  const [settingsOpen, setSettingsOpen] =
  useState(false);  

  const [currentUser, setCurrentUser] =
    useState(null);

  const [dashboardData, setDashboardData] =
    useState(null);

  const [loadingDashboard, setLoadingDashboard] =
    useState(true);

  const [dashboardError, setDashboardError] =
    useState("");

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notifications, setNotifications] =
    useState([]);

  const [viewedNotificationIds, setViewedNotificationIds] =
    useState(() => {
      try {
        return JSON.parse(localStorage.getItem("user_dashboard_viewed_notifications") || "[]");
      } catch {
        return [];
      }
    });


    

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

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/api/user-dashboard/notifications",
          { credentials: "include" }
        );

        if (!response.ok) return;

        const data = await response.json();
        if (data.status === "success") {
          const allowedNotificationTypes = new Set([
            "quotation_approved",
            "quotation_rejected",
            "feedback_response",
          ]);

          const filteredNotifications = (data.notifications || []).filter(
            (notification) => allowedNotificationTypes.has(notification.type)
          );

          setNotifications(filteredNotifications);
        }
      } catch (error) {
        console.error("Notification loading error:", error);
      }
    };

    loadNotifications();
  }, [activePage]);

  /* =========================================================
     USER NAME
     ========================================================= */

  const userName =
    currentUser?.name || "User";

  const userEmail =
    currentUser?.email || "";

  const userCompany =
    currentUser?.company_name || "";

  const userProfilePicture =
    currentUser?.profile_picture || "";

  const unreadNotifications = notifications.filter(
    (notification) => !viewedNotificationIds.includes(notification.id)
  );

  const markNotificationAsViewed = (notificationId) => {
    if (!notificationId) return;

    const mergedIds = Array.from(
      new Set([...viewedNotificationIds, notificationId])
    ).slice(-100);

    setViewedNotificationIds(mergedIds);

    try {
      localStorage.setItem(
        "user_dashboard_viewed_notifications",
        JSON.stringify(mergedIds)
      );
    } catch (error) {
      console.error("Unable to persist notification state:", error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification) return;

    markNotificationAsViewed(notification.id);
    setNotificationsOpen(false);
    setProfileMenuOpen(false);

    if (notification.type === "quotation_approved" ||
        notification.type === "quotation_rejected") {
      const quotationMatch = String(notification.message || "").match(
        /Quotation #([\w-]+)/i
      );

      if (quotationMatch?.[1]) {
        try {
          sessionStorage.setItem(
            "user_dashboard_notification_target_quotation",
            quotationMatch[1]
          );
        } catch (error) {
          console.error("Unable to store quotation notification target:", error);
        }
      }

      setActivePage("saved-quotations");
      return;
    }

    if (notification.type === "feedback_response") {
      const feedbackMatch = String(notification.message || "").match(
        /feedback #([\w-]+)/i
      );

      if (feedbackMatch?.[1]) {
        try {
          sessionStorage.setItem(
            "user_dashboard_notification_target_feedback",
            feedbackMatch[1]
          );
        } catch (error) {
          console.error("Unable to store feedback notification target:", error);
        }
      }

      setActivePage("feedback");
    }
  };

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

  if (page !== "settings-profile" &&
      page !== "settings-notifications" &&
      page !== "settings-security" &&
      page !== "settings-about") {
    setSettingsOpen(false);
  }
};

  /* =========================================================
     KPI VALUES
     ========================================================= */

  const kpis =
    dashboardData?.kpis || {};

  const totalRoutes =
    kpis.total_routes ?? 0;

  const savedQuotations =
    kpis.total_quotations ?? 0;

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

   const successfulDeliveries = kpis.successful_deliveries ?? 0;

  const paymentsMade = kpis.payments_made ?? 0;

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
     GRAPH 4 — MONTHLY QUOTATION TRENDS
     ========================================================= */

  const monthlyQuotationTrends =
    graphData?.monthly_quotation_trends || [];

  /* =========================================================
     GRAPH 5 — SHIPMENT STATUS OVERVIEW
     ========================================================= */

  const shipmentStatusOverview =
    graphData?.shipment_status_overview || [];

  const shipmentStatusColors = {
    booked: "#C08A45",
    pickup: "#8B5E3C",
    in_transit: "#6C8EAD",
    out_for_delivery: "#A85F4F",
    delivered: "#62866A",
    cancelled: "#888888",
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

          <button
  className={`sidebar-item ${
    activePage === "introduction" ? "active" : ""
  }`}
  onClick={() => handleNavigation("introduction")}
>
  <span className="sidebar-icon">ⓘ</span>
  <span>Getting Started</span>
</button>

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
                My Quotations
              </span>
            </button>

          </div>

          
                
<button
  className={`sidebar-item ${
    activePage === "my-shipments" ? "active" : ""
  }`}
  onClick={() => handleNavigation("my-shipments")}
>
  <span className="sidebar-icon">🚢</span>
  <span>My Shipments</span>
</button>

<button
  className={`sidebar-item ${
    activePage === "my-payments" ? "active" : ""
  }`}
  onClick={() => handleNavigation("my-payments")}
>
  <span className="sidebar-icon">💳</span>
  <span>Payments</span>
</button>


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



          {/* =================================================
    SETTINGS
    ================================================= */}

<div className="sidebar-settings-group">

  {/* SETTINGS MAIN BUTTON */}

  <button
    className={`sidebar-item settings-main-item ${
      activePage === "settings-profile" ||
      activePage === "settings-notifications" ||
      activePage === "settings-security" ||
      activePage === "settings-about"
        ? "active"
        : ""
    }`}
    onClick={() => {
      setSettingsOpen(
        (previous) => !previous
      );

      if (
        activePage !== "settings-profile" &&
        activePage !== "settings-notifications" &&
        activePage !== "settings-security" &&
        activePage !== "settings-about"
      ) {
        setActivePage(
          "settings-profile"
        );
      }
    }}


    
  >
    

    <span className="sidebar-icon">
      ⚙
    </span>

    <span>
      Settings
    </span>

    <span
      className={`settings-chevron ${
        settingsOpen
          ? "open"
          : ""
      }`}
    >
      ▾
    </span>

  </button>

  


  {/* SETTINGS SUBMENU */}

  {settingsOpen && (

    <div className="settings-submenu">

      {/* PROFILE */}

      <button
        className={`settings-submenu-item ${
          activePage ===
          "settings-profile"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setActivePage(
            "settings-profile"
          )
        }
      >
        Profile
      </button>


      {/* NOTIFICATIONS */}

      <button
        className={`settings-submenu-item ${
          activePage ===
          "settings-notifications"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setActivePage(
            "settings-notifications"
          )
        }
      >
        Notifications
      </button>


      {/* SECURITY */}

      <button
        className={`settings-submenu-item ${
          activePage ===
          "settings-security"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setActivePage(
            "settings-security"
          )
        }
      >
        Security
      </button>



      {/* ABOUT */}

      <button
        className={`settings-submenu-item ${
          activePage ===
          "settings-about"
            ? "active"
            : ""
        }`}
        onClick={() =>
          setActivePage(
            "settings-about"
          )
        }
      >
        About
      </button>

    </div>

  )}

</div>


        </nav>

        {/* ===================================================
            SIDEBAR BOTTOM
            =================================================== */}

        <div className="sidebar-bottom">

          <div className="logged-user">

            <div className="user-avatar">
              {userProfilePicture ? (
                <img src={userProfilePicture} alt="Profile" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
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

        <div className="dashboard-topbar">
          <div className="dashboard-topbar-brand">
            <strong>Agentic Maritime Freight Brokerage</strong>
          </div>

          <div className="dashboard-topbar-actions">
            <div className="dashboard-notification-wrap">
              <button
                type="button"
                className="dashboard-icon-button"
                onClick={() => {
                  const willOpen = !notificationsOpen;
                  setNotificationsOpen(willOpen);
                  setProfileMenuOpen(false);
                }}
                aria-label="Notifications"
              >
                <span aria-hidden="true">🔔</span>
                {unreadNotifications.length > 0 && (
                  <span className="dashboard-notification-badge">
                    {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
                  </span>
                )}
              </button>

            </div>

            <div className="dashboard-profile-wrap">
              <button
                type="button"
                className="dashboard-profile-button"
                onClick={() => {
                  setProfileMenuOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
              >
                {userProfilePicture ? (
                  <img src={userProfilePicture} alt="Profile" />
                ) : (
                  <span>{userName.charAt(0).toUpperCase()}</span>
                )}
                <div>
                  <strong>{userName}</strong>
                  <small>{userEmail}</small>
                </div>
                <b>▾</b>
              </button>

              {profileMenuOpen && (
                <div className="dashboard-profile-panel">
                  <div className="dashboard-profile-card">
                    {userProfilePicture ? (
                      <img src={userProfilePicture} alt="Profile" />
                    ) : (
                      <span>{userName.charAt(0).toUpperCase()}</span>
                    )}
                    <div>
                      <strong>{userName}</strong>
                      <p>{userEmail}</p>
                      {userCompany && <p>{userCompany}</p>}
                      {currentUser?.phone_number && <p>{currentUser.phone_number}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage("settings-profile");
                      setSettingsOpen(true);
                      setProfileMenuOpen(false);
                    }}
                  >
                    Edit profile in Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {notificationsOpen && (
          <section className="dashboard-notification-page">
            <div className="dashboard-notification-page-header">
              <div>
                <p className="dashboard-notification-page-eyebrow">
                  USER DASHBOARD
                </p>
                <h1>Notifications</h1>
                <p>
                  View all your recent quotation and account notifications.
                </p>
              </div>

              <button
                type="button"
                className="dashboard-notification-close"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Close notifications"
                title="Close notifications"
              >
                ×
              </button>
            </div>

            <div className="dashboard-notification-page-content">
              <div className="dashboard-notification-page-summary">
                <strong>{notifications.length}</strong>
                <span>Recent Notifications</span>
              </div>

              {notifications.length === 0 ? (
                <div className="dashboard-notification-page-empty">
                  <div className="dashboard-notification-page-empty-icon">
                    ✓
                  </div>
                  <h3>No recent notifications</h3>
                  <p>You are all caught up.</p>
                </div>
              ) : (
                <div className="dashboard-notification-page-list">
                  {notifications.map((notification) => {
                    const isUnread = !viewedNotificationIds.includes(notification.id);

                    return (
                    <button
                      type="button"
                      className={`dashboard-notification-page-item ${isUnread ? "unread" : ""}`}
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="dashboard-notification-page-icon">
                        {notification.icon}
                      </div>
                      <div className="dashboard-notification-page-item-content">
                        <strong>{notification.title}</strong>
                        <p>{notification.message}</p>
                        <small>
                          {formatActivityDate(notification.created_at)}
                        </small>
                      </div>
                      {isUnread && (
                        <span
                          className="dashboard-notification-unread-dot"
                          aria-label="Unread notification"
                          title="Unread notification"
                        />
                      )}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

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
                    Total Quotations
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

            
{/* Successful Deliveries KPI */}
<div className="dashboard-kpi-card">
  <div className="kpi-card-icon">✓</div>

  <div className="kpi-card-content">
    <span>Successful Deliveries</span>

    <strong>
      {loadingDashboard ? "..." : successfulDeliveries}
    </strong>

    <small>Shipments delivered successfully</small>
  </div>
</div>

{/* Payments Made KPI */}
<div className="dashboard-kpi-card">
  <div className="kpi-card-icon">$</div>

  <div className="kpi-card-content">
    <span>Payments Made</span>

    <strong>
      {loadingDashboard ? "..." : paymentsMade}
    </strong>

    <small>Payments verified by Admin</small>
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


          
{/* GRAPH 4 — MONTHLY QUOTATION TRENDS */}
<div className="dashboard-graph-card">
  <div className="graph-card-header">
    <h2>Monthly Quotation Trends</h2>
    <p>Total quotations created each month</p>
  </div>

  <div className="graph-container">
    {loadingDashboard ? (
      <div className="graph-loading">Loading chart...</div>
    ) : monthlyQuotationTrends.length === 0 ? (
      <div className="graph-empty">
        No monthly quotation data available
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={monthlyQuotationTrends}
          layout="vertical"
          margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E5D8C8"
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#6C3D25", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="month"
            width={65}
            tick={{ fill: "#6C3D25", fontSize: 12 }}
          />
          <Tooltip />
          <Bar
            dataKey="created"
            name="Total Quotations"
            fill="#8B5E3C"
            radius={[0, 5, 5, 0]}
            barSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
</div>   
         

  
{/* GRAPH 5 — SHIPMENT STATUS OVERVIEW */}
<div className="dashboard-graph-card">
  <div className="graph-card-header">
    <h2>Shipment Status Overview</h2>
    <p>Current status of your shipments</p>
  </div>

  <div className="graph-container">
    {loadingDashboard ? (
      <div className="graph-loading">Loading chart...</div>
    ) : shipmentStatusOverview.length === 0 ? (
      <div className="graph-empty">
        No shipment data available
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={shipmentStatusOverview}
          margin={{ top: 10, right: 15, left: 0, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="status"
            angle={-20}
            textAnchor="end"
            interval={0}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="count"
            name="Shipments"
            radius={[5, 5, 0, 0]}
          >
            {shipmentStatusOverview.map((item, index) => (
              <Cell
                key={`${item.status}-${index}`}
                fill={
                  shipmentStatusColors[item.status] || "#8B5E3C"
                }
              />
            ))}
          </Bar>
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

             

</div>  



            

            {/* =================================================
                RECENT QUOTATIONS
                ================================================= */}

            <div className="dashboard-section-card recent-quotations-card">
              <div className="section-card-header">
                <div>
                  <h2>Recent Quotations</h2>
                  <p>Your latest quotation requests and current status.</p>
                </div>
                <button
                  type="button"
                  className="view-all-quotations-button"
                  onClick={() => handleNavigation("saved-quotations")}
                >
                  View All
                </button>
              </div>

              {loadingDashboard ? (
                <div className="dashboard-table-empty">Loading quotations...</div>
              ) : (dashboardData?.recent_quotations || []).length === 0 ? (
                <div className="dashboard-table-empty">No quotations available yet.</div>
              ) : (
                <div className="recent-quotations-table-wrap">
                  <table className="recent-quotations-table">
                    <thead>
                      <tr>
                        <th>Quotation ID</th>
                        <th>Date</th>
                        <th>Origin</th>
                        <th>Destination</th>
                        <th>Cargo</th>
                        <th>Container</th>
                        <th>Selling Price</th>
                        <th>Weather</th>
                        <th>Customs</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboardData?.recent_quotations || []).map((quotation) => (
                        <tr key={quotation.quotation_id}>
                          <td>#{quotation.quotation_id}</td>
                          <td>{formatActivityDate(quotation.quotation_date)}</td>
                          <td>{quotation.origin}</td>
                          <td>{quotation.destination}</td>
                          <td>{quotation.cargo_type}</td>
                          <td>{quotation.container_count}</td>
                          <td>${Number(quotation.selling_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>{quotation.weather_condition || "—"}</td>
                          <td>{quotation.customs_status || "—"}</td>
                          <td>
                            <span className={`quotation-status-badge ${quotation.status || "pending"}`}>
                              {quotation.status || "pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>


            
{/* RECENT SHIPMENTS */}
<div className="dashboard-section-card recent-shipments-card">
  <div className="section-card-header">
    <div>
      <h2>Recent Shipments</h2>
      <p>Your latest shipment updates</p>
    </div>

    <button
      type="button"
      className="view-all-button"
      onClick={() => setActivePage("my-shipments")}
    >
      View All
    </button>
  </div>

  <div className="recent-shipments-content">
    {loadingDashboard ? (
      <div className="empty-state">Loading shipments...</div>
    ) : !dashboardData?.recent_shipments?.length ? (
      <div className="empty-state">
        <h3>No Shipments Yet</h3>
        <p>Your booked shipments will appear here.</p>
      </div>
    ) : (
      <div className="recent-shipments-table-wrapper">
        <table className="recent-shipments-table">
          <thead>
            <tr>
              <th>Shipment ID</th>
              <th>Route ID</th>
              <th>Origin</th>
              <th>Destination</th>
              <th>Shipment Date</th>
              <th>Shipment Status</th>
              <th>Payment Status</th>
            </tr>
          </thead>

          <tbody>
            {dashboardData.recent_shipments
              .slice(0, 10)
              .map((shipment, index) => {
                const status = (shipment.status || "unknown")
                  .toLowerCase()
                  .replace(/_/g, "-");

                const paymentStatus = (
                  shipment.payment_status || "No Payment"
                ).toLowerCase().replace(/[\s_]+/g, "-");

                return (
                  <tr key={shipment.shipment_id || index}>
                    <td>
                      <strong>{shipment.shipment_id || "—"}</strong>
                    </td>

                    <td>{shipment.route_id || "—"}</td>
                    <td>{shipment.origin || "—"}</td>
                    <td>{shipment.destination || "—"}</td>

                    <td>
                      {shipment.shipment_date
                        ? new Date(
                            shipment.shipment_date
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>
                      <span
                        className={`shipment-status-badge shipment-status-${status}`}
                      >
                        {(shipment.status || "Unknown")
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, char => char.toUpperCase())}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`shipment-payment-badge payment-status-${paymentStatus}`}
                      >
                        {shipment.payment_status || "No Payment"}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    )}
  </div>
</div>


          </section>

        )}


        {activePage === "introduction" && (
  <UserIntroduction
    userName={userName}
    onNavigate={handleNavigation}
  />
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

        {/* ===================================================
    SETTINGS
    =================================================== */}

{activePage === "settings-profile" && (
  <UserSettings section="profile" />
)}

{activePage === "settings-notifications" && (
  <UserSettings section="notifications" />
)}

{activePage === "settings-security" && (
  <UserSettings section="security" />
)}

{activePage === "settings-about" && (
  <UserSettings section="about" />
)}


{activePage === "my-shipments" && (
  <MyShipments />
)}

{activePage === "my-payments" && <UserPayment />}

{activePage === "saved-quotations" && (
  <SavedQuotations />
)}

      </main>

    </div>
  );
}

export default UserDashboard;