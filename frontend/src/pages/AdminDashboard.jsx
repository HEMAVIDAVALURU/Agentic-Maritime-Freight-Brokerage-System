import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

import "./AdminDashboard.css";

import Users from "./Users";
import AdminRoutes from "./AdminRoutes";
import AdminPricing from "./AdminPricing";
import AdminWeather from "./AdminWeather";
import AdminCustom from "./AdminCustom";
import AdminQuotation from "./AdminQuotation";
import AdminFeedback from "./AdminFeedback";
import AdminSettings from "./AdminSettings";

function AdminDashboard() {
  const [activePage, setActivePage] =
    useState("dashboard");

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const [adminProfile, setAdminProfile] =
    useState({
      name: "Admin",
      email: "",
      mobile_number: "",
      city: "",
      gender: "",
    });

  const [adminNotifications, setAdminNotifications] =
    useState([]);

  const [notificationsLoading, setNotificationsLoading] =
    useState(false);

  const [notificationsError, setNotificationsError] =
    useState("");

  const [readNotificationIds, setReadNotificationIds] =
    useState(() => {
      try {
        const stored = localStorage.getItem(
          "admin_notification_read_ids"
        );
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });

  const [kpiData, setKpiData] = useState({
    total_users: 0,
    total_quotations: 0,
    pending_quotations: 0,
    approved_quotations: 0,
    rejected_quotations: 0,
    monthly_quotations: 0,
    total_selling_price: 0,
    total_profit: 0,
    total_loss: 0,
    net_profit: 0,
  });

  const [monthlyProfitData, setMonthlyProfitData] =
    useState([]);

  const [monthlyQuotationData, setMonthlyQuotationData] =
    useState([]);

  const [currentMonthSummary, setCurrentMonthSummary] =
    useState({
      month: "",
      total_quotations: 0,
      approved_quotations: 0,
      rejected_quotations: 0,
      pending_quotations: 0,
    });

  const [recentQuotations, setRecentQuotations] =
    useState([]);

  const [kpiLoading, setKpiLoading] =
    useState(true);

  const [kpiError, setKpiError] =
    useState("");

  // =========================================================
  // SIDEBAR MENU
  // =========================================================

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "▦",
    },
    {
      id: "users",
      label: "Users",
      icon: "◉",
    },
    {
      id: "routes",
      label: "Routes",
      icon: "⌁",
    },
    {
      id: "pricing",
      label: "Pricing",
      icon: "$",
    },
    {
      id: "weather",
      label: "Weather",
      icon: "☁",
    },
    {
      id: "customs",
      label: "Customs",
      icon: "▤",
    },
    {
      id: "quotation",
      label: "Quotation",
      icon: "▣",
    },
    {
      id: "shipment",
      label: "Shipment",
      icon: "◆",
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: "◇",
    },
  ];

  // =========================================================
  // SETTINGS SUBMENU
  // =========================================================

  const settingsItems = [
    {
      id: "settings-profile",
      label: "Profile",
      icon: "👤",
    },
    {
      id: "settings-notifications",
      label: "Notifications",
      icon: "🔔",
    },
    {
      id: "settings-security",
      label: "Security",
      icon: "🔒",
    },
    {
      id: "settings-about",
      label: "About",
      icon: "ℹ️",
    },
  ];

  // =========================================================
  // FETCH ADMIN DASHBOARD
  // =========================================================

  useEffect(() => {
    fetchAdminDashboard();
    fetchAdminProfile();
    fetchAdminNotifications();
  }, []);

  const fetchAdminNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError("");

    try {
      const [quotationResponse, feedbackResponse] =
        await Promise.all([
          fetch("/api/admin-quotations/", {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
          fetch("http://localhost:8000/api/feedback/admin", {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
        ]);

      if (!quotationResponse.ok) {
        throw new Error("Unable to load quotation notifications.");
      }

      if (!feedbackResponse.ok) {
        throw new Error("Unable to load feedback notifications.");
      }

      const quotationData = await quotationResponse.json();
      const feedbackData = await feedbackResponse.json();

      const quotationList = Array.isArray(quotationData)
        ? quotationData
        : Array.isArray(quotationData.quotations)
        ? quotationData.quotations
        : [];

      const feedbackList = Array.isArray(feedbackData.feedback)
        ? feedbackData.feedback
        : [];

      const quotationNotifications = quotationList
        .filter((item) =>
          String(item.status || "").toLowerCase() === "pending"
        )
        .map((item) => ({
          id: `quotation-${item.id ?? item.quotation_id}`,
          type: "quotation",
          targetId: item.id ?? item.quotation_id,
          title: "Quotation Approval Request",
          message: `${item.customer?.name || item.customer_name || "Customer"} requested approval for quotation #${item.id ?? item.quotation_id}.`,
          createdAt: item.created_at,
        }));

      const feedbackNotifications = feedbackList.map((item) => ({
        id: `feedback-${item.id}`,
        type: "feedback",
        targetId: item.id,
        title: "New Customer Feedback",
        message: `${item.customer?.name || item.customer_name || "Customer"} submitted feedback${item.quotation_id ? ` for quotation #${item.quotation_id}` : ""}.`,
        createdAt: item.created_at,
      }));

      const merged = [
        ...quotationNotifications,
        ...feedbackNotifications,
      ].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      setAdminNotifications(merged);
    } catch (error) {
      console.error("Admin notifications loading error:", error);
      setNotificationsError(
        error.message || "Unable to load notifications."
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAdminNotificationRead = (notification) => {
    setReadNotificationIds((previous) => {
      if (previous.includes(notification.id)) {
        return previous;
      }

      const updated = [...previous, notification.id];

      try {
        localStorage.setItem(
          "admin_notification_read_ids",
          JSON.stringify(updated)
        );
      } catch {
        // Local storage is optional; the in-memory state still works.
      }

      return updated;
    });
  };

  const handleAdminNotificationOpen = (notification) => {
    markAdminNotificationRead(notification);

    sessionStorage.setItem(
      "admin_notification_target",
      JSON.stringify({
        type: notification.type,
        id: notification.targetId,
      })
    );

    if (notification.type === "quotation") {
      setActivePage("quotation");
    } else {
      setActivePage("feedback");
    }
  };

  const fetchAdminProfile = async () => {
    try {
      const response = await fetch(
        "/api/admin/settings/profile",
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setAdminProfile({
        name: data.name || "Admin",
        email: data.email || "",
        mobile_number: data.mobile_number || "",
        city: data.city || "",
        gender: data.gender || "",
      });
    } catch (error) {
      console.error("Admin profile loading error:", error);
    }
  };

  // =========================================================
  // ADMIN LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.error(
          "Logout API failed:",
          response.status
        );
      }
    } catch (error) {
      console.error(
        "Admin Logout Error:",
        error
      );
    } finally {
      window.location.href = "/";
    }
  };

  // =========================================================
  // FETCH DASHBOARD DATA
  // =========================================================

  const fetchAdminDashboard = async () => {
    try {
      setKpiLoading(true);
      setKpiError("");

      const response = await fetch(
        "/api/admin-dashboard/",
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
            "Authentication required. Please login again."
          );
        }

        throw new Error(
          "Unable to load dashboard data."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message ||
            "Unable to load dashboard data."
        );
      }

      const kpis = data.kpis || {};

      setKpiData({
        total_users:
          kpis.total_users || 0,

        total_quotations:
          kpis.total_quotations || 0,

        pending_quotations:
          kpis.pending_quotations || 0,

        approved_quotations:
          kpis.approved_quotations || 0,

        rejected_quotations:
          kpis.rejected_quotations || 0,

        monthly_quotations:
          kpis.monthly_quotations || 0,

        total_selling_price:
          kpis.total_selling_price || 0,

        total_profit:
          kpis.total_profit || 0,

        total_loss:
          kpis.total_loss || 0,

        net_profit:
          kpis.net_profit || 0,
      });

      setMonthlyProfitData(
        Array.isArray(data.monthly_profit)
          ? data.monthly_profit
          : []
      );

      setMonthlyQuotationData(
        Array.isArray(data.monthly_quotations)
          ? data.monthly_quotations
          : []
      );

      setCurrentMonthSummary(
        data.current_month_summary || {
          month: "",
          total_quotations: 0,
          approved_quotations: 0,
          rejected_quotations: 0,
          pending_quotations: 0,
        }
      );

      setRecentQuotations(
        Array.isArray(data.recent_quotations)
          ? data.recent_quotations.slice(0, 10)
          : []
      );
    } catch (error) {
      console.error(
        "Admin Dashboard Error:",
        error
      );

      setKpiError(
        error.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setKpiLoading(false);
    }
  };

  // =========================================================
  // CURRENCY FORMAT
  // =========================================================

  const formatCurrency = (value) => {
    return `$${Number(
      value || 0
    ).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // =========================================================
  // KPI CARDS
  // =========================================================

  const firstRowKpis = [
    {
      title: "Total Users",
      value: kpiData.total_users,
      icon: "◉",
    },
    {
      title: "Total Quotations",
      value: kpiData.total_quotations,
      icon: "▣",
    },
    {
      title: "Pending Quotations",
      value: kpiData.pending_quotations,
      icon: "◷",
    },
    {
      title: "Approved Quotations",
      value: kpiData.approved_quotations,
      icon: "✓",
    },
    {
      title: "Rejected Quotations",
      value: kpiData.rejected_quotations,
      icon: "×",
    },
  ];

  const secondRowKpis = [
    {
      title: "Total Selling Price",
      value: formatCurrency(
        kpiData.total_selling_price
      ),
      icon: "$",
    },
    {
      title: "Total Profit",
      value: formatCurrency(
        kpiData.total_profit
      ),
      icon: "↗",
    },
    {
      title: "Total Loss",
      value: formatCurrency(
        kpiData.total_loss
      ),
      icon: "↘",
    },
    {
      title: "Net Profit",
      value: formatCurrency(
        kpiData.net_profit
      ),
      icon: "$",
      className: "admin-kpi-net-profit",
    },
  ];

  const renderKpiCard = (item) => (
    <div
      key={item.title}
      className={`admin-kpi-card ${
        item.className || ""
      }`}
    >
      <div className="admin-kpi-top">
        <div className="admin-kpi-icon">
          {item.icon}
        </div>
      </div>

      <div className="admin-kpi-details">
        <span className="admin-kpi-title">
          {item.title}
        </span>

        <strong className="admin-kpi-value">
          {item.value}
        </strong>
      </div>
    </div>
  );

  // =========================================================
  // DONUT CHART DATA
  // =========================================================

  const quotationStatusData = [
    {
      name: "Approved",
      value: Number(
        kpiData.approved_quotations || 0
      ),
    },
    {
      name: "Pending",
      value: Number(
        kpiData.pending_quotations || 0
      ),
    },
    {
      name: "Rejected",
      value: Number(
        kpiData.rejected_quotations || 0
      ),
    },
  ];

  const quotationStatusColors = [
    "#6b8e23",
    "#c28b36",
    "#a0523d",
  ];

  // =========================================================
  // SETTINGS NAVIGATION
  // =========================================================

  const handleSettingsClick = () => {
    setSettingsOpen((previous) => !previous);
  };

  const handleSettingsSectionClick = (
    section
  ) => {
    setActivePage(section);
    setSettingsOpen(true);
    setProfileMenuOpen(false);
  };

  const handleAdminProfileClick = () => {
    setProfileMenuOpen((previous) => !previous);
    setSettingsOpen(false);
  };

  const handleAdminNotificationsClick = () => {
    setActivePage("admin-notifications");
    setSettingsOpen(false);
    setProfileMenuOpen(false);
    fetchAdminNotifications();
  };

  // =========================================================
  // DERIVED NOTIFICATION COUNT
  // =========================================================

  const unreadAdminNotificationCount = adminNotifications.filter(
    (item) => !readNotificationIds.includes(item.id)
  ).length;

  // =========================================================
  // MAIN CONTENT
  // =========================================================

  return (
    <div className="admin-dashboard">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="admin-sidebar">

        <div className="admin-sidebar-header">
          <div className="admin-logo">
            AI
          </div>

          <div className="admin-brand">
            <h2>Maritime AI</h2>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-sidebar-menu">

          <p className="admin-sidebar-title">
            MANAGEMENT
          </p>

          {/* NORMAL MENU ITEMS */}

          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-sidebar-item ${
                activePage === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActivePage(item.id)
              }
            >
              <span className="admin-sidebar-icon">
                {item.icon}
              </span>

              <span className="admin-sidebar-label">
                {item.label}
              </span>
            </button>
          ))}

          {/* =================================================
              SETTINGS MAIN ITEM
          ================================================= */}

          <button
            type="button"
            className={`admin-sidebar-item admin-settings-main-item ${
              settingsOpen ||
              activePage.startsWith(
                "settings-"
              )
                ? "active"
                : ""
            }`}
            onClick={handleSettingsClick}
          >
            <span className="admin-sidebar-icon">
              ⚙
            </span>

            <span className="admin-sidebar-label">
              Settings
            </span>

            <span
              className={`admin-settings-arrow ${
                settingsOpen
                  ? "open"
                  : ""
              }`}
            >
              ▾
            </span>
          </button>

          {/* =================================================
              SETTINGS SUBMENU
          ================================================= */}

          {settingsOpen && (
            <div className="admin-settings-submenu">

              {settingsItems.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-settings-submenu-item ${
                      activePage ===
                      item.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleSettingsSectionClick(
                        item.id
                      )
                    }
                  >
                    <span className="admin-settings-submenu-icon">
                      {item.icon}
                    </span>

                    <span>
                      {item.label}
                    </span>
                  </button>
                )
              )}

            </div>
          )}

        </nav>

        {/* =================================================
            LOGOUT
        ================================================= */}

        <div className="admin-sidebar-bottom">

          <div className="admin-logged-user">
            <div className="admin-logged-user-avatar">
              {(adminProfile.name || "Admin")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="admin-logged-user-info">
              <span>Logged in as</span>
              <strong>
                {adminProfile.name || "Admin"}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
          >
            <span className="admin-sidebar-icon">
              ⇥
            </span>

            <span>Logout</span>
          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <main className="admin-main">

        {/* =================================================
            ADMIN TOP BAR
        ================================================= */}

        {activePage !== "dashboard" && (
        <div className="admin-topbar">
          <div className="admin-topbar-brand">
            <strong>Agentic Maritime Freight Brokerage</strong>
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-topbar-icon-button"
              onClick={handleAdminNotificationsClick}
              aria-label="Notifications"
              title="Notifications"
            >
              <span className="admin-notification-bell-icon">🔔</span>
              {unreadAdminNotificationCount > 0 && (
                <span
                  className="admin-notification-count-badge"
                  aria-label={`${unreadAdminNotificationCount} unread notifications`}
                >
                  {unreadAdminNotificationCount > 99
                    ? "99+"
                    : unreadAdminNotificationCount}
                </span>
              )}
            </button>

            <div className="admin-profile-wrap">
              <button
                type="button"
                className="admin-profile-button"
                onClick={handleAdminProfileClick}
                aria-expanded={profileMenuOpen}
              >
                <span className="admin-profile-initial">
                  {(adminProfile.name || "Admin")
                    .charAt(0)
                    .toUpperCase()}
                </span>

                <div className="admin-profile-text">
                  <strong>
                    {adminProfile.name || "Admin"}
                  </strong>
                  <small>
                    {adminProfile.email || "Administrator"}
                  </small>
                </div>

                <b>▾</b>
              </button>

              {profileMenuOpen && (
                <div className="admin-profile-panel">
                  <div className="admin-profile-panel-card">
                    <span className="admin-profile-panel-initial">
                      {(adminProfile.name || "Admin")
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <div>
                      <strong>
                        {adminProfile.name || "Admin"}
                      </strong>
                      <p>
                        {adminProfile.email || ""}
                      </p>
                      {adminProfile.mobile_number && (
                        <p>{adminProfile.mobile_number}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleSettingsSectionClick(
                        "settings-profile"
                      )
                    }
                  >
                    Edit profile in Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

            )}   

        {/* =================================================
            ADMIN NOTIFICATIONS
        ================================================= */}

        {activePage === "admin-notifications" && (
          <section className="admin-notifications-page">
            <header className="admin-notifications-header">
              <div>
                <span className="admin-notifications-eyebrow">
                  ADMIN NOTIFICATIONS
                </span>
                <h1>Notifications</h1>
                <p>
                  Review quotation approval requests and customer feedback.
                </p>
              </div>

              <button
                type="button"
                className="admin-notifications-refresh"
                onClick={fetchAdminNotifications}
                disabled={notificationsLoading}
              >
                {notificationsLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </header>

            <section className="admin-notifications-card">
              <div className="admin-notifications-card-header">
                <div>
                  <strong>{adminNotifications.length}</strong>
                  <span>Recent Notifications</span>
                </div>
                <span className="admin-notifications-unread-count">
                  {adminNotifications.filter(
                    (item) => !readNotificationIds.includes(item.id)
                  ).length} unread
                </span>
              </div>

              {notificationsError ? (
                <div className="admin-notifications-message error">
                  {notificationsError}
                </div>
              ) : notificationsLoading ? (
                <div className="admin-notifications-message">
                  Loading notifications...
                </div>
              ) : adminNotifications.length === 0 ? (
                <div className="admin-notifications-message">
                  No quotation requests or customer feedback notifications.
                </div>
              ) : (
                <div className="admin-notifications-list">
                  {adminNotifications.map((notification) => {
                    const isUnread = !readNotificationIds.includes(
                      notification.id
                    );

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        className={`admin-notification-item ${
                          isUnread ? "unread" : ""
                        }`}
                        onClick={() =>
                          handleAdminNotificationOpen(notification)
                        }
                      >
                        <span className="admin-notification-icon">
                          {notification.type === "quotation" ? "▣" : "◇"}
                        </span>

                        <span className="admin-notification-content">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>
                            {notification.createdAt
                              ? new Date(
                                  notification.createdAt
                                ).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Date unavailable"}
                          </small>
                        </span>

                        {isUnread && (
                          <span
                            className="admin-notification-unread-dot"
                            aria-label="Unread notification"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activePage === "dashboard" && (
          <div className="admin-dashboard-content">

            {/* DASHBOARD HEADER */}

            <div className="admin-dashboard-header">

              <div className="admin-dashboard-header-text">

                <h1>
                  Agentic AI for Maritime
                  Freight Pricing and Route
                  Optimization
                </h1>

                <p>
                  Monitor users, quotations,
                  financial performance, and
                  overall business activity.
                </p>

              </div>

              <div className="admin-dashboard-header-actions admin-topbar-actions">
                <button
                  type="button"
                  className="admin-topbar-icon-button"
                  onClick={handleAdminNotificationsClick}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <span className="admin-notification-bell-icon">🔔</span>
                  {unreadAdminNotificationCount > 0 && (
                    <span
                      className="admin-notification-count-badge"
                      aria-label={`${unreadAdminNotificationCount} unread notifications`}
                    >
                      {unreadAdminNotificationCount > 99
                        ? "99+"
                        : unreadAdminNotificationCount}
                    </span>
                  )}
                </button>

                <div className="admin-profile-wrap">
                  <button
                    type="button"
                    className="admin-profile-button"
                    onClick={handleAdminProfileClick}
                    aria-expanded={profileMenuOpen}
                  >
                    <span className="admin-profile-initial">
                      {(adminProfile.name || "Admin")
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <div className="admin-profile-text">
                      <strong>
                        {adminProfile.name || "Admin"}
                      </strong>
                      <small>
                        {adminProfile.email || "Administrator"}
                      </small>
                    </div>

                    <b>▾</b>
                  </button>

                  {profileMenuOpen && (
                    <div className="admin-profile-panel">
                      <div className="admin-profile-panel-card">
                        <span className="admin-profile-panel-initial">
                          {(adminProfile.name || "Admin")
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <div>
                          <strong>
                            {adminProfile.name || "Admin"}
                          </strong>
                          <p>
                            {adminProfile.email || ""}
                          </p>
                          {adminProfile.mobile_number && (
                            <p>{adminProfile.mobile_number}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleSettingsSectionClick(
                            "settings-profile"
                          )
                        }
                      >
                        Edit profile in Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* KPI SECTION */}

            <section className="admin-kpi-section">

              {kpiLoading ? (
                <div className="admin-kpi-loading">
                  Loading dashboard data...
                </div>
              ) : (
                <div className="admin-kpi-grid">

                  <div className="admin-kpi-row admin-kpi-row-five">
                    {firstRowKpis.map(
                      renderKpiCard
                    )}
                  </div>

                  <div className="admin-kpi-row admin-kpi-row-four">
                    {secondRowKpis.map(
                      renderKpiCard
                    )}
                  </div>

                </div>
              )}

              {kpiError && (
                <div className="admin-kpi-error">
                  {kpiError}
                </div>
              )}

            </section>

            {/* CHARTS */}

            {!kpiLoading &&
              !kpiError && (
                <section className="admin-charts-section">

                  <div className="admin-section-heading">

                    <h2>
                      Performance Overview
                    </h2>

                    <p>
                      Quotation distribution
                      and monthly financial
                      performance.
                    </p>

                  </div>

                  <div className="admin-charts-grid">

                    {/* QUOTATION STATUS */}

                    <div className="admin-chart-card">

                      <div className="admin-chart-header">

                        <h3>
                          Quotation Status
                        </h3>

                        <span>
                          Current quotation
                          distribution
                        </span>

                      </div>

                      <div className="admin-donut-wrapper">

                        <ResponsiveContainer
                          width="100%"
                          height={280}
                        >
                          <PieChart>

                            <Pie
                              data={
                                quotationStatusData
                              }
                              cx="50%"
                              cy="45%"
                              innerRadius={60}
                              outerRadius={88}
                              paddingAngle={3}
                              dataKey="value"
                              label={({
                                value,
                              }) =>
                                value
                              }
                              labelLine={
                                false
                              }
                            >

                              {quotationStatusData.map(
                                (
                                  entry,
                                  index
                                ) => (
                                  <Cell
                                    key={`cell-${index}`}
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

                            <Legend
                              verticalAlign="bottom"
                              height={36}
                            />

                          </PieChart>
                        </ResponsiveContainer>

                      </div>

                    </div>

                    {/* MONTHLY PROFIT */}

                    <div className="admin-chart-card">

                      <div className="admin-chart-header">

                        <h3>
                          Monthly Profit
                        </h3>

                        <span>
                          Monthly profit
                          performance
                        </span>

                      </div>

                      <ResponsiveContainer
                        width="100%"
                        height={280}
                      >

                        <LineChart
                          data={
                            monthlyProfitData
                          }
                          margin={{
                            top: 25,
                            right: 15,
                            left: 0,
                            bottom: 5,
                          }}
                        >

                          <CartesianGrid
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="month"
                          />

                          <YAxis
                            tickFormatter={(
                              value
                            ) =>
                              `$${Number(
                                value
                              ).toLocaleString()}`
                            }
                          />

                          <Tooltip
                            formatter={(
                              value
                            ) =>
                              formatCurrency(
                                value
                              )
                            }
                          />

                          <Line
                            type="monotone"
                            dataKey="profit"
                            name="Profit"
                            stroke="#795235"
                            strokeWidth={3}
                            dot={{
                              r: 5,
                              fill: "#795235",
                            }}
                            activeDot={{
                              r: 7,
                            }}
                            label={{
                              position:
                                "top",
                              formatter: (
                                value
                              ) =>
                                `$${Number(
                                  value
                                ).toLocaleString()}`,
                              fill:
                                "#4a2d1d",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />

                        </LineChart>

                      </ResponsiveContainer>

                    </div>

                    {/* MONTHLY QUOTATIONS */}

                    <div className="admin-chart-card">

                      <div className="admin-chart-header">

                        <h3>
                          Monthly Quotations
                        </h3>

                        <span>
                          Quotation activity
                          by month
                        </span>

                      </div>

                      <ResponsiveContainer
                        width="100%"
                        height={280}
                      >

                        <BarChart
                          data={
                            monthlyQuotationData
                          }
                          margin={{
                            top: 25,
                            right: 15,
                            left: 0,
                            bottom: 5,
                          }}
                        >

                          <CartesianGrid
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="month"
                          />

                          <YAxis
                            allowDecimals={
                              false
                            }
                          />

                          <Tooltip />

                          <Bar
                            dataKey="quotations"
                            name="Quotations"
                            fill="#8b5e3c"
                            radius={[
                              5,
                              5,
                              0,
                              0,
                            ]}
                            label={{
                              position:
                                "top",
                              fill:
                                "#4a2d1d",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>

                  </div>

                </section>
              )}

            {/* RECENT QUOTATIONS */}

            {!kpiLoading &&
              !kpiError && (
                <section className="admin-recent-quotations-section">

                  <div className="admin-section-heading">

                    <div>
                      <h2>
                        Recent Quotations
                      </h2>

                      <p>
                        Latest 10 quotations
                      </p>
                    </div>

                    <button
                      type="button"
                      className="admin-view-all-btn"
                      onClick={() =>
                        setActivePage(
                          "quotation"
                        )
                      }
                    >
                      View All →
                    </button>

                  </div>

                  <div className="admin-recent-table-wrapper">

                    <table className="admin-recent-table">

                      <thead>

                        <tr>
                          <th>
                            Quotation ID
                          </th>

                          <th>
                            Route ID
                          </th>

                          <th>
                            Origin
                          </th>

                          <th>
                            Destination
                          </th>

                          <th>
                            Container Type
                          </th>

                          <th>
                            Total Selling
                            Price
                          </th>

                          <th>
                            Profit
                          </th>

                          <th>
                            Weather Risk
                          </th>

                          <th>
                            Customs Status
                          </th>

                          <th>
                            Quotation Status
                          </th>
                        </tr>

                      </thead>

                      <tbody>

                        {recentQuotations.length >
                        0 ? (
                          recentQuotations
                            .slice(
                              0,
                              10
                            )
                            .map(
                              (
                                quotation,
                                index
                              ) => {

                                const weatherRisk =
                                  String(
                                    quotation.weather_risk ||
                                      "—"
                                  ).toUpperCase();

                                const customsStatus =
                                  String(
                                    quotation.customs_status ||
                                      "—"
                                  ).toLowerCase();

                                const status =
                                  String(
                                    quotation.status ||
                                      "unknown"
                                  )
                                    .trim()
                                    .toLowerCase();

                                const statusLabel =
                                  status ===
                                  "approved"
                                    ? "Approved"
                                    : status ===
                                      "pending"
                                    ? "Pending"
                                    : status ===
                                      "rejected"
                                    ? "Rejected"
                                    : "Unknown";

                                return (
                                  <tr
                                    key={
                                      quotation.quotation_id ??
                                      quotation.id ??
                                      index
                                    }
                                  >

                                    <td className="admin-recent-quotation-id">
                                      #
                                      {quotation.quotation_id ??
                                        quotation.id ??
                                        "—"}
                                    </td>

                                    <td>
                                      {quotation.route_id ??
                                        quotation.selected_route_id ??
                                        "—"}
                                    </td>

                                    <td>
                                      {quotation.origin ||
                                        "—"}
                                    </td>

                                    <td>
                                      {quotation.destination ||
                                        "—"}
                                    </td>

                                    <td>
                                      {quotation.container_type ||
                                        "—"}
                                    </td>

                                    <td className="admin-recent-money">
                                      {formatCurrency(
                                        quotation.total_selling_price ??
                                          quotation.selling_price ??
                                          quotation.final_selling_price_usd ??
                                          0
                                      )}
                                    </td>

                                    <td className="admin-recent-money">
                                      {quotation.profit !=
                                      null
                                        ? formatCurrency(
                                            quotation.profit
                                          )
                                        : "—"}
                                    </td>

                                    <td>
                                      <span
                                        className={`admin-risk-badge admin-risk-${weatherRisk.toLowerCase()}`}
                                      >
                                        {
                                          weatherRisk
                                        }
                                      </span>
                                    </td>

                                    <td>
                                      <span
                                        className={`admin-customs-badge admin-customs-${customsStatus}`}
                                      >
                                        {
                                          quotation.customs_status ||
                                          "—"
                                        }
                                      </span>
                                    </td>

                                    <td>
                                      <span
                                        className={`admin-quotation-status-badge admin-status-${status}`}
                                      >
                                        <span className="admin-status-dot"></span>

                                        {
                                          statusLabel
                                        }
                                      </span>
                                    </td>

                                  </tr>
                                );
                              }
                            )
                        ) : (
                          <tr>
                            <td
                              colSpan="10"
                              className="admin-recent-empty"
                            >
                              No quotations
                              available.
                            </td>
                          </tr>
                        )}

                      </tbody>

                    </table>

                  </div>

                </section>
              )}

            {/* MONTHLY PERFORMANCE */}

            {!kpiLoading &&
              !kpiError && (
                <section className="admin-monthly-performance">

                  <div className="admin-section-heading">

                    <h2>
                      Monthly Performance
                    </h2>

                  </div>

                  <div className="admin-monthly-cards">

                    {monthlyQuotationData.map(
                      (
                        item,
                        index
                      ) => {

                        const isCurrentMonth =
                          item.month ===
                          currentMonthSummary.month;

                        return (
                          <div
                            key={`${item.month}-${item.year ?? index}`}
                            className={`admin-month-card ${
                              isCurrentMonth
                                ? "admin-month-card-current"
                                : ""
                            }`}
                          >

                            <div className="admin-month-card-header">

                              <h3>
                                {item.month}
                              </h3>

                              {isCurrentMonth && (
                                <span className="admin-current-month-badge">
                                  Current
                                  Month
                                </span>
                              )}

                            </div>

                            <div className="admin-month-card-count">

                              <strong>
                                {item.quotations ??
                                  0}
                              </strong>

                              <span>
                                Total
                                Quotations
                              </span>

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>

                  <div className="admin-current-month-section">

                    <div className="admin-section-heading">

                      <h3>
                        {currentMonthSummary.month ||
                          "Current Month"}
                        {" — "}
                        Quotation Summary
                      </h3>

                    </div>

                    <div className="admin-current-month-grid">

                      <div className="admin-month-summary-card summary-total">
                        <span>
                          Total Quotations
                        </span>

                        <strong>
                          {currentMonthSummary.total_quotations ??
                            0}
                        </strong>
                      </div>

                      <div className="admin-month-summary-card summary-approved">
                        <span>
                          Approved
                        </span>

                        <strong>
                          {currentMonthSummary.approved_quotations ??
                            0}
                        </strong>
                      </div>

                      <div className="admin-month-summary-card summary-rejected">
                        <span>
                          Rejected
                        </span>

                        <strong>
                          {currentMonthSummary.rejected_quotations ??
                            0}
                        </strong>
                      </div>

                      <div className="admin-month-summary-card summary-pending">
                        <span>
                          Pending
                        </span>

                        <strong>
                          {currentMonthSummary.pending_quotations ??
                            0}
                        </strong>
                      </div>

                    </div>

                  </div>

                </section>
              )}

          </div>
        )}

        {/* =================================================
            USERS
        ================================================= */}

        {activePage === "users" && (
          <Users />
        )}

        {/* =================================================
            ROUTES
        ================================================= */}

        {activePage === "routes" && (
          <AdminRoutes />
        )}

        {/* =================================================
            PRICING
        ================================================= */}

        {activePage === "pricing" && (
          <AdminPricing />
        )}

        {/* =================================================
            WEATHER
        ================================================= */}

        {activePage === "weather" && (
          <AdminWeather />
        )}

        {/* =================================================
            CUSTOMS
        ================================================= */}

        {activePage === "customs" && (
          <AdminCustom />
        )}

        {/* =================================================
            QUOTATION
        ================================================= */}

        {activePage === "quotation" && (
          <AdminQuotation />
        )}

        {/* =================================================
            FEEDBACK
        ================================================= */}

        {activePage === "feedback" && (
          <AdminFeedback />
        )}

        {/* =================================================
            SETTINGS - PROFILE
        ================================================= */}

        {activePage === "settings-profile" && (
          <AdminSettings
            initialSection="profile"
          />
        )}

        {/* =================================================
            SETTINGS - NOTIFICATIONS
        ================================================= */}

        {activePage ===
          "settings-notifications" && (
          <AdminSettings
            initialSection="notifications"
          />
        )}

        {/* =================================================
            SETTINGS - SECURITY
        ================================================= */}

        {activePage ===
          "settings-security" && (
          <AdminSettings
            initialSection="security"
          />
        )}

        {/* =================================================
            SETTINGS - ABOUT
        ================================================= */}

        {activePage === "settings-about" && (
          <AdminSettings
            initialSection="about"
          />
        )}

        {/* =================================================
            OTHER PAGES
        ================================================= */}

        {activePage !== "dashboard" &&
          activePage !== "admin-notifications" &&
          activePage !== "users" &&
          activePage !== "routes" &&
          activePage !== "pricing" &&
          activePage !== "weather" &&
          activePage !== "customs" &&
          activePage !== "quotation" &&
          activePage !== "feedback" &&
          activePage !== "settings-profile" &&
          activePage !==
            "settings-notifications" &&
          activePage !==
            "settings-security" &&
          activePage !==
            "settings-about" && (
            <div className="admin-empty-page">

              <h2>
                {
                  menuItems.find(
                    (item) =>
                      item.id ===
                      activePage
                  )?.label
                }
              </h2>

            </div>
          )}

      </main>

    </div>
  );
}

export default AdminDashboard;