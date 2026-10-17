
import React, { useCallback, useEffect, useState } from "react";
import "./MyShipments.css";

const API_BASE = "http://localhost:8000/api/shipments";

const STATUS_STEPS = [
  { key: "booked", label: "Booked" },
  { key: "pickup", label: "Pickup" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

const STATUS_LABELS = {
  booked: "Booked",
  pickup: "Pickup",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const COLORS = {
  brown: "#4B2E24",
  darkBrown: "#352018",
  accent: "#8B5E3C",
  background: "#F7F0E5",
  white: "#FFFDF8",
  border: "#E8D8C4",
  muted: "#80695A",
};

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status) {
  const colors = {
    booked: ["#F1E3D3", "#704526"],
    pickup: ["#FFF0C2", "#79551C"],
    in_transit: ["#DDEBF7", "#285A85"],
    out_for_delivery: ["#EEE2FA", "#6C4895"],
    delivered: ["#DDF3E4", "#246943"],
    cancelled: ["#F8DEDA", "#963C2F"],
  };

  const [background, color] = colors[status] || colors.booked;

  return {
    display: "inline-block",
    padding: "6px 11px",
    borderRadius: "20px",
    background,
    color,
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}


const PAYMENT_STATUS_LABELS = {
  paid: "Paid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  unpaid: "Unpaid",
  rejected: "Payment Rejected",
};

function getPaymentStatus(shipment) {
  return String(
    shipment?.payment_status ??
    shipment?.aggregate_payment_status ??
    shipment?.payment?.payment_status ??
    "not_available"
  ).toLowerCase();
}

function getPaymentStatusStyle(status) {
  const styles = {
    paid: ["#DDF3E4", "#246943"],
    pending_verification: ["#FFF0C2", "#79551C"],
    partially_paid: ["#DDEBF7", "#285A85"],
    unpaid: ["#F1E3D3", "#704526"],
    rejected: ["#F8DEDA", "#963C2F"],
    not_available: ["#EAE4DE", "#6B5B50"],
  };

  const normalized =
    status === "payment_rejected" ? "rejected" : status;

  const [background, color] =
    styles[normalized] || styles.not_available;

  return {
    display: "inline-block",
    padding: "6px 11px",
    borderRadius: "20px",
    background,
    color,
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function getPaymentStatusLabel(status) {
  if (status === "not_available") return "Not Available";

  return (
    PAYMENT_STATUS_LABELS[status] ||
    (status === "payment_rejected" ? "Payment Rejected" : status)
  );
}

function MyShipments() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationRequests, setCancellationRequests] = useState({});
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState("");
  const [cancellationError, setCancellationError] = useState("");

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/my`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 403) {
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.detail || data.message || "Unable to load shipments."
        );
      }

      const list = Array.isArray(data.shipments)
        ? data.shipments
        : [];

      setShipments(list);

      setSelectedShipment((previous) => {
        if (!previous) return null;

        return (
          list.find(
            (item) =>
              item.shipment_id === previous.shipment_id
          ) || null
        );
      });
    } catch (err) {
      setError(err.message || "Unable to load shipments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const openShipmentDetails = async (shipment) => {
    // Display the selected shipment immediately in the panel.
    setSelectedShipment(shipment);
    setDetailsLoading(true);
    setDetailsError("");

    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(shipment.shipment_id)}`,
        { credentials: "include" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load tracking history."
        );
      }

      setSelectedShipment(data.shipment);
    } catch (err) {
      setDetailsError(
        err.message || "Unable to load shipment details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };


  const submitCancellationRequest = async () => {
  if (!selectedShipment) return;

  const reason = cancellationReason.trim();

  if (!reason) {
    setCancellationError("Please provide a cancellation reason.");
    return;
  }

  if (reason.length > 500) {
    setCancellationError(
      "Cancellation reason cannot exceed 500 characters."
    );
    return;
  }

  setCancellationSubmitting(true);
  setCancellationError("");
  setCancellationMessage("");

  try {
    const shipmentId = selectedShipment.shipment_id;

    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(shipmentId)}/cancellation-request`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success !== true) {
      throw new Error(
        data.detail ||
          data.message ||
          "Unable to submit cancellation request."
      );
    }

    setCancellationRequests((previous) => ({
      ...previous,
      [shipmentId]: {
        ...(data.request || {}),
        status: "pending",
        admin_note: null,
      },
    }));

    setCancellationReason("");
    setCancellationMessage(
      "Your cancellation request has been submitted for admin review."
    );

    await loadShipments();
    await openShipmentDetails(selectedShipment);
  } catch (err) {
    setCancellationError(
      err.message || "Unable to submit cancellation request."
    );
  } finally {
    setCancellationSubmitting(false);
  }
};

  const counts = {
    total: shipments.length,
    booked: shipments.filter((s) => s.status === "booked").length,
    inTransit: shipments.filter((s) => s.status === "in_transit").length,
    delivered: shipments.filter((s) => s.status === "delivered").length,
    cancelled: shipments.filter((s) => s.status === "cancelled").length,
  };

  const history = selectedShipment?.history || [];
  const currentStatus = selectedShipment?.status || "booked";

  const currentStepIndex = STATUS_STEPS.findIndex(
    (step) => step.key === currentStatus
  );

  const latestHistory = history.length
    ? history[history.length - 1]
    : null;

  return (
    <div className="my-shipments-page">
      {/* Page Header */}
      <div className="my-shipments-header">
        <div>
          <p className="shipments-eyebrow">SHIPMENT MANAGEMENT</p>
          <h1>My Shipments</h1>
          <p className="shipments-subtitle">
            Track your approved quotations and shipment progress.
          </p>
        </div>

        <button
          type="button"
          className="shipments-refresh-btn"
          onClick={loadShipments}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="shipments-error">
          <strong>Unable to load shipments</strong>
          <p>{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="shipments-kpi-grid">
        {[
          { label: "Total Shipments", value: counts.total },
          { label: "Booked", value: counts.booked },
          { label: "In Transit", value: counts.inTransit },
          { label: "Delivered", value: counts.delivered },
          { label: "Cancelled", value: counts.cancelled },
        ].map((item) => (
          <div className="shipments-kpi-card" key={item.label}>
            <p>{item.label}</p>
            <strong>{loading ? "…" : item.value}</strong>
          </div>
        ))}
      </div>

      {/* TRACKING PANEL: KPI cards కింద, table పైన */}
      {selectedShipment && (
        <section className="shipment-tracking-panel">
          <div className="tracking-panel-header">
            <div>
              <p className="shipments-eyebrow">SHIPMENT TRACKING</p>
              <h2>{selectedShipment.shipment_id}</h2>
              <p className="tracking-route">
                {selectedShipment.origin} → {selectedShipment.destination}
              </p>
            </div>

            <div className="tracking-header-actions">
              <span style={getStatusStyle(currentStatus)}>
                {STATUS_LABELS[currentStatus] || currentStatus}
              </span>

              <button
                type="button"
                className="tracking-close-btn"
                onClick={() => {
                  setSelectedShipment(null);
                  setDetailsError("");
                }}
                aria-label="Close tracking details"
                title="Close tracking details"
              >
                ✕
              </button>
            </div>
            
<div className="shipment-payment-summary">
  <div>
    <span>Payment Status</span>
    <strong
      style={getPaymentStatusStyle(
        getPaymentStatus(selectedShipment)
      )}
    >
      {getPaymentStatusLabel(
        getPaymentStatus(selectedShipment)
      )}
    </strong>
  </div>

  {selectedShipment.quotation_id != null && (
    <div>
      <span>Quotation ID</span>
      <strong>#{selectedShipment.quotation_id}</strong>
    </div>
  )}

  {selectedShipment.total_amount != null && (
    <div>
      <span>Quotation Amount</span>
      <strong>
        {selectedShipment.currency || "USD"}{" "}
        {Number(selectedShipment.total_amount).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </strong>
    </div>
  )}

  {selectedShipment.paid_amount != null && (
    <div>
      <span>Verified Amount</span>
      <strong>
        {selectedShipment.currency || "USD"}{" "}
        {Number(selectedShipment.paid_amount).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </strong>
    </div>
  )}
</div>
          </div>

          



          {detailsLoading ? (
            <div className="tracking-loading">
              Loading tracking history...
            </div>
          ) : detailsError ? (
            <div className="shipments-error">
              {detailsError}
            </div>
          ) : (
            <>
              {currentStatus === "cancelled" ? (
                <div className="shipment-cancelled-box">
                  <strong>✕ Shipment Cancelled</strong>
                  <p>
                    Reason:{" "}
                    {selectedShipment.cancellation_reason ||
                      "No reason provided"}
                  </p>
                  <small>
                    Cancelled at:{" "}
                    {formatDate(selectedShipment.cancelled_at)}
                  </small>
                </div>
              ) : (
                <>
                  <h3 className="tracking-section-title">
                    Delivery Progress
                  </h3>
                  <p className="tracking-section-subtitle">
                    Follow each milestone until your shipment is delivered.
                  </p>

                  <div className="shipment-timeline-scroll">
                    <div className="shipment-timeline">
                      {STATUS_STEPS.map((step, index) => {
                        const completed =
                          currentStepIndex >= 0 &&
                          index <= currentStepIndex;

                        const isCurrent = index === currentStepIndex;

                        const stepHistory = history
                          .filter(
                            (item) => item.new_status === step.key
                          )
                          .slice(-1)[0];

                        const timestamp =
                          stepHistory?.created_at ||
                          (step.key === "booked"
                            ? selectedShipment.booked_at
                            : null);

                        return (
                          <React.Fragment key={step.key}>
                            <div
                              className={[
                                "shipment-timeline-step",
                                completed ? "completed" : "",
                                isCurrent ? "current" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="shipment-timeline-dot">
                                {completed ? "✓" : ""}
                              </div>

                              <strong>{step.label}</strong>

                              <span className="shipment-timeline-date">
                                {timestamp
                                  ? formatDate(timestamp)
                                  : "Pending"}
                              </span>
                            </div>

                            {index < STATUS_STEPS.length - 1 && (
                              <div
                                className={[
                                  "shipment-timeline-line",
                                  currentStepIndex > index
                                    ? "completed"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="shipment-latest-update">
                <div className="shipment-latest-icon">✓</div>
                <div>
                  <strong> 
                    Latest Update:{" "}
                    {STATUS_LABELS[currentStatus] || currentStatus}
                  </strong>
                  <p>
                    {latestHistory?.note ||
                      "No additional status update recorded."}
                  </p>
                  {latestHistory?.created_at && (
                    <small>
                      {formatDate(latestHistory.created_at)}
                    </small>
                  )}
                </div>
              </div>

              {/* Status History */}
              <div className="shipment-history">
                <h3>Status History</h3>

                {history.length === 0 ? (
                  <p className="shipments-muted">
                    No status history available.
                  </p>
                ) : (
                  [...history].reverse().map((item, index) => (
                    <div
                      className="shipment-history-row"
                      key={`${item.id || item.new_status}-${item.created_at}-${index}`}
                    >
                      <span className="shipment-history-dot" />

                      <div>
                        <strong>
                          {STATUS_LABELS[item.new_status] ||
                            item.new_status}
                        </strong>
                        <p>{item.note || "Status updated"}</p>
                        <small>{formatDate(item.created_at)}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>

              

              {(() => {
  const request =
    cancellationRequests[selectedShipment.shipment_id];

  const canRequestCancellation = ![
    "cancelled",
    "delivered",
  ].includes(currentStatus);

  if (!canRequestCancellation) return null;

  return (
    <section
      style={{
        margin: "20px 0",
        padding: "18px",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "12px",
        background: "#FFF6E8",
      }}
    >
      <h3 style={{ color: COLORS.brown, marginTop: 0 }}>
        Shipment Cancellation Policy
      </h3>

      <p style={{ color: COLORS.darkBrown, lineHeight: 1.7 }}>
        If you wish to cancel this shipment, please review the
        cancellation policy before submitting your request.
        Additional cancellation charges may apply even if the main
        shipment payment has not been completed. Applicable fees
        must be paid according to the cancellation policy.
      </p>

      <p style={{ color: COLORS.muted, fontSize: "13px" }}>
        Your shipment will not be cancelled automatically.
        Admin approval is required.
      </p>

      {request?.status === "pending" ? (
        <div style={{ color: "#79551C", fontWeight: 700 }}>
          Cancellation Request: Pending Admin Review
        </div>
      ) : request?.status === "approved" ? (
        <div style={{ color: "#246943", fontWeight: 700 }}>
          Cancellation Request Approved
        </div>
      ) : request?.status === "rejected" ? (
        <div style={{ color: "#963C2F" }}>
          <strong>Cancellation Request Rejected</strong>
          {request.admin_note && <p>{request.admin_note}</p>}
        </div>
      ) : (
        <>
          <label
            htmlFor="cancellation-reason"
            style={{
              display: "block",
              margin: "14px 0 8px",
              color: COLORS.brown,
              fontWeight: 700,
            }}
          >
            Reason for cancellation
          </label>

          <textarea
            id="cancellation-reason"
            value={cancellationReason}
            onChange={(event) =>
              setCancellationReason(event.target.value)
            }
            maxLength={500}
            rows={3}
            placeholder="Please explain why you want to cancel..."
            style={{
              boxSizing: "border-box",
              width: "100%",
              padding: "12px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "8px",
              resize: "vertical",
              font: "inherit",
            }}
          />

          <small style={{ color: COLORS.muted }}>
            {cancellationReason.length}/500 characters
          </small>

          {cancellationError && (
            <p role="alert" style={{ color: "#963C2F" }}>
              {cancellationError}
            </p>
          )}

          {cancellationMessage && (
            <p role="status" style={{ color: "#246943" }}>
              {cancellationMessage}
            </p>
          )}

          <button
            type="button"
            onClick={submitCancellationRequest}
            disabled={cancellationSubmitting || detailsLoading}
            style={{
              display: "block",
              marginTop: "12px",
              padding: "11px 18px",
              border: "none",
              borderRadius: "8px",
              background: COLORS.brown,
              color: COLORS.white,
              fontWeight: 700,
              cursor: cancellationSubmitting ? "wait" : "pointer",
            }}
          >
            {cancellationSubmitting
              ? "Submitting..."
              : "Request Cancellation"}
          </button>
        </>
      )}
    </section>
  );
})()}
            </>
          )}
        </section>
      )}

      {/* Shipment Table */}
      <section className="shipment-records-panel">
        <div className="shipment-records-header">
          <div>
            <h2>Shipment Records</h2>
            <p>Select a shipment to view its tracking details.</p>
          </div>
        </div>

        {loading ? (
          <p className="shipments-message">Loading your shipments...</p>
        ) : !error && shipments.length === 0 ? (
          <p className="shipments-message">
            No shipments found. A shipment is created after a quotation
            is approved.
          </p>
        ) : (
          <div className="shipments-table-scroll">
            <table className="shipments-table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Route ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Cargo Type</th>
                  <th>Container Qty.</th>
                  <th>Payment Status</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {shipments.map((shipment) => (
                  <tr
                    key={shipment.shipment_id}
                    className={
                      selectedShipment?.shipment_id ===
                      shipment.shipment_id
                        ? "selected-shipment-row"
                        : ""
                    }
                  >
                    <td>
                      <strong>{shipment.shipment_id}</strong>
                    </td>
                    <td>{shipment.route_id}</td>
                    <td>{shipment.origin}</td>
                    <td>{shipment.destination}</td>
                    <td>{shipment.cargo_type}</td>
                    <td>{shipment.container_count}</td>
                    
<td>
  <span
    style={getPaymentStatusStyle(
      getPaymentStatus(shipment)
    )}
  >
    {getPaymentStatusLabel(
      getPaymentStatus(shipment)
    )}
  </span>
</td>
                    <td>
                      <span style={getStatusStyle(shipment.status)}>
                        {STATUS_LABELS[shipment.status] ||
                          shipment.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="track-shipment-btn"
                        onClick={() => openShipmentDetails(shipment)}
                        disabled={
                          detailsLoading &&
                          selectedShipment?.shipment_id ===
                            shipment.shipment_id
                        }
                      >
                        {detailsLoading &&
                        selectedShipment?.shipment_id ===
                          shipment.shipment_id
                          ? "Loading..."
                          : selectedShipment?.shipment_id ===
                              shipment.shipment_id
                            ? "Tracking Selected"
                            : "Track Shipment"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default MyShipments;