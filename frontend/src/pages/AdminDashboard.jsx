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
  Line,
  ComposedChart,
} from "recharts";

import "./AdminDashboard.css";

function AdminDashboard() {
  // =========================================================
  // STATE
  // =========================================================

  const [activePage, setActivePage] = useState("dashboard");

  const [admin, setAdmin] = useState(null);

  const [kpis, setKpis] = useState({
    total_users: 0,
    total_quotations: 0,
    pending_quotations: 0,
    approved_quotations: 0,
    rejected_quotations: 0,
    monthly_quotations: 0,
  });

  const [recentQuotations, setRecentQuotations] = useState([]);

  // ---------------------------------------------------------
  // QUOTATIONS
  // ---------------------------------------------------------

  const [quotations, setQuotations] = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(false);
  const [quotationsError, setQuotationsError] = useState("");

  // ---------------------------------------------------------
  // USERS
  // ---------------------------------------------------------

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  // ---------------------------------------------------------
  // ROUTES
  // ---------------------------------------------------------

  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState("");

  // ---------------------------------------------------------
  // PRICING
  // ---------------------------------------------------------

  const [pricing, setPricing] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");

  // ---------------------------------------------------------
  // FEEDBACK
  // ---------------------------------------------------------

  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  // ---------------------------------------------------------
  // GENERAL LOADING
  // ---------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [quotationActionLoading, setQuotationActionLoading] =
    useState(null);

  const navigate = useNavigate();

  // =========================================================
  // LOAD ADMIN DASHBOARD DATA
  // =========================================================

  const loadAdminDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "http://localhost:8000/api/admin-dashboard/",
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
        setError(
          data.message ||
            "Unable to load admin dashboard data."
        );
        return;
      }

      setAdmin(data.admin || null);

      setKpis(
        data.kpis || {
          total_users: 0,
          total_quotations: 0,
          pending_quotations: 0,
          approved_quotations: 0,
          rejected_quotations: 0,
          monthly_quotations: 0,
        }
      );

      setRecentQuotations(
        data.recent_quotations || []
      );
    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // INITIAL ADMIN DASHBOARD LOAD
  // =========================================================

  useEffect(() => {
    loadAdminDashboard();
    loadAdminQuotations();
    loadAdminPricing();
  }, [navigate]);

  // =========================================================
  // LOAD ADMIN USERS
  // =========================================================

  const loadAdminUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError("");

      const response = await fetch(
        "http://localhost:8000/api/admin-users/",
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
        setUsersError(
          data.message ||
            "Unable to load registered users."
        );
        return;
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error(
        "Admin users error:",
        error
      );

      setUsersError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setUsersLoading(false);
    }
  };

  // =========================================================
  // LOAD ADMIN ROUTES
  // =========================================================

  const loadAdminRoutes = async () => {
    try {
      setRoutesLoading(true);
      setRoutesError("");

      const response = await fetch(
        "http://localhost:8000/api/routes/admin",
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
        setRoutesError(
          data.message ||
            "Unable to load available routes."
        );
        return;
      }

      setRoutes(data.routes || []);
    } catch (error) {
      console.error(
        "Admin routes error:",
        error
      );

      setRoutesError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setRoutesLoading(false);
    }
  };

  // =========================================================
  // LOAD ADMIN PRICING
  // =========================================================
  //
  // Pricing Management is based ONLY on approved quotations.
  // The quotation-management response already contains the
  // actual pricing values used in each quotation, so we use
  // those values directly instead of depending on a separate
  // Pricing-table record already existing in the database.
  //
  // Example:
  //   4 quotations
  //   3 approved + 1 rejected
  //   => Pricing Records = 3
  //
  // Rejected quotations are never included here.
  // =========================================================

  const loadAdminPricing = async () => {
    try {
      setPricingLoading(true);
      setPricingError("");

      const response = await fetch(
        "http://localhost:8000/api/admin-quotations/",
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
        setPricingError(
          data.message ||
            "Unable to load approved quotation pricing."
        );
        setPricing([]);
        return;
      }

      const quotationRecords =
        Array.isArray(data.quotations)
          ? data.quotations
          : [];

      const approvedRecords =
        quotationRecords.filter((quotation) => {
          const status = String(
            quotation.status || ""
          )
            .toLowerCase()
            .trim();

          return status === "approved";
        });

      const pricingRecords = approvedRecords.map(
        (quotation) => {
          const quotationPricing =
            quotation.pricing || {};

          const selectedRoute =
            quotation.selected_route || {};

          const routeId =
            quotation.selected_route_id ||
            quotation.route_id ||
            selectedRoute.route_id ||
            "—";

          const baseFreight = Number(
            quotation.base_freight_usd ??
              quotation.freight_per_container_usd ??
              quotation.base_freight ??
              quotationPricing.base_freight_usd ??
              selectedRoute.base_freight_usd ??
              0
          );

          const fuelSurcharge = Number(
            quotation.fuel_surcharge_usd ??
              quotation.fuel_surcharge ??
              quotationPricing.fuel_surcharge_usd ??
              0
          );

          const portCharge = Number(
            quotation.port_charge_usd ??
              quotation.port_charge ??
              quotationPricing.port_charge_usd ??
              0
          );

          const riskSurcharge = Number(
            quotation.risk_surcharge_usd ??
              quotation.risk_surcharge ??
              quotationPricing.risk_surcharge_usd ??
              0
          );

          const demandFactor = Number(
            quotation.demand_factor ??
              quotationPricing.demand_factor ??
              1
          );

          const containerCount = Number(
            quotation.container_count ??
              quotation.containers ??
              quotation.container_quantity ??
              0
          );

          const operationalCostValue =
            quotation.total_operational_cost_usd ??
            quotation.total_operational_cost ??
            quotation.operational_cost_total ??
            quotationPricing.total_operational_cost_usd ??
            quotationPricing.operating_cost_usd;

          const calculatedOperationalCost =
            (baseFreight +
              fuelSurcharge +
              portCharge +
              riskSurcharge) *
            containerCount;

          const totalOperationalCost =
            Number.isFinite(
              Number(operationalCostValue)
            ) &&
            operationalCostValue !== null &&
            operationalCostValue !== ""
              ? Number(operationalCostValue)
              : calculatedOperationalCost;

          const demandAdjustedValue =
            quotation.total_demand_adjusted_cost_usd ??
            quotation.total_demand_adjusted_cost ??
            quotation.demand_adjusted_cost_total ??
            quotationPricing.total_demand_adjusted_cost_usd ??
            quotationPricing.demand_adjusted_cost_usd;

          const totalDemandAdjustedCost =
            Number.isFinite(
              Number(demandAdjustedValue)
            ) &&
            demandAdjustedValue !== null &&
            demandAdjustedValue !== ""
              ? Number(demandAdjustedValue)
              : totalOperationalCost *
                demandFactor;

          const finalSellingPrice = Number(
            quotation.final_selling_price_usd ??
              quotation.selling_price ??
              quotationPricing.final_selling_price_usd ??
              quotation.total_selling_price ??
              quotation.total_price ??
              0
          );

          const profit = Number(
            quotation.profit_usd ??
              quotationPricing.profit_usd ??
              quotation.margin_amount_usd ??
              quotationPricing.margin_amount_usd ??
              (finalSellingPrice -
                totalDemandAdjustedCost)
          );

          const targetMarginPercent = Number(
            quotation.target_margin_percent ??
              quotationPricing.target_margin_percent ??
              (quotation.target_margin != null
                ? Number(quotation.target_margin) * 100
                : 0)
          );

          return {
            id: `quotation-${quotation.id}`,
            quotation_id: quotation.id,
            route_id: routeId,
            origin:
              quotation.origin ||
              selectedRoute.origin ||
              "—",
            destination:
              quotation.destination ||
              selectedRoute.destination ||
              "—",
            base_freight_usd: baseFreight,
            fuel_surcharge: fuelSurcharge,
            fuel_surcharge_usd: fuelSurcharge,
            port_charge: portCharge,
            port_charge_usd: portCharge,
            risk_surcharge: riskSurcharge,
            risk_surcharge_usd: riskSurcharge,
            operating_cost: totalOperationalCost,
            operating_cost_usd: totalOperationalCost,
            total_operational_cost_usd: totalOperationalCost,
            demand_factor: demandFactor,
            demand_adjusted_cost: totalDemandAdjustedCost,
            demand_adjusted_cost_usd: totalDemandAdjustedCost,
            total_demand_adjusted_cost_usd: totalDemandAdjustedCost,
            target_margin_percent: targetMarginPercent,
            final_selling_price_usd: finalSellingPrice,
            profit_usd: profit,
            status: "approved",
          };
        }
      );

      // -------------------------------------------------------
      // Some older approved quotations may have zero values in
      // their persisted Pricing record. Recalculate those route
      // values through the existing Pricing Agent endpoint so
      // the Admin Pricing section never displays misleading
      // $0 / 0.00 values when pricing data is available.
      // -------------------------------------------------------

      const enrichedPricingRecords =
        await Promise.all(
          pricingRecords.map(async (record) => {
            const needsPricingFallback =
              Number(record.base_freight_usd || 0) === 0 ||
              Number(record.fuel_surcharge_usd || 0) === 0 ||
              Number(record.port_charge_usd || 0) === 0 ||
              Number(record.risk_surcharge_usd || 0) === 0 ||
              Number(record.operating_cost_usd || 0) === 0 ||
              Number(record.demand_adjusted_cost_usd || 0) === 0;

            if (
              !needsPricingFallback ||
              !record.route_id ||
              record.route_id === "—"
            ) {
              return record;
            }

            try {
              const pricingResponse =
                await fetch(
                  "http://localhost:8000/api/pricing/calculate",
                  {
                    method: "POST",
                    credentials: "include",
                    headers: {
                      "Content-Type":
                        "application/json",
                      Accept: "application/json",
                    },
                    body: JSON.stringify({
                      route_id: record.route_id,
                      containers: 1,
                    }),
                  }
                );

              if (!pricingResponse.ok) {
                return record;
              }

              const pricingData =
                await pricingResponse.json();

              if (
                !pricingData ||
                pricingData.status !== "success"
              ) {
                return record;
              }

              const operatingCost = Number(
                pricingData.operating_cost_per_container_usd ??
                  pricingData.operating_cost_usd ??
                  record.operating_cost_usd ??
                  0
              );

              const demandAdjustedCost = Number(
                pricingData.demand_adjusted_total_cost_usd ??
                  pricingData.demand_adjusted_cost_usd ??
                  record.demand_adjusted_cost_usd ??
                  0
              );

              return {
                ...record,
                base_freight_usd: Number(
                  pricingData.base_freight_usd ??
                    record.base_freight_usd ??
                    0
                ),
                fuel_surcharge: Number(
                  pricingData.fuel_surcharge_usd ??
                    record.fuel_surcharge ??
                    0
                ),
                fuel_surcharge_usd: Number(
                  pricingData.fuel_surcharge_usd ??
                    record.fuel_surcharge_usd ??
                    0
                ),
                port_charge: Number(
                  pricingData.port_charge_usd ??
                    record.port_charge ??
                    0
                ),
                port_charge_usd: Number(
                  pricingData.port_charge_usd ??
                    record.port_charge_usd ??
                    0
                ),
                risk_surcharge: Number(
                  pricingData.risk_surcharge_usd ??
                    record.risk_surcharge ??
                    0
                ),
                risk_surcharge_usd: Number(
                  pricingData.risk_surcharge_usd ??
                    record.risk_surcharge_usd ??
                    0
                ),
                operating_cost: operatingCost,
                operating_cost_usd: operatingCost,
                total_operational_cost_usd:
                  operatingCost,
                demand_factor: Number(
                  pricingData.demand_factor ??
                    record.demand_factor ??
                    1
                ),
                demand_adjusted_cost:
                  demandAdjustedCost,
                demand_adjusted_cost_usd:
                  demandAdjustedCost,
                total_demand_adjusted_cost_usd:
                  demandAdjustedCost,
              };
            } catch (pricingFallbackError) {
              console.error(
                `Pricing fallback failed for ${record.route_id}:`,
                pricingFallbackError
              );

              return record;
            }
          })
        );

      setPricing(
        enrichedPricingRecords
      );
    } catch (error) {
      console.error(
        "Admin pricing error:",
        error
      );

      setPricingError(
        "Unable to connect to the server. Please try again."
      );

      setPricing([]);
    } finally {
      setPricingLoading(false);
    }
  };

  // =========================================================
  // LOAD ADMIN FEEDBACK
  // =========================================================

  const loadAdminFeedback = async () => {
    try {
      setFeedbackLoading(true);
      setFeedbackError("");

      const response = await fetch(
        "http://localhost:8000/api/feedback/admin",
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
        setFeedbackError(
          data.message ||
            "Unable to load customer feedback."
        );
        return;
      }

      setFeedback(data.feedback || []);
    } catch (error) {
      console.error(
        "Admin feedback error:",
        error
      );

      setFeedbackError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setFeedbackLoading(false);
    }
  };

  // =========================================================
  // LOAD ALL ADMIN QUOTATIONS
  // =========================================================

  const loadAdminQuotations = async () => {
    try {
      setQuotationsLoading(true);
      setQuotationsError("");

      const response = await fetch(
        "http://localhost:8000/api/admin-quotations/",
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
        setQuotationsError(
          data.message ||
            "Unable to load customer quotations."
        );
        return;
      }

      setQuotations(data.quotations || []);
    } catch (error) {
      console.error(
        "Admin quotations error:",
        error
      );

      setQuotationsError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setQuotationsLoading(false);
    }
  };

  // =========================================================
  // APPROVE QUOTATION
  // =========================================================

  const handleApproveQuotation = async (quotationId) => {
    try {
      setQuotationActionLoading(quotationId);
      setQuotationsError("");

      const response = await fetch(
        `http://localhost:8000/api/admin-quotations/${quotationId}/approve`,
        {
          method: "POST",
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
        setQuotationsError(
          data.message ||
            "Unable to approve quotation."
        );
        return;
      }

      setQuotations((previousQuotations) =>
        previousQuotations.map((quotation) =>
          quotation.id === quotationId
            ? {
                ...quotation,
                status: "approved",
              }
            : quotation
        )
      );

      setRecentQuotations((previousQuotations) =>
        previousQuotations.map((quotation) =>
          quotation.id === quotationId
            ? {
                ...quotation,
                status: "approved",
              }
            : quotation
        )
      );

      await loadAdminDashboard();
      await loadAdminPricing();
    } catch (error) {
      console.error(
        "Approve quotation error:",
        error
      );

      setQuotationsError(
        "Unable to approve quotation. Please try again."
      );
    } finally {
      setQuotationActionLoading(null);
    }
  };

  // =========================================================
  // REJECT QUOTATION
  // =========================================================

  const handleRejectQuotation = async (quotationId) => {
    try {
      setQuotationActionLoading(quotationId);
      setQuotationsError("");

      const response = await fetch(
        `http://localhost:8000/api/admin-quotations/${quotationId}/reject`,
        {
          method: "POST",
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
        setQuotationsError(
          data.message ||
            "Unable to reject quotation."
        );
        return;
      }

      setQuotations((previousQuotations) =>
        previousQuotations.map((quotation) =>
          quotation.id === quotationId
            ? {
                ...quotation,
                status: "rejected",
              }
            : quotation
        )
      );

      setRecentQuotations((previousQuotations) =>
        previousQuotations.map((quotation) =>
          quotation.id === quotationId
            ? {
                ...quotation,
                status: "rejected",
              }
            : quotation
        )
      );

      await loadAdminDashboard();
      await loadAdminPricing();
    } catch (error) {
      console.error(
        "Reject quotation error:",
        error
      );

      setQuotationsError(
        "Unable to reject quotation. Please try again."
      );
    } finally {
      setQuotationActionLoading(null);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

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
    }

    navigate("/");
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "—";
    }

    try {
      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return "—";
    }
  };

  // =========================================================
  // STATUS NORMALIZATION
  // =========================================================

  const getNormalizedStatus = (status) => {
    const normalizedStatus = String(
      status || "saved"
    )
      .trim()
      .toLowerCase();

    /*
      IMPORTANT STATUS FLOW

      saved      = quotation only saved by customer
      pending    = customer requested approval
      approved   = admin approved
      rejected   = admin rejected

      Legacy "completed" values are treated as Saved.
    */

    if (
      normalizedStatus === "completed" ||
      normalizedStatus === "saved"
    ) {
      return "saved";
    }

    if (normalizedStatus === "pending") {
      return "pending";
    }

    if (normalizedStatus === "approved") {
      return "approved";
    }

    if (normalizedStatus === "rejected") {
      return "rejected";
    }

    return normalizedStatus || "saved";
  };

  const getStatusLabel = (status) => {
    const normalizedStatus =
      getNormalizedStatus(status);

    if (normalizedStatus === "saved") {
      return "Saved";
    }

    if (normalizedStatus === "pending") {
      return "Pending";
    }

    if (normalizedStatus === "approved") {
      return "Approved";
    }

    if (normalizedStatus === "rejected") {
      return "Rejected";
    }

    return (
      normalizedStatus.charAt(0).toUpperCase() +
      normalizedStatus.slice(1)
    );
  };

  const getStatusClass = (status) => {
    const normalizedStatus =
      getNormalizedStatus(status);

    if (normalizedStatus === "approved") {
      return "approved";
    }

    if (normalizedStatus === "rejected") {
      return "rejected";
    }

    if (normalizedStatus === "saved") {
      return "saved";
    }

    return "pending";
  };

  // =========================================================
  // USER VERIFICATION CLASS
  // =========================================================

  const getVerificationClass = (isVerified) => {
    return isVerified ? "approved" : "pending";
  };

  // =========================================================
  // ROUTE TYPE CLASS
  // =========================================================

  const getRouteTypeClass = (routeType) => {
    const normalizedType = (
      routeType || ""
    ).toLowerCase();

    if (
      normalizedType.includes("alternative")
    ) {
      return "alternative";
    }

    return "standard";
  };

  // =========================================================
  // PAGE TITLE
  // =========================================================

  const getPageTitle = () => {
    if (activePage === "dashboard") {
      return "Admin Dashboard";
    }

    if (activePage === "users") {
      return "Users";
    }

    if (activePage === "routes") {
      return "Routes";
    }

    if (activePage === "pricing") {
      return "Pricing";
    }

    if (activePage === "quotations") {
      return "Quotations";
    }

    if (activePage === "feedback") {
      return "Customer Feedback";
    }

    if (activePage === "settings") {
      return "Settings";
    }

    return "Admin Dashboard";
  };

  // =========================================================
  // IMPORTANT:
  // ADMIN SHOULD NOT SEE SAVED-ONLY QUOTATIONS
  // =========================================================

  const submittedQuotations = quotations.filter(
    (quotation) => {
      const status = getNormalizedStatus(
        quotation.status
      );

      return (
        status === "pending" ||
        status === "approved" ||
        status === "rejected"
      );
    }
  );

  // =========================================================
  // QUOTATION STATUS COUNTS
  // =========================================================

  const pendingQuotationCount =
    submittedQuotations.filter(
      (quotation) =>
        getNormalizedStatus(quotation.status) ===
        "pending"
    ).length;

  const approvedQuotationCount =
    submittedQuotations.filter(
      (quotation) =>
        getNormalizedStatus(quotation.status) ===
        "approved"
    ).length;

  const rejectedQuotationCount =
    submittedQuotations.filter(
      (quotation) =>
        getNormalizedStatus(quotation.status) ===
        "rejected"
    ).length;

  // =========================================================
  // QUOTATION REVENUE
  // ONLY APPROVED QUOTATIONS COUNT
  // =========================================================

  const getQuotationRevenue = (quotation) => {
    const candidates = [
      quotation.final_selling_price_usd,
      quotation.selling_price,
      quotation.pricing?.final_selling_price_usd,
      quotation.total_selling_price,
      quotation.total_price,
    ];

    const value = candidates
      .map((candidate) => Number(candidate))
      .find(
        (candidate) =>
          Number.isFinite(candidate) &&
          candidate > 0
      );

    return value ?? 0;
  };

  // =========================================================
  // QUOTATION PROFIT
  // ONLY APPROVED QUOTATIONS COUNT
  // =========================================================

  const getQuotationProfit = (quotation) => {
    const candidates = [
      quotation.profit_usd,
      quotation.pricing?.profit_usd,
      quotation.margin_amount_usd,
      quotation.pricing?.margin_amount_usd,
    ];

    const value = candidates
      .map((candidate) => Number(candidate))
      .find((candidate) =>
        Number.isFinite(candidate)
      );

    return value ?? 0;
  };

  // =========================================================
  // QUOTATION MARGIN %
  // =========================================================

  const getQuotationMarginPercent = (
    quotation
  ) => {
    const directMargin = Number(
      quotation.actual_margin_percent ??
        quotation.pricing?.actual_margin_percent
    );

    if (Number.isFinite(directMargin)) {
      return directMargin;
    }

    const revenue =
      getQuotationRevenue(quotation);

    if (revenue <= 0) {
      return 0;
    }

    return (
      (getQuotationProfit(quotation) /
        revenue) *
      100
    );
  };

  // =========================================================
  // APPROVED QUOTATIONS
  // =========================================================

  const approvedQuotations =
    submittedQuotations.filter(
      (quotation) =>
        getNormalizedStatus(
          quotation.status
        ) === "approved"
    );

  // =========================================================
  // APPROVED BUSINESS PROFIT / LOSS
  //
  // Profit is calculated from approved quotations.
  // Rejected quotations use the same potential-profit
  // calculation for the Loss KPI.
  // =========================================================

  const getApprovedBusinessResult = (quotation) => {
    const pricingData = quotation.pricing || {};

    const routeId = String(
      quotation.selected_route_id ||
        quotation.route_id ||
        quotation.selected_route?.route_id ||
        ""
    ).toLowerCase();

    const routePricing =
      pricing.find(
        (item) =>
          String(
            item.route_id ||
              ""
          ).toLowerCase() === routeId
      ) || {};

    const containerCount = Number(
      quotation.container_count ??
        quotation.containers ??
        quotation.container_quantity ??
        0
    );

    const baseFreight = Number(
      quotation.base_freight_usd ??
        quotation.freight_per_container_usd ??
        quotation.base_freight ??
        pricingData.base_freight_usd ??
        quotation.selected_route?.base_freight_usd ??
        routePricing.base_freight_usd ??
        0
    );

    const fuelSurcharge = Number(
      quotation.fuel_surcharge_usd ??
        quotation.fuel_surcharge ??
        pricingData.fuel_surcharge_usd ??
        routePricing.fuel_surcharge_usd ??
        routePricing.fuel_surcharge ??
        0
    );

    const portCharge = Number(
      quotation.port_charge_usd ??
        quotation.port_charge ??
        pricingData.port_charge_usd ??
        routePricing.port_charge_usd ??
        routePricing.port_charge ??
        0
    );

    const riskSurcharge = Number(
      quotation.risk_surcharge_usd ??
        quotation.risk_surcharge ??
        pricingData.risk_surcharge_usd ??
        routePricing.risk_surcharge_usd ??
        routePricing.risk_surcharge ??
        0
    );

    const demandFactor = Number(
      quotation.demand_factor ??
        pricingData.demand_factor ??
        routePricing.demand_factor ??
        1
    );

    const directOperationalCost = Number(
      quotation.total_operational_cost_usd ??
        quotation.total_operational_cost ??
        quotation.operational_cost_total ??
        pricingData.total_operational_cost_usd
    );

    const totalOperationalCost =
      Number.isFinite(directOperationalCost)
        ? directOperationalCost
        : (
            baseFreight +
            fuelSurcharge +
            portCharge +
            riskSurcharge
          ) * containerCount;

    const directDemandAdjustedCost = Number(
      quotation.total_demand_adjusted_cost_usd ??
        quotation.total_demand_adjusted_cost ??
        quotation.demand_adjusted_cost_total ??
        pricingData.total_demand_adjusted_cost_usd
    );

    const totalDemandAdjustedCost =
      Number.isFinite(directDemandAdjustedCost)
        ? directDemandAdjustedCost
        : totalOperationalCost * demandFactor;

    const finalSellingPrice =
      getQuotationRevenue(quotation);

    const result =
      finalSellingPrice -
      totalDemandAdjustedCost;

    return Number.isFinite(result)
      ? result
      : 0;
  };

  const totalProfit =
    approvedQuotations.reduce(
      (total, quotation) => {
        const result =
          getApprovedBusinessResult(quotation);

        return total +
          (result > 0 ? result : 0);
      },
      0
    );

  // =========================================================
  // REJECTED QUOTATION LOSS
  //
  // A rejected quotation represents profit that would have been
  // earned if that quotation had been approved. Only positive
  // potential profit is counted as Loss.
  // =========================================================

  const rejectedQuotations =
    submittedQuotations.filter(
      (quotation) =>
        getNormalizedStatus(
          quotation.status
        ) === "rejected"
    );

  const totalLoss =
    rejectedQuotations.reduce(
      (total, quotation) => {
        const potentialProfit =
          getApprovedBusinessResult(quotation);

        return total +
          (potentialProfit > 0
            ? potentialProfit
            : 0);
      },
      0
    );

  const netProfitLoss =
    totalProfit - totalLoss;

  // =========================================================
  // APPROVED QUOTATION PRICING RECORDS
  //
  // The Pricing page must show pricing only for routes that
  // belong to approved quotations. The complete pricing state
  // is still kept above because rejected quotations need their
  // pricing information to calculate potential loss.
  // =========================================================

  const approvedRouteIds = new Set(
    approvedQuotations
      .map(
        (quotation) =>
          String(
            quotation.selected_route_id ||
              quotation.route_id ||
              quotation.selected_route?.route_id ||
              ""
          ).toLowerCase()
      )
      .filter(Boolean)
  );

  const approvedPricingRecords =
    pricing.filter(
      (item) =>
        approvedRouteIds.has(
          String(
            item.route_id ||
              ""
          ).toLowerCase()
        )
    );

  // =========================================================
  // BUSINESS METRICS
  // APPROVED QUOTATIONS ONLY
  // =========================================================

  const totalRevenueGenerated =
    approvedQuotations.reduce(
      (total, quotation) =>
        total +
        getQuotationRevenue(quotation),
      0
    );


  // =========================================================
  // DISPLAY QUOTATION NUMBER
  //
  // Saved quotations are excluded.
  // Visible history starts at #1.
  // =========================================================

  const quotationNumberMap = {};

  submittedQuotations.forEach(
    (quotation, index) => {
      quotationNumberMap[quotation.id] =
        submittedQuotations.length - index;
    }
  );

  // =========================================================
  // STATUS CHART DATA
  // =========================================================

  const statusChartData = [
    {
      name: "Pending",
      value: pendingQuotationCount,
    },
    {
      name: "Approved",
      value: approvedQuotationCount,
    },
    {
      name: "Rejected",
      value: rejectedQuotationCount,
    },
  ].filter(
    (item) => item.value > 0
  );

  // =========================================================
  // TOP USERS
  // =========================================================

  const topUsersMap = {};

  submittedQuotations.forEach(
    (quotation) => {
      const customerName =
        quotation.customer?.name ||
        quotation.customer_name ||
        "Unknown Customer";

      if (!topUsersMap[customerName]) {
        topUsersMap[customerName] = {
          name: customerName,
          quotations: 0,
        };
      }

      topUsersMap[
        customerName
      ].quotations += 1;
    }
  );

  const topUsersChartData =
    Object.values(topUsersMap)
      .sort(
        (a, b) =>
          b.quotations -
          a.quotations
      )
      .slice(0, 5);

  // =========================================================
  // CURRENT YEAR MONTHLY BUSINESS DATA
  // =========================================================

  const currentYear =
    new Date().getFullYear();

  const monthlyBusinessMap =
    Array.from(
      { length: 12 },
      (_, index) => ({
        monthIndex: index,

        month: new Date(
          currentYear,
          index,
          1
        ).toLocaleDateString(
          "en-IN",
          {
            month: "short",
          }
        ),

        quotations: 0,
        revenue: 0,
      })
    );

  submittedQuotations.forEach(
    (quotation) => {
      if (!quotation.created_at) {
        return;
      }

      const date = new Date(
        quotation.created_at
      );

      if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== currentYear
      ) {
        return;
      }

      const monthIndex =
        date.getMonth();

      monthlyBusinessMap[
        monthIndex
      ].quotations += 1;

      if (
        getNormalizedStatus(
          quotation.status
        ) === "approved"
      ) {
        monthlyBusinessMap[
          monthIndex
        ].revenue +=
          getQuotationRevenue(
            quotation
          );
      }
    }
  );

  const monthlyBusinessChartData =
    monthlyBusinessMap
      .filter(
        (item) =>
          item.quotations > 0 ||
          item.revenue > 0
      )
      .map((item) => ({
        ...item,
        revenue: Number(
          item.revenue.toFixed(2)
        ),
      }));

  // =========================================================
  // CURRENT MONTH QUOTATION COUNT
  // =========================================================

  const currentMonth =
    new Date().getMonth();

  const monthlyQuotationCount =
    submittedQuotations.filter(
      (quotation) => {
        if (!quotation.created_at) {
          return false;
        }

        const date = new Date(
          quotation.created_at
        );

        return (
          !Number.isNaN(
            date.getTime()
          ) &&
          date.getFullYear() ===
            currentYear &&
          date.getMonth() ===
            currentMonth
        );
      }
    ).length;

  // =========================================================
  // SEPTEMBER QUOTATIONS
  // =========================================================

  const septemberQuotations =
    submittedQuotations.filter(
      (quotation) => {
        if (!quotation.created_at) {
          return false;
        }

        const date = new Date(
          quotation.created_at
        );

        return (
          date.getFullYear() ===
            currentYear &&
          date.getMonth() === 8
        );
      }
    );

  // =========================================================
  // SEPTEMBER DAILY DATA
  // =========================================================

  const septemberDailyMap =
    septemberQuotations.reduce(
      (
        accumulator,
        quotation
      ) => {
        const date = new Date(
          quotation.created_at
        );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return accumulator;
        }

        const key =
          date
            .toISOString()
            .slice(0, 10);

        if (!accumulator[key]) {
          accumulator[key] = {
            quotations: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
          };
        }

        accumulator[key]
          .quotations += 1;

        const status =
          getNormalizedStatus(
            quotation.status
          );

        if (
          status === "approved"
        ) {
          accumulator[key]
            .approved += 1;
        } else if (
          status === "rejected"
        ) {
          accumulator[key]
            .rejected += 1;
        } else {
          accumulator[key]
            .pending += 1;
        }

        return accumulator;
      },
      {}
    );

  const septemberDailyData =
    Object.entries(
      septemberDailyMap
    )
      .sort(
        ([dateA], [dateB]) =>
          dateA.localeCompare(
            dateB
          )
      )
      .map(
        ([date, values]) => ({
          date,
          ...values,

          label: new Date(
            `${date}T00:00:00`
          ).toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
            }
          ),
        })
      );

  // =========================================================
  // DOWNLOAD QUOTATIONS CSV
  // =========================================================

  const escapeCsvValue = (
    value
  ) => {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  };

  const handleDownloadCSV = () => {
    /*
      IMPORTANT:
      Only Pending / Approved / Rejected
      quotations are exported.

      Saved-only quotations are excluded.
    */

    if (
      submittedQuotations.length === 0
    ) {
      setQuotationsError(
        "There are no submitted quotations available to download."
      );
      return;
    }

    const headers = [
      "Quotation Number",
      "Quotation Database ID",

      "Customer Name",
      "Customer Email",
      "Company Name",

      "Origin",
      "Destination",
      "Cargo Type",
      "Container Count",

      "Selected Route",
      "Route Type",
      "Distance (nm)",
      "Transit Time (days)",
      "Transshipments",

      "Base Freight / Container",
      "Fuel Surcharge / Container",
      "Port Charge / Container",
      "Risk Surcharge / Container",

      "Demand Factor",

      "Total Operational Cost",
      "Total Demand Adjusted Cost",

      "Target Margin %",
      "Margin Amount",
      "Final Selling Price",

      "Profit",
      "Actual Margin %",

      "Status",
      "Created Date",
    ];

    const rows =
      submittedQuotations.map(
        (quotation) => {
          const containerCount =
            Number(
              quotation.container_count ??
                quotation.containers ??
                quotation.container_quantity ??
                0
            );

          const selectedRouteId =
            String(
              quotation.selected_route_id ??
                quotation.route_id ??
                quotation
                  .selected_route
                  ?.route_id ??
                ""
            ).toLowerCase();

          const routePricing =
            pricing.find(
              (item) =>
                String(
                  item.route_id ||
                    ""
                ).toLowerCase() ===
                selectedRouteId
            );

          const selectedRoute =
            routes.find(
              (item) =>
                String(
                  item.route_id ||
                    item.id ||
                    ""
                ).toLowerCase() ===
                selectedRouteId
            );

          const pricingData =
            quotation.pricing ||
            {};

          const baseFreight =
            Number(
              quotation.base_freight_usd ??
                quotation.freight_per_container_usd ??
                quotation.base_freight ??
                pricingData.base_freight_usd ??
                quotation
                  .selected_route
                  ?.base_freight_usd ??
                selectedRoute?.base_freight_usd ??
                routePricing?.base_freight_usd ??
                0
            );

          const fuelSurcharge =
            Number(
              quotation.fuel_surcharge ??
                quotation.fuel_surcharge_usd ??
                pricingData.fuel_surcharge_usd ??
                routePricing?.fuel_surcharge ??
                0
            );

          const portCharge =
            Number(
              quotation.port_charge ??
                quotation.port_charge_usd ??
                pricingData.port_charge_usd ??
                routePricing?.port_charge ??
                0
            );

          const riskSurcharge =
            Number(
              quotation.risk_surcharge ??
                quotation.risk_surcharge_usd ??
                pricingData.risk_surcharge_usd ??
                routePricing?.risk_surcharge ??
                0
            );

          const demandFactor =
            Number(
              quotation.demand_factor ??
                pricingData.demand_factor ??
                routePricing?.demand_factor ??
                1
            );

          const directOperationalCost =
            Number(
              quotation.total_operational_cost ??
                quotation.operational_cost_total ??
                quotation.total_operational_cost_usd ??
                pricingData.total_operational_cost_usd
            );

          const directDemandAdjustedCost =
            Number(
              quotation.total_demand_adjusted_cost ??
                quotation.demand_adjusted_cost_total ??
                quotation.total_demand_adjusted_cost_usd ??
                pricingData.total_demand_adjusted_cost_usd
            );

          const totalOperationalCost =
            Number.isFinite(
              directOperationalCost
            )
              ? directOperationalCost
              : (
                  baseFreight +
                  fuelSurcharge +
                  portCharge +
                  riskSurcharge
                ) *
                containerCount;

          const totalDemandAdjustedCost =
            Number.isFinite(
              directDemandAdjustedCost
            )
              ? directDemandAdjustedCost
              : totalOperationalCost *
                demandFactor;

          const targetMargin =
            Number(
              quotation.target_margin_percent ??
                pricingData.target_margin_percent ??
                (quotation.target_margin !=
                null
                  ? Number(
                      quotation.target_margin
                    ) * 100
                  : 0)
            );

          const finalSellingPrice =
            Number(
              quotation.final_selling_price_usd ??
                quotation.selling_price ??
                pricingData.final_selling_price_usd ??
                0
            );

          const marginAmount =
            Number(
              quotation.margin_amount_usd ??
                pricingData.margin_amount_usd ??
                (
                  finalSellingPrice -
                  totalDemandAdjustedCost
                )
            );

          const profit =
            Number(
              quotation.profit_usd ??
                pricingData.profit_usd ??
                marginAmount
            );

          const actualMargin =
            getQuotationMarginPercent(
              quotation
            );

          const routeType =
            quotation.selected_route
              ?.route_type ??
            selectedRoute?.route_type ??
            "";

          const distance =
            Number(
              quotation.selected_route
                ?.distance_nm ??
                selectedRoute?.distance_nm ??
                0
            );

          const transitDays =
            Number(
              quotation.selected_route
                ?.transit_days ??
                selectedRoute?.transit_days ??
                0
            );

          const transshipments =
            Number(
              quotation.selected_route
                ?.transshipments ??
                selectedRoute?.transshipments ??
                0
            );

          return [
            quotationNumberMap[
              quotation.id
            ] ?? "",

            quotation.id,

            quotation.customer
              ?.name ||
              quotation.customer_name ||
              "",

            quotation.customer
              ?.email ||
              quotation.customer_email ||
              "",

            quotation.customer
              ?.company_name ||
              quotation.company_name ||
              "",

            quotation.origin ||
              "",

            quotation.destination ||
              "",

            quotation.cargo_type ||
              "",

            containerCount,

            quotation.selected_route_id ||
              quotation.route_id ||
              quotation.selected_route
                ?.route_id ||
              "",

            routeType,

            distance || "",

            transitDays || "",

            transshipments,

            baseFreight || "",

            fuelSurcharge || "",

            portCharge || "",

            riskSurcharge || "",

            demandFactor || "",

            totalOperationalCost ||
              "",

            totalDemandAdjustedCost ||
              "",

            targetMargin || "",

            marginAmount || "",

            finalSellingPrice ||
              "",

            profit || "",

            actualMargin || "",

            getStatusLabel(
              quotation.status
            ),

            quotation.created_at
              ? new Date(
                  quotation.created_at
                ).toLocaleDateString(
                  "en-IN"
                )
              : "",
          ];
        }
      );

    const csv = [
      headers
        .map(escapeCsvValue)
        .join(","),
      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `maritime_quotations_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);
  };

  // =========================================================
  // FORMAT USD
  // =========================================================

  const formatUSD = (value) => {
    return `$${Number(
      value || 0
    ).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

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
          <h2>
            Maritime Freight
          </h2>

          <span>
            Admin Panel
          </span>
        </div>

        <nav className="admin-navigation">

          {/* DASHBOARD */}

          <button
            className={
              activePage === "dashboard"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() =>
              setActivePage(
                "dashboard"
              )
            }
          >
            <span>📊</span>
            Dashboard
          </button>

          {/* USERS */}

          <button
            className={
              activePage === "users"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() => {
              setActivePage(
                "users"
              );
              loadAdminUsers();
            }}
          >
            <span>👥</span>
            Users
          </button>

          {/* ROUTES */}

          <button
            className={
              activePage === "routes"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() => {
              setActivePage(
                "routes"
              );
              loadAdminRoutes();
            }}
          >
            <span>🧭</span>
            Routes
          </button>

          {/* PRICING */}

          <button
            className={
              activePage === "pricing"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() => {
              setActivePage(
                "pricing"
              );
              loadAdminPricing();
            }}
          >
            <span>💰</span>
            Pricing
          </button>

          {/* QUOTATIONS */}

          <button
            className={
              activePage === "quotations"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() => {
              setActivePage(
                "quotations"
              );
              loadAdminQuotations();
            }}
          >
            <span>📄</span>
            Quotations
          </button>

          {/* FEEDBACK */}

          <button
            className={
              activePage === "feedback"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() => {
              setActivePage(
                "feedback"
              );
              loadAdminFeedback();
            }}
          >
            <span>⭐</span>
            Feedback
          </button>

          {/* SETTINGS */}

          <button
            className={
              activePage === "settings"
                ? "admin-nav-item active"
                : "admin-nav-item"
            }
            onClick={() =>
              setActivePage(
                "settings"
              )
            }
          >
            <span>⚙️</span>
            Settings
          </button>

        </nav>

        {/* ===================================================
            SIDEBAR BOTTOM
        =================================================== */}

        <div className="admin-sidebar-bottom">

          <div className="admin-sidebar-user">

            <div className="admin-user-avatar">
              {admin?.name
                ? admin.name
                    .charAt(0)
                    .toUpperCase()
                : "A"}
            </div>

            <div className="admin-user-info">

              <strong>
                {admin?.name ||
                  "Administrator"}
              </strong>

              <span>
                Admin
              </span>

            </div>

          </div>

          <button
            className="admin-logout-button"
            onClick={handleLogout}
          >
            <span>🚪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="admin-main-content">

        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <header className="admin-topbar">

          <div>

            <span className="admin-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              {getPageTitle()}
            </h1>

            <p>
              Manage and monitor the Maritime Freight platform.
            </p>

          </div>

          <div className="admin-profile">

            <div className="admin-profile-icon">
              {admin?.name
                ? admin.name
                    .charAt(0)
                    .toUpperCase()
                : "A"}
            </div>

            <div>

              <strong>
                {admin?.name ||
                  "Administrator"}
              </strong>

              <span>
                Admin
              </span>

            </div>

          </div>

        </header>

        {/* =====================================================
            DASHBOARD
        ===================================================== */}

        {activePage === "dashboard" && (
          <div className="admin-page-content admin-dashboard-page">

            {error && (
              <div className="admin-error-message">
                {error}
              </div>
            )}

            {loading ? (
              <div className="admin-loading-state">

                <div className="admin-loading-icon">
                  ⏳
                </div>

                <h3>
                  Loading dashboard...
                </h3>

                <p>
                  Fetching the latest data from MySQL.
                </p>

              </div>
            ) : (
              <>

                {/* =================================================
                    KPI CARDS
                    9 SUMMARY METRICS
                ================================================= */}

                <section className="admin-kpi-grid admin-kpi-grid-five-four">

                  {/* TOTAL USERS */}

                  <div className="admin-kpi-card">

                    <div className="admin-kpi-icon">
                      👥
                    </div>

                    <div>
                      <span>
                        Total Users
                      </span>

                      <h3>
                        {kpis.total_users}
                      </h3>

                      <small>
                        Registered customers
                      </small>
                    </div>

                  </div>

                  {/* TOTAL QUOTATIONS */}

                  <div className="admin-kpi-card">

                    <div className="admin-kpi-icon">
                      📄
                    </div>

                    <div>
                      <span>
                        Total Quotations
                      </span>

                      <h3>
                        {submittedQuotations.length}
                      </h3>

                      <small>
                        Submitted for review
                      </small>
                    </div>

                  </div>

                  {/* PENDING */}

                  <div className="admin-kpi-card">

                    <div className="admin-kpi-icon">
                      ⏳
                    </div>

                    <div>
                      <span>
                        Pending Reviews
                      </span>

                      <h3>
                        {pendingQuotationCount}
                      </h3>

                      <small>
                        Awaiting admin review
                      </small>
                    </div>

                  </div>

                  {/* APPROVED */}

                  <div className="admin-kpi-card">

                    <div className="admin-kpi-icon">
                      ✅
                    </div>

                    <div>
                      <span>
                        Approved Quotations
                      </span>

                      <h3>
                        {approvedQuotationCount}
                      </h3>

                      <small>
                        Successfully approved
                      </small>
                    </div>

                  </div>

                  {/* REJECTED */}

                  <div className="admin-kpi-card">

                    <div className="admin-kpi-icon">
                      ❌
                    </div>

                    <div>
                      <span>
                        Rejected Quotations
                      </span>

                      <h3>
                        {rejectedQuotationCount}
                      </h3>

                      <small>
                        Rejected requests
                      </small>
                    </div>

                  </div>

                  {/* REVENUE — SECOND ROW */}

                  <div className="admin-kpi-card admin-revenue-kpi">

                    <div className="admin-kpi-icon">
                      💰
                    </div>

                    <div>

                      <span>
                        Total Revenue Generated
                      </span>

                      <h3>
                        {formatUSD(
                          totalRevenueGenerated
                        )}
                      </h3>

                      <small>
                        Approved quotations only
                      </small>

                    </div>

                  </div>

                  {/* TOTAL PROFIT */}

                  <div className="admin-kpi-card admin-profit-kpi">

                    <div className="admin-kpi-icon">
                      📈
                    </div>

                    <div>
                      <span>
                        Total Profit
                      </span>

                      <h3>
                        {formatUSD(totalProfit)}
                      </h3>

                      <small>
                        Approved quotations only
                      </small>
                    </div>

                  </div>

                  {/* TOTAL LOSS */}

                  <div className="admin-kpi-card admin-loss-kpi">

                    <div className="admin-kpi-icon">
                      📉
                    </div>

                    <div>
                      <span>
                        Total Loss
                      </span>

                      <h3>
                        {formatUSD(totalLoss)}
                      </h3>

                      <small>
                        Approved quotations only
                      </small>
                    </div>

                  </div>

                  {/* NET PROFIT / LOSS */}

                  <div className="admin-kpi-card admin-net-kpi">

                    <div className="admin-kpi-icon">
                      💼
                    </div>

                    <div>
                      <span>
                        Net Profit / Loss
                      </span>

                      <h3>
                        {formatUSD(netProfitLoss)}
                      </h3>

                      <small>
                        Profit minus loss
                      </small>
                    </div>

                  </div>

                </section>

                {/* =================================================
                    ADMIN CHARTS
                ================================================= */}

                <section className="admin-chart-grid">

                  {/* STATUS CHART */}

                  <div className="admin-chart-card">

                    <div className="admin-chart-header">

                      <div>
                        <span>
                          QUOTATION STATUS
                        </span>

                        <h2>
                          Status Overview
                        </h2>
                      </div>

                    </div>

                    {statusChartData.length ===
                    0 ? (
                      <div className="admin-chart-empty">
                        No quotation status data yet.
                      </div>
                    ) : (
                      <div className="admin-chart-container admin-pie-chart">

                        <ResponsiveContainer
                          width="100%"
                          height={270}
                        >

                          <PieChart>

                            <Pie
                              data={
                                statusChartData
                              }
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={95}
                              paddingAngle={3}
                            >
                              {statusChartData.map(
                                (
                                  entry,
                                  index
                                ) => (
                                  <Cell
                                    key={`${entry.name}-${index}`}
                                    fill={
                                      [
                                        "#b58b6e",
                                        "#7a523b",
                                        "#4a2a1d",
                                      ][
                                        index %
                                          3
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

                      </div>
                    )}

                  </div>

                  {/* MONTHLY REVENUE */}

                  <div className="admin-chart-card">

                    <div className="admin-chart-header">

                      <div>
                        <span>
                          REVENUE TREND
                        </span>

                        <h2>
                          Monthly Revenue
                        </h2>
                      </div>

                    </div>

                    {monthlyBusinessChartData.length ===
                    0 ? (
                      <div className="admin-chart-empty">
                        No monthly revenue data yet.
                      </div>
                    ) : (
                      <div className="admin-chart-container">

                        <ResponsiveContainer
                          width="100%"
                          height={270}
                        >

                          <ComposedChart
                            data={
                              monthlyBusinessChartData
                            }
                          >

                            <CartesianGrid
                              strokeDasharray="3 3"
                            />

                            <XAxis
                              dataKey="month"
                            />

                            <YAxis
                              yAxisId="revenue"
                              tickFormatter={(
                                value
                              ) =>
                                `$${Number(
                                  value
                                ).toLocaleString(
                                  "en-US"
                                )}`
                              }
                            />

                            <YAxis
                              yAxisId="quotations"
                              orientation="right"
                              allowDecimals={
                                false
                              }
                            />

                            <Tooltip
                              formatter={(
                                value,
                                name
                              ) =>
                                name ===
                                "Revenue"
                                  ? [
                                      `$${Number(
                                        value
                                      ).toLocaleString(
                                        "en-US"
                                      )}`,
                                      name,
                                    ]
                                  : [
                                      value,
                                      name,
                                    ]
                              }
                            />

                            <Legend />

                            <Bar
                              yAxisId="revenue"
                              dataKey="revenue"
                              name="Revenue"
                              fill="#6b4330"
                              radius={[
                                5,
                                5,
                                0,
                                0,
                              ]}
                            />

                            <Line
                              yAxisId="quotations"
                              type="monotone"
                              dataKey="quotations"
                              name="Quotations"
                              stroke="#b58b6e"
                              strokeWidth={3}
                              dot={{
                                r: 4,
                              }}
                            />

                          </ComposedChart>

                        </ResponsiveContainer>

                      </div>
                    )}

                  </div>

                  {/* TOP USERS */}

                  <div className="admin-chart-card">

                    <div className="admin-chart-header">

                      <div>
                        <span>
                          USER ACTIVITY
                        </span>

                        <h2>
                          Top 5 Users
                        </h2>
                      </div>

                    </div>

                    {topUsersChartData.length ===
                    0 ? (
                      <div className="admin-chart-empty">
                        No user quotation data yet.
                      </div>
                    ) : (
                      <div className="admin-chart-container">

                        <ResponsiveContainer
                          width="100%"
                          height={270}
                        >

                          <BarChart
                            data={
                              topUsersChartData
                            }
                            layout="vertical"
                            margin={{
                              top: 5,
                              right: 20,
                              left: 15,
                              bottom: 5,
                            }}
                          >

                            <CartesianGrid
                              strokeDasharray="3 3"
                            />

                            <XAxis
                              type="number"
                              allowDecimals={
                                false
                              }
                            />

                            <YAxis
                              type="category"
                              dataKey="name"
                              width={95}
                              tick={{
                                fontSize: 11,
                              }}
                            />

                            <Tooltip />

                            <Bar
                              dataKey="quotations"
                              name="Quotations"
                              fill="#7a523b"
                              radius={[
                                0,
                                5,
                                5,
                                0,
                              ]}
                            />

                          </BarChart>

                        </ResponsiveContainer>

                      </div>
                    )}

                  </div>

                </section>

                {/* =================================================
                    RECENT QUOTATIONS
                ================================================= */}

                <section className="admin-section-card">

                  <div className="admin-section-header">

                    <div>

                      <h2>
                        Recent Quotations
                      </h2>

                      <p>
                        Latest quotation requests submitted by customers.
                      </p>

                    </div>

                    <button
                      className="admin-view-all-button"
                      onClick={() => {
                        setActivePage(
                          "quotations"
                        );
                        loadAdminQuotations();
                      }}
                    >
                      View All
                    </button>

                  </div>

                  {(() => {
                    const visibleRecent =
                      recentQuotations.filter(
                        (quotation) => {
                          const status =
                            getNormalizedStatus(
                              quotation.status
                            );

                          return (
                            status ===
                              "pending" ||
                            status ===
                              "approved" ||
                            status ===
                              "rejected"
                          );
                        }
                      );

                    return visibleRecent.length ===
                      0 ? (
                      <div className="admin-empty-state">

                        <div className="admin-empty-icon">
                          📄
                        </div>

                        <h3>
                          No quotation data yet
                        </h3>

                        <p>
                          Customer quotations will appear here once they are submitted for approval.
                        </p>

                      </div>
                    ) : (
                      <div className="admin-quotation-list">

                        {visibleRecent.map(
                          (
                            quotation
                          ) => (
                            <div
                              className="admin-quotation-item"
                              key={
                                quotation.id
                              }
                            >

                              <div className="admin-quotation-icon">
                                📄
                              </div>

                              <div className="admin-quotation-details">

                                <strong>
                                  Quotation #
                                  {quotationNumberMap[
                                    quotation.id
                                  ] ||
                                    quotation.id}
                                </strong>

                                <p>
                                  {quotation.origin ||
                                    "—"}
                                  {" → "}
                                  {quotation.destination ||
                                    "—"}
                                </p>

                                <small>
                                  Customer:{" "}
                                  {quotation.customer?.name ||
                                    quotation.customer_name ||
                                    "Unknown Customer"}
                                </small>

                              </div>

                              <div className="admin-quotation-meta">

                                <span
                                  className={`admin-status-badge ${getStatusClass(
                                    quotation.status
                                  )}`}
                                >
                                  {getStatusLabel(
                                    quotation.status
                                  )}
                                </span>

                                <small>
                                  {formatDate(
                                    quotation.created_at
                                  )}
                                </small>

                              </div>

                            </div>
                          )
                        )}

                      </div>
                    );
                  })()}

                </section>

                {/* =================================================
                    MONTHLY QUOTATION TREND
                ================================================= */}

                <section className="admin-section-card admin-monthly-summary-section">

                  <div className="admin-section-header">

                    <div>

                      <span className="admin-section-eyebrow">
                        MONTHLY QUOTATION TREND
                      </span>

                      <h2>
                        Monthly Quotations
                      </h2>

                      <p>
                        Submitted quotation volume recorded month by month.
                      </p>

                    </div>

                  </div>

                  {monthlyBusinessChartData.length ===
                  0 ? (
                    <div className="admin-empty-state">

                      <div className="admin-empty-icon">
                        📊
                      </div>

                      <h3>
                        No monthly quotation activity yet
                      </h3>

                      <p>
                        Monthly quotation counts will appear here when customers request approval.
                      </p>

                    </div>
                  ) : (
                    <div className="admin-monthly-quotation-grid">

                      {monthlyBusinessChartData.map(
                        (month) => (
                          <div
                            className="admin-monthly-quotation-card"
                            key={
                              month.month
                            }
                          >

                            <span>
                              {month.month}
                            </span>

                            <strong>
                              {month.quotations}
                            </strong>

                            <small>
                              Quotations
                            </small>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </section>

                {/* =================================================
                    SEPTEMBER QUOTATION ACTIVITY
                ================================================= */}

                <section className="admin-section-card admin-monthly-section">

                  <div className="admin-section-header">

                    <div>

                      <span className="admin-section-eyebrow">
                        MONTHLY ACTIVITY
                      </span>

                      <h2>
                        September Quotation Activity
                      </h2>

                      <p>
                        Daily quotation activity with review status breakdown.
                      </p>

                    </div>

                    <div className="admin-month-total-card">

                      <span>
                        September {currentYear}
                      </span>

                      <strong>
                        {septemberQuotations.length}
                      </strong>

                      <small>
                        Total Quotations
                      </small>

                    </div>

                  </div>

                  {septemberDailyData.length ===
                  0 ? (
                    <div className="admin-empty-state">

                      <div className="admin-empty-icon">
                        📅
                      </div>

                      <h3>
                        No September quotation activity yet
                      </h3>

                      <p>
                        Daily quotation cards will appear here when quotations are created.
                      </p>

                    </div>
                  ) : (
                    <div className="admin-daily-list">

                      {septemberDailyData.map(
                        (day) => (
                          <div
                            className="admin-daily-card"
                            key={
                              day.date
                            }
                          >

                            <div className="admin-daily-date">

                              <span>
                                {day.label}
                              </span>

                              <strong>
                                {day.quotations}
                              </strong>

                              <small>
                                Total Quotations
                              </small>

                            </div>

                            <div className="admin-daily-status-grid">

                              <div className="admin-daily-status approved-daily">

                                <span>
                                  Approved
                                </span>

                                <strong>
                                  {day.approved}
                                </strong>

                              </div>

                              <div className="admin-daily-status rejected-daily">

                                <span>
                                  Rejected
                                </span>

                                <strong>
                                  {day.rejected}
                                </strong>

                              </div>

                              <div className="admin-daily-status pending-daily">

                                <span>
                                  Pending
                                </span>

                                <strong>
                                  {day.pending}
                                </strong>

                              </div>

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </section>

                {/* =================================================
                    MONTHLY PERFORMANCE
                ================================================= */}

                <section className="admin-section-card">

                  <div className="admin-section-header">

                    <div>

                      <h2>
                        Monthly Performance
                      </h2>

                      <p>
                        Current quotation processing overview.
                      </p>

                    </div>

                  </div>

                  <div className="admin-performance-grid">

                    <div className="admin-performance-item">

                      <span>
                        Monthly Quotations
                      </span>

                      <strong>
                        {monthlyQuotationCount}
                      </strong>

                    </div>

                    <div className="admin-performance-item">

                      <span>
                        Approved
                      </span>

                      <strong>
                        {approvedQuotationCount}
                      </strong>

                    </div>

                    <div className="admin-performance-item">

                      <span>
                        Pending
                      </span>

                      <strong>
                        {pendingQuotationCount}
                      </strong>

                    </div>

                    <div className="admin-performance-item">

                      <span>
                        Rejected
                      </span>

                      <strong>
                        {rejectedQuotationCount}
                      </strong>

                    </div>

                  </div>

                </section>


              </>
            )}

          </div>
        )}

        {/* =====================================================
            USERS
        ===================================================== */}

        {activePage === "users" && (
          <div className="admin-page-content admin-users-page">

            <section className="admin-section-card">

              <div className="admin-section-header">

                <div>

                  <h2>
                    User Management
                  </h2>

                  <p>
                    View registered customers from the MySQL database.
                  </p>

                </div>

                <div>

                  <span className="admin-data-placeholder">
                    Total Users:{" "}
                    {users.length}
                  </span>

                </div>

              </div>

              {usersError && (
                <div className="admin-error-message">
                  {usersError}
                </div>
              )}

              {usersLoading ? (
                <div className="admin-loading-state">

                  <div className="admin-loading-icon">
                    ⏳
                  </div>

                  <h3>
                    Loading users...
                  </h3>

                  <p>
                    Fetching registered customers from MySQL.
                  </p>

                </div>
              ) : users.length ===
                0 ? (
                <div className="admin-empty-state">

                  <div className="admin-empty-icon">
                    👥
                  </div>

                  <h3>
                    No registered customers
                  </h3>

                  <p>
                    Customer accounts will appear here after registration.
                  </p>

                </div>
              ) : (
                <div className="admin-quotation-list">

                  {users.map(
                    (user) => (
                      <div
                        className="admin-quotation-item"
                        key={user.id}
                      >

                        <div className="admin-quotation-icon">

                          {user.name
                            ? user.name
                                .charAt(
                                  0
                                )
                                .toUpperCase()
                            : "U"}

                        </div>

                        <div className="admin-quotation-details">

                          <strong>
                            {user.name ||
                              "Unnamed Customer"}
                          </strong>

                          <p>
                            📧{" "}
                            {user.email}
                          </p>

                          <small>
                            🏢{" "}
                            {user.company_name ||
                              "Company not provided"}
                          </small>

                        </div>

                        <div className="admin-quotation-meta">

                          <span
                            className={`admin-status-badge ${getVerificationClass(
                              user.is_verified
                            )}`}
                          >
                            {user.is_verified
                              ? "Verified"
                              : "Not Verified"}
                          </span>

                          <small>
                            Customer ID: #
                            {user.id}
                          </small>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>

          </div>
        )}

        {/* =====================================================
            ROUTES
        ===================================================== */}

        {activePage === "routes" && (
          <div className="admin-page-content admin-routes-page">

            <section className="admin-section-card admin-routes-section">

              <div className="admin-section-header admin-routes-header">

                <div>

                  <span className="admin-section-eyebrow">
                    ROUTE NETWORK
                  </span>

                  <h2>
                    Route Management
                  </h2>

                  <p>
                    Monitor all available maritime routes.
                  </p>

                </div>

                <div className="admin-route-count-card">

                  <span>
                    Total Routes
                  </span>

                  <strong>
                    {routes.length}
                  </strong>

                </div>

              </div>

              {routesError && (
                <div className="admin-error-message">
                  {routesError}
                </div>
              )}

              {routesLoading ? (
                <div className="admin-loading-state">

                  <div className="admin-loading-icon">
                    ⏳
                  </div>

                  <h3>
                    Loading routes...
                  </h3>

                  <p>
                    Fetching available routes from MySQL.
                  </p>

                </div>
              ) : routes.length ===
                0 ? (
                <div className="admin-empty-state">

                  <div className="admin-empty-icon">
                    🧭
                  </div>

                  <h3>
                    No routes available
                  </h3>

                  <p>
                    No route records were found in the database.
                  </p>

                </div>
              ) : (
                <div className="admin-route-table-wrapper">

                  <table className="admin-route-table">

                    <thead>

                      <tr>

                        <th>
                          Route
                        </th>

                        <th>
                          Origin
                        </th>

                        <th>
                          Destination
                        </th>

                        <th>
                          Distance
                        </th>

                        <th>
                          Transit
                        </th>

                        <th>
                          Transshipments
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Base Freight
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {routes.map(
                        (route) => (
                          <tr
                            key={
                              route.id
                            }
                            className="admin-route-row"
                          >

                            <td>

                              <span className="admin-route-id-badge">
                                {route.route_id}
                              </span>

                            </td>

                            <td>

                              <div className="admin-route-location">

                                <span className="admin-location-dot">
                                  ●
                                </span>

                                <span>
                                  {route.origin}
                                </span>

                              </div>

                            </td>

                            <td>

                              <div className="admin-route-location">

                                <span className="admin-location-arrow">
                                  →
                                </span>

                                <span>
                                  {route.destination}
                                </span>

                              </div>

                            </td>

                            <td>

                              <div className="admin-route-metric">

                                <strong>
                                  {Number(
                                    route.distance_nm ||
                                      0
                                  ).toLocaleString(
                                    "en-US"
                                  )}
                                </strong>

                                <span>
                                  nm
                                </span>

                              </div>

                            </td>

                            <td>

                              <div className="admin-route-metric">

                                <strong>
                                  {route.transit_days}
                                </strong>

                                <span>
                                  days
                                </span>

                              </div>

                            </td>

                            <td>

                              <span className="admin-transshipment-badge">

                                {route.transshipments}{" "}

                                {Number(
                                  route.transshipments ||
                                    0
                                ) ===
                                1
                                  ? "Stop"
                                  : "Stops"}

                              </span>

                            </td>

                            <td>

                              <span
                                className={`admin-route-type ${getRouteTypeClass(
                                  route.route_type
                                )}`}
                              >

                                <span className="admin-route-type-dot">
                                  ●
                                </span>

                                {route.route_type ||
                                  "Standard"}

                              </span>

                            </td>

                            <td>

                              <div className="admin-route-freight">

                                <span>
                                  $
                                </span>

                                <strong>
                                  {Number(
                                    route.base_freight_usd ||
                                      0
                                  ).toLocaleString(
                                    "en-US",
                                    {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    }
                                  )}
                                </strong>

                                <small>
                                  / container
                                </small>

                              </div>

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </section>

          </div>
        )}

        {/* =====================================================
            PRICING
        ===================================================== */}

        {activePage === "pricing" && (
          <div className="admin-page-content admin-pricing-page">

            <section className="admin-section-card admin-pricing-section">

              <div className="admin-section-header admin-pricing-header">

                <div>

                  <span className="admin-section-eyebrow">
                    PRICING INTELLIGENCE
                  </span>

                  <h2>
                    Pricing Management
                  </h2>

                  <p>
                    Monitor freight pricing factors and demand-adjusted costs.
                  </p>

                </div>

                <div className="admin-pricing-count-card">

                  <span>
                    Pricing Records
                  </span>

                  <strong>
                    {approvedPricingRecords.length}
                  </strong>

                </div>

              </div>

              {pricingError && (
                <div className="admin-error-message">
                  {pricingError}
                </div>
              )}

              {pricingLoading ? (
                <div className="admin-loading-state">

                  <div className="admin-loading-icon">
                    ⏳
                  </div>

                  <h3>
                    Loading pricing...
                  </h3>

                  <p>
                    Fetching pricing records from MySQL.
                  </p>

                </div>
              ) : approvedPricingRecords.length ===
                0 ? (
                <div className="admin-empty-state">

                  <div className="admin-empty-icon">
                    💰
                  </div>

                  <h3>
                    No approved pricing records available
                  </h3>

                  <p>
                    Pricing records will appear here after a quotation is approved.
                  </p>

                </div>
              ) : (
                <div className="admin-pricing-table-wrapper">

                  <table className="admin-pricing-table">

                    <thead>

                      <tr>

                        <th>
                          Route
                        </th>

                        <th>
                          Origin
                        </th>

                        <th>
                          Destination
                        </th>

                        <th>
                          Fuel
                        </th>

                        <th>
                          Port
                        </th>

                        <th>
                          Risk
                        </th>

                        <th>
                          Operating Cost
                        </th>

                        <th>
                          Demand Factor
                        </th>

                        <th>
                          Demand Adjusted Cost
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {approvedPricingRecords.map(
                        (item) => (
                          <tr
                            key={
                              item.id
                            }
                            className="admin-pricing-row"
                          >

                            <td>

                              <span className="admin-pricing-route-badge">
                                {item.route_id}
                              </span>

                            </td>

                            <td>
                              {item.origin ||
                                "—"}
                            </td>

                            <td>
                              {item.destination ||
                                "—"}
                            </td>

                            <td>

                              <strong>
                                $
                                {Number(
                                  item.fuel_surcharge ||
                                    0
                                ).toLocaleString(
                                  "en-US"
                                )}
                              </strong>

                            </td>

                            <td>

                              <strong>
                                $
                                {Number(
                                  item.port_charge ||
                                    0
                                ).toLocaleString(
                                  "en-US"
                                )}
                              </strong>

                            </td>

                            <td>

                              <strong>
                                $
                                {Number(
                                  item.risk_surcharge ||
                                    0
                                ).toLocaleString(
                                  "en-US"
                                )}
                              </strong>

                            </td>

                            <td>

                              <strong>
                                $
                                {Number(
                                  item.operating_cost ||
                                    0
                                ).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </strong>

                            </td>

                            <td>

                              <span className="admin-demand-factor">
                                {Number(
                                  item.demand_factor ||
                                    0
                                ).toFixed(
                                  2
                                )}
                              </span>

                            </td>

                            <td>

                              <strong className="admin-demand-cost">
                                $
                                {Number(
                                  item.demand_adjusted_cost ||
                                    0
                                ).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </strong>

                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </section>

          </div>
        )}

        {/* =====================================================
            QUOTATIONS
        ===================================================== */}

        {activePage === "quotations" && (
          <div className="admin-page-content admin-quotations-page">

            <section className="admin-section-card">

              <div className="admin-section-header">

                <div>

                  <h2>
                    Quotation Management
                  </h2>

                  <p>
                    Review pending requests and maintain approved or rejected quotation history.
                  </p>

                </div>

                <div className="admin-quotation-header-actions">

                  <span className="admin-data-placeholder">
                    Total Submitted:{" "}
                    {
                      submittedQuotations.length
                    }
                  </span>

                  <button
                    type="button"
                    className="admin-download-csv-button"
                    onClick={
                      handleDownloadCSV
                    }
                  >
                    Download CSV
                  </button>

                </div>

              </div>

              {quotationsError && (
                <div className="admin-error-message">
                  {quotationsError}
                </div>
              )}

              {quotationsLoading ? (
                <div className="admin-loading-state">

                  <div className="admin-loading-icon">
                    ⏳
                  </div>

                  <h3>
                    Loading quotations...
                  </h3>

                  <p>
                    Fetching customer quotations from MySQL.
                  </p>

                </div>
              ) : submittedQuotations.length ===
                0 ? (
                <div className="admin-empty-state">

                  <div className="admin-empty-icon">
                    📄
                  </div>

                  <h3>
                    No quotations to review
                  </h3>

                  <p>
                    Saved-only quotations remain with customers until they request approval.
                  </p>

                </div>
              ) : (
                <div className="admin-quotation-list">

                  {submittedQuotations.map(
                    (
                      quotation,
                      index
                    ) => {

                      const status =
                        getNormalizedStatus(
                          quotation.status
                        );

                      const isPending =
                        status ===
                        "pending";

                      const isProcessing =
                        quotationActionLoading ===
                        quotation.id;

                      const pricingData =
                        quotation.pricing ||
                        {};

                      const selectedRoute =
                        quotation.selected_route ||
                        routes.find(
                          (route) =>
                            String(
                              route.route_id ||
                                route.id ||
                                ""
                            ).toLowerCase() ===
                            String(
                              quotation.selected_route_id ||
                                quotation.route_id ||
                                ""
                            ).toLowerCase()
                        ) ||
                        {};

                      const routePricing =
                        pricing.find(
                          (item) =>
                            String(
                              item.route_id ||
                                ""
                            ).toLowerCase() ===
                            String(
                              quotation.selected_route_id ||
                                quotation.route_id ||
                                selectedRoute.route_id ||
                                ""
                            ).toLowerCase()
                        ) ||
                        {};

                      const baseFreight =
                        Number(
                          pricingData.base_freight_usd ??
                            quotation.base_freight_usd ??
                            selectedRoute.base_freight_usd ??
                            routePricing.base_freight_usd ??
                            0
                        );

                      const fuelSurcharge =
                        Number(
                          pricingData.fuel_surcharge_usd ??
                            quotation.fuel_surcharge_usd ??
                            quotation.fuel_surcharge ??
                            routePricing.fuel_surcharge_usd ??
                            routePricing.fuel_surcharge ??
                            0
                        );

                      const portCharge =
                        Number(
                          pricingData.port_charge_usd ??
                            quotation.port_charge_usd ??
                            quotation.port_charge ??
                            routePricing.port_charge_usd ??
                            routePricing.port_charge ??
                            0
                        );

                      const riskSurcharge =
                        Number(
                          pricingData.risk_surcharge_usd ??
                            quotation.risk_surcharge_usd ??
                            quotation.risk_surcharge ??
                            routePricing.risk_surcharge_usd ??
                            routePricing.risk_surcharge ??
                            0
                        );

                      const totalOperationalCost =
                        Number(
                          pricingData.total_operational_cost_usd ??
                            pricingData.operating_cost_usd ??
                            quotation.total_operational_cost_usd ??
                            quotation.total_operational_cost ??
                            (
                              baseFreight +
                              fuelSurcharge +
                              portCharge +
                              riskSurcharge
                            ) *
                              Number(
                                quotation.container_count ??
                                  quotation.containers ??
                                  quotation.container_quantity ??
                                  0
                              )
                        );

                      const demandFactor =
                        Number(
                          pricingData.demand_factor ??
                            quotation.demand_factor ??
                            routePricing.demand_factor ??
                            1
                        );

                      const totalDemandAdjustedCost =
                        Number(
                          pricingData.total_demand_adjusted_cost_usd ??
                            pricingData.demand_adjusted_cost_usd ??
                            quotation.total_demand_adjusted_cost_usd ??
                            quotation.total_demand_adjusted_cost ??
                            totalOperationalCost * demandFactor
                        );

                      const finalSellingPrice =
                        Number(
                          pricingData.final_selling_price_usd ??
                            quotation.final_selling_price_usd ??
                            quotation.selling_price ??
                            0
                        );

                      const marginAmount =
                        Number(
                          pricingData.margin_amount_usd ??
                            quotation.margin_amount_usd ??
                            (
                              finalSellingPrice -
                              totalDemandAdjustedCost
                            )
                        );

                      const profit =
                        Number(
                          quotation.profit_usd ??
                            pricingData.profit_usd ??
                            marginAmount
                        );

                      const routeDistance =
                        Number(
                          selectedRoute.distance_nm ??
                            0
                        );

                      const routeTransitDays =
                        Number(
                          selectedRoute.transit_days ??
                            0
                        );

                      const routeTransshipments =
                        Number(
                          selectedRoute.transshipments ??
                            0
                        );

                      const displayQuotationNumber =
                        quotationNumberMap[
                          quotation.id
                        ] ??
                        submittedQuotations.length -
                          index;

                      return (
                        <div
                          className="admin-quotation-item admin-quotation-review-item"
                          key={
                            quotation.id
                          }
                          style={{
                            display:
                              "block",
                            padding:
                              "24px",
                          }}
                        >

                          {/* =================================================
                              QUOTATION HEADER
                          ================================================= */}

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "flex-start",
                              gap: "18px",
                              width:
                                "100%",
                            }}
                          >

                            <div className="admin-quotation-icon">
                              📄
                            </div>

                            <div
                              className="admin-quotation-details"
                              style={{
                                flex: 1,
                              }}
                            >

                              <strong>
                                Quotation #
                                {
                                  displayQuotationNumber
                                }
                              </strong>

                              <p>
                                {quotation.origin ||
                                  "—"}
                                {" → "}
                                {quotation.destination ||
                                  "—"}
                              </p>

                              <small>
                                Customer:{" "}
                                {quotation.customer
                                  ?.name ||
                                  quotation.customer_name ||
                                  "Unknown Customer"}
                              </small>

                              <small>
                                Email:{" "}
                                {quotation.customer
                                  ?.email ||
                                  quotation.customer_email ||
                                  "—"}
                              </small>

                              <small>
                                Cargo:{" "}
                                {quotation.cargo_type ||
                                  "—"}
                                {" • "}
                                {quotation.container_count ||
                                  quotation.containers ||
                                  0}
                                {" containers"}
                              </small>

                              <small>
                                Selected Route:{" "}
                                {quotation.selected_route_id ||
                                  selectedRoute.route_id ||
                                  "—"}
                              </small>

                            </div>

                            <div
                              className="admin-quotation-meta"
                              style={{
                                minWidth:
                                  "145px",
                                alignItems:
                                  "flex-end",
                              }}
                            >

                              <span
                                className={`admin-status-badge ${getStatusClass(
                                  quotation.status
                                )}`}
                              >
                                {getStatusLabel(
                                  quotation.status
                                )}
                              </span>

                              <small>
                                {formatDate(
                                  quotation.created_at
                                )}
                              </small>

                              {/* PENDING ACTIONS */}

                              {isPending && (
                                <div className="admin-quotation-actions">

                                  <button
                                    type="button"
                                    className="admin-approve-button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      handleApproveQuotation(
                                        quotation.id
                                      )
                                    }
                                  >
                                    {isProcessing
                                      ? "Processing..."
                                      : "Approve"}
                                  </button>

                                  <button
                                    type="button"
                                    className="admin-reject-button"
                                    disabled={
                                      isProcessing
                                    }
                                    onClick={() =>
                                      handleRejectQuotation(
                                        quotation.id
                                      )
                                    }
                                  >
                                    {isProcessing
                                      ? "Processing..."
                                      : "Reject"}
                                  </button>

                                </div>
                              )}

                              {/* APPROVED MESSAGE */}

                              {status ===
                                "approved" && (
                                <div className="admin-decision-message approved-message">
                                  Quotation approved
                                </div>
                              )}

                              {/* REJECTED MESSAGE */}

                              {status ===
                                "rejected" && (
                                <div className="admin-decision-message rejected-message">
                                  Quotation rejected
                                </div>
                              )}

                            </div>

                          </div>

                          {/* =================================================
                              ROUTE INFORMATION
                          ================================================= */}

                          <div className="admin-quotation-detail-section">

                            <h4 className="admin-quotation-detail-heading">
                              Selected Route Details
                            </h4>

                            <div className="admin-quotation-detail-grid admin-route-detail-grid">

                              <div className="admin-quotation-detail-item">
                                <span>Route</span>
                                <strong>
                                  {quotation.selected_route_id ||
                                    selectedRoute.route_id ||
                                    "—"}
                                </strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Route Type</span>
                                <strong>
                                  {selectedRoute.route_type || "—"}
                                </strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Distance</span>
                                <strong>
                                  {routeDistance
                                    ? `${routeDistance.toLocaleString("en-US")} nm`
                                    : "—"}
                                </strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Transit Time</span>
                                <strong>
                                  {routeTransitDays
                                    ? `${routeTransitDays} days`
                                    : "—"}
                                </strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Transshipments</span>
                                <strong>
                                  {routeTransshipments}{" "}
                                  {routeTransshipments === 1 ? "Stop" : "Stops"}
                                </strong>
                              </div>

                            </div>

                          </div>

                          {/* =================================================
                              COST & MARGIN DETAILS
                          ================================================= */}

                          <div className="admin-quotation-detail-section admin-quotation-pricing-section">

                            <h4 className="admin-quotation-detail-heading">
                              Cost &amp; Margin Details
                            </h4>

                            <div className="admin-quotation-detail-grid admin-cost-detail-grid">

                              <div className="admin-quotation-detail-item">
                                <span>Base Freight</span>
                                <strong>{formatUSD(baseFreight)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Fuel Surcharge</span>
                                <strong>{formatUSD(fuelSurcharge)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Port Charge</span>
                                <strong>{formatUSD(portCharge)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Risk Surcharge</span>
                                <strong>{formatUSD(riskSurcharge)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Total Operational Cost</span>
                                <strong>{formatUSD(totalOperationalCost)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Demand Factor</span>
                                <strong>{demandFactor.toFixed(2)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Total Demand Adjusted Cost</span>
                                <strong>{formatUSD(totalDemandAdjustedCost)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Final Selling Price</span>
                                <strong>{formatUSD(finalSellingPrice)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Margin</span>
                                <strong>15.00%</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Profit</span>
                                <strong>{formatUSD(profit)}</strong>
                              </div>

                              <div className="admin-quotation-detail-item">
                                <span>Status</span>
                                <strong>
                                  {getStatusLabel(quotation.status)}
                                </strong>
                              </div>

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </section>

          </div>
        )}

        {/* =====================================================
            FEEDBACK
        ===================================================== */}

        {activePage === "feedback" && (
          <div className="admin-page-content admin-feedback-page">

            <section className="admin-section-card admin-feedback-section">

              <div className="admin-section-header admin-feedback-header">

                <div>

                  <span className="admin-section-eyebrow">
                    CUSTOMER EXPERIENCE
                  </span>

                  <h2>
                    Customer Feedback
                  </h2>

                  <p>
                    Review actual feedback submitted by customers.
                  </p>

                </div>

                <div className="admin-feedback-count-card">

                  <span>
                    Total Feedback
                  </span>

                  <strong>
                    {feedback.length}
                  </strong>

                </div>

              </div>

              {feedbackError && (
                <div className="admin-error-message">
                  {feedbackError}
                </div>
              )}

              {feedbackLoading ? (
                <div className="admin-loading-state">

                  <div className="admin-loading-icon">
                    ⏳
                  </div>

                  <h3>
                    Loading feedback...
                  </h3>

                  <p>
                    Fetching customer feedback from MySQL.
                  </p>

                </div>
              ) : feedback.length ===
                0 ? (
                <div className="admin-empty-state">

                  <div className="admin-empty-icon">
                    ⭐
                  </div>

                  <h3>
                    No feedback available
                  </h3>

                  <p>
                    Customer feedback will appear here after submission.
                  </p>

                </div>
              ) : (
                <div className="admin-feedback-list">

                  {feedback.map(
                    (item) => {

                      const rating =
                        Math.max(
                          0,
                          Math.min(
                            5,
                            Number(
                              item.rating
                            ) || 0
                          )
                        );

                      return (
                        <div
                          className="admin-feedback-item"
                          key={
                            item.id
                          }
                        >

                          <div className="admin-feedback-icon">
                            ⭐
                          </div>

                          <div className="admin-feedback-details">

                            <div className="admin-feedback-customer-row">

                              <strong>
                                {item.customer
                                  ?.name ||
                                  "Unknown Customer"}
                              </strong>

                              <span className="admin-feedback-rating">

                                {"★".repeat(
                                  rating
                                )}

                                {"☆".repeat(
                                  5 -
                                    rating
                                )}

                              </span>

                            </div>

                            <p>
                              {item.comments ||
                                "No written feedback provided."}
                            </p>

                            <small>
                              📧{" "}
                              {item.customer
                                ?.email ||
                                "—"}

                              {item.customer
                                ?.company_name
                                ? ` • 🏢 ${item.customer.company_name}`
                                : ""}
                            </small>

                            {item.quotation_id && (
                              <small>
                                Quotation #
                                {
                                  item.quotation_id
                                }

                                {item.quotation
                                  ?.selected_route_id
                                  ? ` • Route ${item.quotation.selected_route_id}`
                                  : ""}
                              </small>
                            )}

                          </div>

                          <div className="admin-feedback-meta">

                            <span className="admin-feedback-rating-number">
                              {rating}/5
                            </span>

                            <small>
                              {formatDate(
                                item.created_at
                              )}
                            </small>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </section>

          </div>
        )}

        {/* =====================================================
            SETTINGS
        ===================================================== */}

        {activePage === "settings" && (
          <div className="admin-page-content admin-settings-page">

            <section className="admin-section-card">

              <div className="admin-section-header">

                <div>

                  <h2>
                    Admin Settings
                  </h2>

                  <p>
                    Manage administrator settings.
                  </p>

                </div>

              </div>

              <div className="admin-empty-state">

                <div className="admin-empty-icon">
                  ⚙️
                </div>

                <h3>
                  Settings
                </h3>

               <p>
                  Additional administrator settings can be configured here.
                </p>

              </div>

            </section>

          </div>
        )}

      </main>

    </div>
  );
}

export default AdminDashboard;