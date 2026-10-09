import { useCallback, useEffect, useState } from "react";
import "./AdminQuotation.css";

const API_BASE = "http://localhost:8000";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toLocaleString()}${suffix}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  if (value === "pending") return "pending";
  return "unknown";
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  const label =
    normalized === "unknown"
      ? status || "Unknown"
      : normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className={`admin-quotation-status-badge admin-status-${normalized}`}>
      <span className="admin-status-dot" />
      {label}
    </span>
  );
}

function DetailField({ label, value }) {
  const displayValue =
    value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className="aq-detail-field">
      <span className="aq-detail-label">{label}</span>
      <span className="aq-detail-value">{displayValue}</span>
    </div>
  );
}

function DetailSection({ title, description, children, className = "" }) {
  return (
    <section className={`aq-detail-section ${className}`}>
      <div className="aq-section-heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="aq-detail-grid">{children}</div>
    </section>
  );
}

function getPricingValue(quotation, ...keys) {
  const pricing = quotation?.pricing || {};
  for (const key of keys) {
    if (pricing[key] !== null && pricing[key] !== undefined && pricing[key] !== "") {
      return pricing[key];
    }
    if (
      quotation?.[key] !== null &&
      quotation?.[key] !== undefined &&
      quotation?.[key] !== ""
    ) {
      return quotation[key];
    }
  }
  return null;
}

function getCustomer(quotation) {
  return quotation?.customer || {};
}

function getRoute(quotation) {
  return quotation?.selected_route || {};
}

function getRouteId(quotation) {
  const route = getRoute(quotation);
  return route.route_id || quotation.selected_route_id || quotation.route_id || "—";
}

function getQuotationId(quotation) {
  return quotation.quotation_id ?? quotation.id ?? "—";
}

function getSellingPrice(quotation) {
  return getPricingValue(
    quotation,
    "final_selling_price_usd",
    "selling_price",
    "total_selling_price",
    "total_price"
  );
}

function getProfit(quotation) {
  // Use profit supplied by the backend for every status when available.
  const profit = getPricingValue(quotation, "profit_usd", "margin_amount_usd");
  if (profit !== null && profit !== undefined && profit !== "") return profit;

  // Otherwise use the existing selling price and demand-adjusted cost values.
  // This does not change or overwrite the backend's stored pricing.
  const sellingPrice = getSellingPrice(quotation);
  const adjustedCost = getPricingValue(
    quotation,
    "demand_adjusted_cost_usd",
    "total_demand_adjusted_cost_usd",
    "demand_adjusted_total_cost_usd",
    "demand_adjusted_cost"
  );

  if (
    sellingPrice !== null &&
    sellingPrice !== undefined &&
    sellingPrice !== "" &&
    adjustedCost !== null &&
    adjustedCost !== undefined &&
    adjustedCost !== ""
  ) {
    const sellingPriceNumber = Number(sellingPrice);
    const adjustedCostNumber = Number(adjustedCost);
    if (Number.isFinite(sellingPriceNumber) && Number.isFinite(adjustedCostNumber)) {
      return sellingPriceNumber - adjustedCostNumber;
    }
  }

  return null;
}

function getContainerCount(quotation) {
  return quotation.container_count ?? null;
}

function getWeatherRisk(quotation) {
  return quotation.weather_risk || quotation.weather_risk_level || "—";
}

function getCustomsStatus(quotation) {
  return quotation.customs_status || "—";
}

function getWeatherCondition(quotation) {
  return quotation.weather_condition || quotation.weather?.weather_condition || "—";
}

function getMarginPercentage(quotation) {
  return getPricingValue(
    quotation,
    "actual_margin_percent",
    "margin_percentage",
    "target_margin_percent"
  );
}

function getMarginDisplay(quotation) {
  const margin = getMarginPercentage(quotation);
  if (margin === null || margin === undefined || margin === "") return "—";
  return `${formatNumber(margin)}%`;
}

function getStatusCounts(quotations) {
  return quotations.reduce(
    (counts, quotation) => {
      const status = normalizeStatus(quotation.status);
      if (status === "pending") counts.pending += 1;
      if (status === "approved") counts.approved += 1;
      if (status === "rejected") counts.rejected += 1;
      return counts;
    },
    { total: quotations.length, pending: 0, approved: 0, rejected: 0 }
  );
}

const REJECTION_REASONS = [
  "Price is too high",
  "Route score below requirement",
  "Customer compliance or clearance risk",
  "Weather or operational risk",
  "Incomplete shipment information",
  "Customs or documentation risk",
  "Customer request changed",
  "Route or capacity availability issue",
  "Other",
];

function AdminQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");
  const [highlightedQuotationId, setHighlightedQuotationId] = useState(null);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/admin-quotations/`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Admin authentication failed. Please log in again.");
        }
        const message = await response.text();
        throw new Error(message || `Unable to load quotations (${response.status}).`);
      }

      const data = await response.json();
      const quotationList = Array.isArray(data)
        ? data
        : Array.isArray(data.quotations)
        ? data.quotations
        : null;

      if (!quotationList) {
        throw new Error("The quotations API response does not contain a valid quotations array.");
      }

      setQuotations(quotationList);
      setSelectedQuotation((current) => {
        if (!current) return null;
        const currentId = String(current.id ?? current.quotation_id);
        return (
          quotationList.find(
            (quotation) =>
              String(quotation.id ?? quotation.quotation_id) === currentId
          ) || null
        );
      });
    } catch (err) {
      setError(err.message || "Unable to load quotations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  // Open the exact quotation referenced by an admin notification.
  useEffect(() => {
    if (!quotations.length) return;

    try {
      const storedTarget = sessionStorage.getItem(
        "admin_notification_target"
      );

      if (!storedTarget) return;

      const target = JSON.parse(storedTarget);

      if (target?.type !== "quotation") return;

      const quotation = quotations.find(
        (item) =>
          String(item.id ?? item.quotation_id) ===
          String(target.id)
      );

      if (!quotation) return;

      sessionStorage.removeItem("admin_notification_target");

      const quotationId = quotation.id ?? quotation.quotation_id;
      setHighlightedQuotationId(String(quotationId));

      window.setTimeout(() => {
        document
          .getElementById(`admin-quotation-${quotationId}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 100);

      window.setTimeout(() => {
        setHighlightedQuotationId(null);
      }, 4500);
    } catch (error) {
      console.error(
        "Admin quotation notification target error:",
        error
      );
    }
  }, [quotations]);

  const counts = getStatusCounts(quotations);
  const filteredQuotations = quotations.filter((quotation) => {
    const status = normalizeStatus(quotation.status);
    if (activeFilter !== "all" && status !== activeFilter) return false;
    const customer = getCustomer(quotation);
    const searchableText = [
      getQuotationId(quotation),
      customer.name,
      customer.email,
      customer.company_name,
      quotation.origin,
      quotation.destination,
      getRouteId(quotation),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchableText.includes(searchTerm.toLowerCase().trim());
  });

  function openDetails(quotation) {
    setSelectedQuotation(quotation);
    setActionError("");
    setSuccessMessage("");
    setShowRejectReason(false);
    setRejectReason("");
    setCustomRejectReason("");
  }

  function closeDetails() {
    if (actionLoading) return;
    setSelectedQuotation(null);
    setActionError("");
  }

  async function handleDecision(decision, rejectionReason = null) {
    if (!selectedQuotation || actionLoading) return;
    const currentStatus = normalizeStatus(selectedQuotation.status);

    if (decision === "reject" && currentStatus === "rejected") {
      setShowRejectReason(true);
      return;
    }

    if (currentStatus !== "pending") {
      setActionError("Only pending quotations can be approved or rejected.");
      return;
    }

    const quotationId = selectedQuotation.id ?? selectedQuotation.quotation_id;
    if (quotationId === null || quotationId === undefined) {
      setActionError("The quotation ID is missing.");
      return;
    }

    const actionLabel = decision === "approve" ? "approve" : "reject";
    if (decision === "approve" && !window.confirm(`Are you sure you want to approve quotation ${quotationId}?`)) {
      return;
    }

    setActionLoading(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const requestOptions = {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      };

      if (decision === "reject") {
        requestOptions.headers["Content-Type"] = "application/json";
        requestOptions.body = JSON.stringify({ reason: rejectionReason || null });
      }

      const response = await fetch(
        `${API_BASE}/api/admin-quotations/${encodeURIComponent(quotationId)}/${actionLabel}`,
        requestOptions
      );

      if (!response.ok) {
        let message = "";
        try {
          const data = await response.json();
          message = data.detail || data.message || data.error || "";
        } catch {
          message = await response.text();
        }
        throw new Error(message || `Unable to ${actionLabel} quotation (${response.status}).`);
      }

      let result = {};
      try {
        result = await response.json();
      } catch {
        // The endpoint may return an empty response.
      }

      const updatedStatus =
        normalizeStatus(result.status) !== "unknown"
          ? normalizeStatus(result.status)
          : decision === "approve"
          ? "approved"
          : "rejected";

      const returnedReason = result.rejection_reason ?? rejectionReason ?? null;

      setQuotations((previous) =>
        previous.map((quotation) => {
          const currentId = quotation.id ?? quotation.quotation_id;
          return String(currentId) !== String(quotationId)
            ? quotation
            : { ...quotation, ...result, status: updatedStatus, rejection_reason: returnedReason };
        })
      );

      setSelectedQuotation((previous) =>
        previous
          ? { ...previous, ...result, status: updatedStatus, rejection_reason: returnedReason }
          : null
      );
      setSuccessMessage(
        decision === "reject"
          ? returnedReason
            ? `Quotation ${quotationId} was rejected with a reason.`
            : `Quotation ${quotationId} was rejected. You can add a reason later.`
          : `Quotation ${quotationId} was approved.`
      );
      setShowRejectReason(false);
      setRejectReason("");
      setCustomRejectReason("");

      await loadQuotations();
    } catch (err) {
      setActionError(err.message || `Unable to ${actionLabel} this quotation.`);
    } finally {
      setActionLoading(false);
    }
  }

  async function saveLaterRejectionReason() {
    if (!selectedQuotation || actionLoading) return;
    const quotationId = selectedQuotation.id ?? selectedQuotation.quotation_id;
    const finalReason = rejectReason === "Other" ? customRejectReason.trim() : rejectReason;
    if (!finalReason) {
      setActionError("Please select or enter a rejection reason.");
      return;
    }

    setActionLoading(true);
    setActionError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/admin-quotations/${encodeURIComponent(quotationId)}/rejection-reason`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: finalReason }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to save the rejection reason.");

      setSelectedQuotation((previous) =>
        previous ? { ...previous, rejection_reason: finalReason } : null
      );
      setQuotations((previous) =>
        previous.map((quotation) =>
          String(quotation.id ?? quotation.quotation_id) === String(quotationId)
            ? { ...quotation, rejection_reason: finalReason }
            : quotation
        )
      );
      setShowRejectReason(false);
      setRejectReason("");
      setCustomRejectReason("");
      setSuccessMessage("Rejection reason saved successfully.");
    } catch (err) {
      setActionError(err.message || "Unable to save the rejection reason.");
    } finally {
      setActionLoading(false);
    }
  }

  function renderPricingFields(quotation) {
    const fields = [
      {
        label: "Base Cost",
        value: getPricingValue(
          quotation,
          "total_base_freight_usd",
          "base_cost_usd",
          "base_freight_usd"
        ),
        money: true,
      },
      {
        label: "Fuel Charges",
        value: getPricingValue(quotation, "fuel_surcharge_usd", "fuel_surcharge"),
        money: true,
      },
      {
        label: "Port Surcharge",
        value: getPricingValue(quotation, "port_charge_usd", "port_charge"),
        money: true,
      },
      {
        label: "Risk Surcharges",
        value: getPricingValue(quotation, "risk_surcharge_usd", "risk_surcharge"),
        money: true,
      },
      {
        label: "Demand Adjustment Cost",
        value: getPricingValue(
          quotation,
          "demand_adjusted_cost_usd",
          "total_demand_adjusted_cost_usd",
          "demand_adjusted_total_cost_usd",
          "demand_adjusted_cost"
        ),
        money: true,
      },
      {
        label: "Total Operational Cost",
        value: getPricingValue(
          quotation,
          "total_operational_cost_usd",
          "operating_cost_usd",
          "operating_cost"
        ),
        money: true,
      },
      { label: "Margin Percentage", value: getMarginDisplay(quotation), money: false },
      { label: "Profit Amount", value: getProfit(quotation), money: true },
      { label: "Total Selling Price", value: getSellingPrice(quotation), money: true },
    ];

    return fields.map((field) => (
      <DetailField
        key={field.label}
        label={field.label}
        value={field.money ? formatMoney(field.value) : field.value}
      />
    ));
  }

  return (
    <div className="aq-page">
      <header className="aq-page-header">
        <div>
          <span className="aq-eyebrow">ADMINISTRATION</span>
          <h1>Quotation Management</h1>
          <p>Review customer quotations and manage approval decisions.</p>
        </div>
        <button
          type="button"
          className="aq-refresh-button"
          onClick={loadQuotations}
          disabled={loading || actionLoading}
        >
          ↻ &nbsp; Refresh
        </button>
      </header>

      {error && (
        <div className="aq-alert aq-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadQuotations}>Retry</button>
        </div>
      )}

      {successMessage && (
        <div className="aq-alert aq-alert-success" role="status">
          {successMessage}
        </div>
      )}

      <section className="aq-summary-grid">
        <div className="aq-summary-card">
          <span className="aq-summary-icon">▤</span>
          <div><p>Total Quotations</p><strong>{counts.total}</strong></div>
        </div>
        <div className="aq-summary-card aq-summary-pending">
          <span className="aq-summary-icon">◷</span>
          <div><p>Pending Review</p><strong>{counts.pending}</strong></div>
        </div>
        <div className="aq-summary-card aq-summary-approved">
          <span className="aq-summary-icon">✓</span>
          <div><p>Approved</p><strong>{counts.approved}</strong></div>
        </div>
        <div className="aq-summary-card aq-summary-rejected">
          <span className="aq-summary-icon">×</span>
          <div><p>Rejected</p><strong>{counts.rejected}</strong></div>
        </div>
      </section>

      <section className="aq-list-section">
        <div className="aq-list-heading">
          <div>
            <h2>Customer Quotations</h2>
            <p>View quotation information and review pending requests.</p>
          </div>
          <span className="aq-record-count">{filteredQuotations.length} records</span>
        </div>

        <div className="aq-toolbar">
          <input
            type="search"
            className="aq-search-input"
            placeholder="Search quotation, customer, or route..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search quotations"
          />
          <div className="aq-filter-buttons">
            {[
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={activeFilter === value ? "aq-filter-button active" : "aq-filter-button"}
                onClick={() => setActiveFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="aq-table-wrapper">
          <table className="aq-table">
            <thead>
              <tr>
                <th>Quotation ID</th><th>Customer</th><th>Company</th><th>Route</th>
                <th>Containers</th><th>Date</th><th>Selling Price</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="aq-empty-cell">Loading quotations...</td></tr>
              ) : filteredQuotations.length === 0 ? (
                <tr><td colSpan="9" className="aq-empty-cell">No quotations found.</td></tr>
              ) : (
                filteredQuotations.map((quotation) => {
                  const customer = getCustomer(quotation);
                  return (
                    <tr
                      key={quotation.id ?? quotation.quotation_id}
                      id={`admin-quotation-${quotation.id ?? quotation.quotation_id}`}
                      className={
                        String(quotation.id ?? quotation.quotation_id) ===
                        String(highlightedQuotationId)
                          ? "aq-notification-highlight"
                          : ""
                      }
                    >
                      <td className="aq-quotation-id">#{getQuotationId(quotation)}</td>
                      <td>
                        <div className="aq-customer-name">{customer.name || "—"}</div>
                        <div className="aq-secondary-text">{customer.email || "—"}</div>
                      </td>
                      <td>{customer.company_name || "—"}</td>
                      <td>
                        <div className="aq-route-cell">
                          <span>{quotation.origin || "—"}</span>
                          <span className="aq-route-arrow">→</span>
                          <span>{quotation.destination || "—"}</span>
                        </div>
                      </td>
                      <td>{formatNumber(getContainerCount(quotation))}</td>
                      <td>{formatDate(quotation.created_at)}</td>
                      <td className="aq-money-cell">{formatMoney(getSellingPrice(quotation))}</td>
                      <td><StatusBadge status={quotation.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="aq-view-button"
                          onClick={() => openDetails(quotation)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedQuotation && (
        <div
          className="aq-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <div className="aq-modal" role="dialog" aria-modal="true" aria-labelledby="aq-modal-title">
            <header className="aq-modal-header">
              <div>
                <span className="aq-eyebrow">QUOTATION DETAILS</span>
                <h2 id="aq-modal-title">Quotation #{getQuotationId(selectedQuotation)}</h2>
                <div className="aq-modal-status"><StatusBadge status={selectedQuotation.status} /></div>
              </div>
              <button
                type="button"
                className="aq-close-button"
                onClick={closeDetails}
                disabled={actionLoading}
                aria-label="Close quotation details"
              >
                ×
              </button>
            </header>

            <div className="aq-modal-body">
              {actionError && <div className="aq-alert aq-alert-error" role="alert">{actionError}</div>}
              {successMessage && <div className="aq-alert aq-alert-success" role="status">{successMessage}</div>}

              <DetailSection
                title="A. User Information"
                description="Customer details associated with this quotation."
              >
                <DetailField label="User Name" value={getCustomer(selectedQuotation).name} />
                <DetailField label="Email Address" value={getCustomer(selectedQuotation).email} />
                <DetailField label="Company Name" value={getCustomer(selectedQuotation).company_name} />
              </DetailSection>

              <DetailSection
                title="B. Quotation & Route Information"
                description="Shipment and selected route details."
              >
                <DetailField label="Quotation ID" value={`#${getQuotationId(selectedQuotation)}`} />
                <DetailField label="Route ID" value={getRouteId(selectedQuotation)} />
                <DetailField label="Origin" value={selectedQuotation.origin} />
                <DetailField label="Destination" value={selectedQuotation.destination} />
                <DetailField label="Cargo Type" value={selectedQuotation.cargo_type} />
                <DetailField label="Number of Containers" value={formatNumber(getContainerCount(selectedQuotation))} />
                <DetailField label="Number of Transshipments" value={formatNumber(getRoute(selectedQuotation).transshipments)} />
                <DetailField label="Transit Days" value={formatNumber(getRoute(selectedQuotation).transit_days, " days")} />
                <DetailField label="Transit Distance" value={formatNumber(getRoute(selectedQuotation).distance_nm, " nautical miles")} />
              </DetailSection>

              <DetailSection
                title="C. Pricing Details"
                description="Pricing values returned by the existing backend."
                className="aq-pricing-section"
              >
                {renderPricingFields(selectedQuotation)}
              </DetailSection>

              <DetailSection
                title="D. Weather Assessment"
                description="Complete weather assessment associated with the selected route."
              >
                <DetailField
                  label="Weather Risk Level"
                  value={getWeatherRisk(selectedQuotation)}
                />
                <DetailField
                  label="Weather Condition"
                  value={getWeatherCondition(selectedQuotation)}
                />
                <DetailField
                  label="Wind Speed"
                  value={
                    selectedQuotation.weather?.wind_speed_knots ??
                    selectedQuotation.wind_speed_knots
                  }
                />
                <DetailField
                  label="Wave Height"
                  value={
                    selectedQuotation.weather?.wave_height_m ??
                    selectedQuotation.wave_height_m
                  }
                />
                <DetailField
                  label="Visibility"
                  value={
                    selectedQuotation.weather?.visibility_km ??
                    selectedQuotation.visibility_km
                  }
                />
                <DetailField
                  label="Storm Probability"
                  value={
                    selectedQuotation.weather?.storm_probability_percent ??
                    selectedQuotation.weather?.storm_probability ??
                    selectedQuotation.storm_probability_percent
                  }
                />
                <DetailField
                  label="Risk Points"
                  value={
                    selectedQuotation.weather?.risk_points ??
                    selectedQuotation.risk_points
                  }
                />
              </DetailSection>

              <DetailSection
                title="E. Customs Assessment"
                description="Complete customs documentation and compliance assessment."
              >
                <DetailField
                  label="Customs ID"
                  value={selectedQuotation.customs?.customs_id ?? selectedQuotation.customs_id}
                />
                <DetailField
                  label="Cargo Type"
                  value={selectedQuotation.customs?.cargo_type ?? selectedQuotation.cargo_type}
                />
                <DetailField
                  label="HS Code Required"
                  value={selectedQuotation.customs?.hs_code_required}
                />
                <DetailField
                  label="Commercial Invoice"
                  value={selectedQuotation.customs?.commercial_invoice}
                />
                <DetailField
                  label="Packing List"
                  value={selectedQuotation.customs?.packing_list}
                />
                <DetailField
                  label="Certificate of Origin"
                  value={selectedQuotation.customs?.certificate_of_origin}
                />
                <DetailField
                  label="Restricted Cargo"
                  value={selectedQuotation.customs?.restricted_cargo}
                />
                <DetailField
                  label="Customs Status"
                  value={getCustomsStatus(selectedQuotation)}
                />
                <DetailField
                  label="Missing Documents"
                  value={
                    Array.isArray(selectedQuotation.customs?.missing_documents)
                      ? selectedQuotation.customs.missing_documents.join(", ") || "None"
                      : "None"
                  }
                />
                <DetailField
                  label="Recommendation"
                  value={selectedQuotation.customs?.recommendation}
                />
              </DetailSection>

              <section className="aq-decision-section">
                <div className="aq-section-heading">
                  <h3>F. Admin Decision</h3>
                  <p>Approve or reject this customer quotation request.</p>
                </div>
                {normalizeStatus(selectedQuotation.status) === "pending" ? (
                  <>
                    <div className="aq-decision-buttons">
                      <button
                        type="button"
                        className="aq-approve-button"
                        onClick={() => handleDecision("approve")}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Processing..." : "✓ Approve Quotation"}
                      </button>
                      <button
                        type="button"
                        className="aq-reject-button"
                        onClick={() => {
                          setShowRejectReason(true);
                          setActionError("");
                          setSuccessMessage("");
                          setRejectReason("");
                          setCustomRejectReason("");
                        }}
                        disabled={actionLoading}
                      >
                        × Reject Quotation
                      </button>
                    </div>

                    {showRejectReason && (
                      <div className="aq-rejection-card">
                        <div className="aq-rejection-card-heading">
                          <div>
                            <h4>Rejection Reason</h4>
                            <p>Select a reason for rejecting this quotation, or skip for now.</p>
                          </div>
                        </div>
                        <label className="aq-rejection-label" htmlFor="aq-rejection-reason">Reason</label>
                        <select
                          id="aq-rejection-reason"
                          className="aq-rejection-select"
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          disabled={actionLoading}
                        >
                          <option value="">Select a reason</option>
                          {REJECTION_REASONS.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>

                        {rejectReason === "Other" && (
                          <textarea
                            className="aq-rejection-textarea"
                            value={customRejectReason}
                            onChange={(event) => setCustomRejectReason(event.target.value)}
                            placeholder="Enter the rejection reason..."
                            rows={3}
                            disabled={actionLoading}
                          />
                        )}

                        <div className="aq-rejection-actions">
                          <button
                            type="button"
                            className="aq-secondary-button"
                            onClick={() => {
                              setShowRejectReason(false);
                              setRejectReason("");
                              setCustomRejectReason("");
                            }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="aq-skip-rejection-button"
                            onClick={() => handleDecision("reject", null)}
                            disabled={actionLoading}
                          >
                            Skip for now & Reject
                          </button>
                          <button
                            type="button"
                            className="aq-confirm-reject-button"
                            onClick={() => {
                              const finalReason = rejectReason === "Other" ? customRejectReason.trim() : rejectReason;
                              if (!finalReason) {
                                setActionError("Please select a rejection reason or use Skip for now.");
                                return;
                              }
                              handleDecision("reject", finalReason);
                            }}
                            disabled={actionLoading}
                          >
                            Reject with Reason
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="aq-decision-complete">
                      This quotation has already been{" "}
                      {normalizeStatus(selectedQuotation.status) === "approved" ? "approved" : "rejected"}.
                    </p>
                    {normalizeStatus(selectedQuotation.status) === "rejected" && (
                      <div className="aq-rejection-card aq-existing-rejection-card">
                        <div className="aq-rejection-card-heading">
                          <div>
                            <h4>Rejection Reason</h4>
                            <p>
                              {selectedQuotation.rejection_reason
                                ? "This is the reason shown to the customer."
                                : "No reason was provided when this quotation was rejected. You can add one now."}
                            </p>
                          </div>
                        </div>
                        {selectedQuotation.rejection_reason ? (
                          <div className="aq-existing-reason">{selectedQuotation.rejection_reason}</div>
                        ) : null}
                        <button
                          type="button"
                          className="aq-add-reason-button"
                          onClick={() => {
                            setShowRejectReason(true);
                            setRejectReason("");
                            setCustomRejectReason("");
                            setActionError("");
                          }}
                          disabled={actionLoading}
                        >
                          {selectedQuotation.rejection_reason ? "Update Rejection Reason" : "Add Rejection Reason"}
                        </button>

                        {showRejectReason && (
                          <div className="aq-rejection-editor">
                            <label className="aq-rejection-label" htmlFor="aq-existing-rejection-reason">Reason</label>
                            <select
                              id="aq-existing-rejection-reason"
                              className="aq-rejection-select"
                              value={rejectReason}
                              onChange={(event) => setRejectReason(event.target.value)}
                              disabled={actionLoading}
                            >
                              <option value="">Select a reason</option>
                              {REJECTION_REASONS.map((reason) => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                            {rejectReason === "Other" && (
                              <textarea
                                className="aq-rejection-textarea"
                                value={customRejectReason}
                                onChange={(event) => setCustomRejectReason(event.target.value)}
                                placeholder="Enter the rejection reason..."
                                rows={3}
                                disabled={actionLoading}
                              />
                            )}
                            <div className="aq-rejection-actions">
                              <button
                                type="button"
                                className="aq-secondary-button"
                                onClick={() => setShowRejectReason(false)}
                                disabled={actionLoading}
                              >Cancel</button>
                              <button
                                type="button"
                                className="aq-confirm-reject-button"
                                onClick={saveLaterRejectionReason}
                                disabled={actionLoading}
                              >Save Reason</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            <footer className="aq-modal-footer">
              <button
                type="button"
                className="aq-secondary-button"
                onClick={closeDetails}
                disabled={actionLoading}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminQuotations;
