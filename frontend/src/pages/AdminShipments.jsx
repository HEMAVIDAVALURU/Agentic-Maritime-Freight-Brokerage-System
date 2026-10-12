
import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminShipments.css";

const API = "http://localhost:8000/api/shipments";

const STATUSES = [
  "booked",
  "pickup",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const TRACKING_STEPS = [
  { status: "booked", label: "Booked", description: "Shipment confirmed" },
  { status: "pickup", label: "Pickup", description: "Cargo picked up" },
  { status: "in_transit", label: "In Transit", description: "Shipment is on the way" },
  { status: "out_for_delivery", label: "Out for Delivery", description: "Final delivery stage" },
  { status: "delivered", label: "Delivered", description: "Shipment delivered successfully" },
];

const LABELS = {
  booked: "Booked",
  pickup: "Pickup",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS = {
  paid: "Paid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  unpaid: "Unpaid",
  unknown: "Not Available",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function getPaymentStatus(shipment) {
  const status =
    shipment?.payment_status ??
    shipment?.payment?.payment_status ??
    shipment?.payment?.status;

  return String(status || "unknown").toLowerCase();
}

function PaymentStatusBadge({ shipment }) {
  const status = getPaymentStatus(shipment);
  const label = PAYMENT_LABELS[status] || "Not Available";

  return (
    <span className={`as-payment-status as-payment-${status}`}>
      {label}
    </span>
  );
}

function ShipmentTracking({ shipment, history = [] }) {
  const currentStatus = String(shipment?.status || "booked").toLowerCase();

  const currentIndex = TRACKING_STEPS.findIndex(
    (step) => step.status === currentStatus
  );

  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime()
  );

  const latestForStatus = (status) =>
    [...sortedHistory]
      .reverse()
      .find(
        (item) =>
          String(item.new_status || "").toLowerCase() === status
      );

  if (currentStatus === "cancelled") {
    const cancelEvent = latestForStatus("cancelled");

    return (
      <section className="as-tracking">
        <div className="as-tracking-heading">
          <div>
            <p className="as-eyebrow">DELIVERY PROGRESS</p>
            <h3>Shipment Tracking</h3>
          </div>
          <span className="as-status as-status-cancelled">
            Cancelled
          </span>
        </div>

        <div className="as-cancelled-tracking">
          <span className="as-cancelled-icon">!</span>
          <div>
            <h4>Shipment Cancelled</h4>
            <p>
              {shipment.cancellation_reason ||
                cancelEvent?.note ||
                "This shipment has been cancelled."}
            </p>
            {cancelEvent?.created_at && (
              <small>{formatDate(cancelEvent.created_at)}</small>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="as-tracking">
      <div className="as-tracking-heading">
        <div>
          <p className="as-eyebrow">DELIVERY PROGRESS</p>
          <h3>Shipment Tracking</h3>
          <p className="as-tracking-subtitle">
            Track each milestone for this shipment.
          </p>
        </div>

        <span className={`as-status as-status-${currentStatus}`}>
          {LABELS[currentStatus] || currentStatus}
        </span>
      </div>

      <div className="as-tracking-steps">
        {TRACKING_STEPS.map((step, index) => {
          const completed = currentIndex >= 0 && index < currentIndex;
          const current = index === currentIndex;
          const event = latestForStatus(step.status);

          return (
            <div
              className={`as-tracking-step ${
                completed ? "is-completed" : ""
              } ${current ? "is-current" : ""}`}
              key={step.status}
            >
              <div className="as-tracking-marker-column">
                <span className="as-tracking-marker">
                  {completed ? "✓" : index + 1}
                </span>

                {index < TRACKING_STEPS.length - 1 && (
                  <span className="as-tracking-line" />
                )}
              </div>

              <div className="as-tracking-step-content">
                <div className="as-tracking-step-title">
                  <strong>{step.label}</strong>

                  {current && (
                    <span className="as-current-label">
                      CURRENT STATUS
                    </span>
                  )}

                  {completed && (
                    <span className="as-completed-label">
                      COMPLETED
                    </span>
                  )}
                </div>

                <p>{step.description}</p>

                {event?.created_at && (
                  <small>{formatDate(event.created_at)}</small>
                )}

                {event?.note && (
                  <small className="as-tracking-note">
                    {event.note}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminShipments() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/admin/all`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || "Unable to load shipments."
        );
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.shipments)
          ? data.shipments
          : Array.isArray(data.data)
            ? data.data
            : [];

      setShipments(list);

      setSelected((previous) => {
        if (!previous) return null;

        return (
          list.find(
            (item) => item.shipment_id === previous.shipment_id
          ) || previous
        );
      });
    } catch (err) {
      setError(err.message || "Unable to load shipments.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShipmentDetails = useCallback(async (shipmentId) => {
    const response = await fetch(
      `${API}/${encodeURIComponent(shipmentId)}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail || data.message || "Unable to load shipment history."
      );
    }

    const detail = data.shipment || data;

    setSelected(detail);
    return detail;
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const counts = useMemo(
    () => ({
      total: shipments.length,
      booked: shipments.filter((s) => s.status === "booked").length,
      transit: shipments.filter((s) =>
        ["pickup", "in_transit", "out_for_delivery"].includes(s.status)
      ).length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
      cancelled: shipments.filter((s) => s.status === "cancelled").length,
    }),
    [shipments]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return shipments.filter((shipment) => {
      const matchesStatus =
        filter === "all" || shipment.status === filter;

      const searchable = [
        shipment.shipment_id,
        shipment.route_id,
        shipment.quotation_id,
        shipment.origin,
        shipment.destination,
        shipment.cargo_type,
        shipment.status,
        PAYMENT_LABELS[getPaymentStatus(shipment)],
        getPaymentStatus(shipment),
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchable.includes(term);
    });
  }, [shipments, search, filter]);

  const openDetails = async (shipment) => {
    setSelected(shipment);
    setNewStatus("");
    setNote("");
    setMessage("");
    setDetailsLoading(true);

    try {
      await loadShipmentDetails(shipment.shipment_id);
    } catch (err) {
      setMessage(err.message || "Unable to load shipment details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateStatus = async (event) => {
    event.preventDefault();

    if (!selected || !newStatus) {
      setMessage("Please select a new status.");
      return;
    }

    if (newStatus === "cancelled" && !note.trim()) {
      setMessage("Please enter a cancellation reason.");
      return;
    }

    if (newStatus === selected.status) {
      setMessage("Choose a status different from the current status.");
      return;
    }

    if (
      !window.confirm(
        `Update ${selected.shipment_id} to "${LABELS[newStatus]}"?`
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API}/admin/${encodeURIComponent(selected.shipment_id)}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
            note: note.trim() || null,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(
          data.detail || data.message || "Status update failed."
        );
      }

      setMessage("Shipment status updated successfully.");
      setNewStatus("");
      setNote("");

      await loadShipments();
      await loadShipmentDetails(selected.shipment_id);
    } catch (err) {
      setMessage(err.message || "Status update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shipments-page">
      <header className="as-header">
        <div>
          <p className="as-eyebrow">LOGISTICS OPERATIONS</p>
          <h1>Shipment Management</h1>
          <p>Monitor approved shipments and update delivery milestones.</p>
        </div>

        <button
          className="as-refresh"
          type="button"
          onClick={loadShipments}
          disabled={loading}
        >
          ↻ {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && <div className="as-error">{error}</div>}

      <div className="as-kpis">
        {[
          ["Total Shipments", counts.total],
          ["Booked", counts.booked],
          ["In Progress", counts.transit],
          ["Delivered", counts.delivered],
          ["Cancelled", counts.cancelled],
        ].map(([label, value]) => (
          <div className="as-kpi" key={label}>
            <span>{label}</span>
            <strong>{loading ? "…" : value}</strong>
          </div>
        ))}
      </div>

      {selected && (
        <section className="as-panel as-detail-panel">
          <div className="as-detail-header">
            <div>
              <p className="as-eyebrow">SELECTED SHIPMENT</p>
              <h2>{selected.shipment_id}</h2>
              <p>
                {selected.origin || "Origin unavailable"} →{" "}
                {selected.destination || "Destination unavailable"}
              </p>
            </div>

            <button
              type="button"
              className="as-close"
              onClick={() => {
                setSelected(null);
                setMessage("");
              }}
            >
              Close ✕
            </button>
          </div>

          <div className="as-payment-summary">
            <div>
              <p className="as-eyebrow">PAYMENT INFORMATION</p>
              <strong>Payment Status</strong>
            </div>
            <PaymentStatusBadge shipment={selected} />
          </div>

          {selected.quotation_id && (
            <p className="as-quotation-info">
              Quotation ID: <strong>{selected.quotation_id}</strong>
            </p>
          )}

          {detailsLoading ? (
            <p className="as-empty">Loading shipment tracking...</p>
          ) : (
            <ShipmentTracking
              shipment={selected}
              history={selected.history || []}
            />
          )}

          {selected.status === "cancelled" ||
          selected.status === "delivered" ? (
            <div className="as-terminal-notice">
              This shipment is{" "}
              {LABELS[selected.status]?.toLowerCase()}. Its status cannot be
              changed further.
            </div>
          ) : (
            <form className="as-update-form" onSubmit={updateStatus}>
              <h3>Update Tracking Status</h3>
              <p className="as-update-help">
                Choose the new milestone. The tracking timeline and history
                refresh after saving.
              </p>

              <div className="as-form-grid">
                <label>
                  New Status
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    required
                  >
                    <option value="">Select next status</option>
                    {STATUSES.filter(
                      (status) => status !== selected.status
                    ).map((status) => (
                      <option key={status} value={status}>
                        {LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Update Note / Cancellation Reason
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional update note; required for cancellation..."
                    rows={3}
                    required={newStatus === "cancelled"}
                  />
                </label>
              </div>

              <button
                className="as-save"
                type="submit"
                disabled={saving || detailsLoading}
              >
                {saving ? "Saving status..." : "Save Status Update"}
              </button>
            </form>
          )}

          {message && (
            <div
              role="status"
              className={
                message.includes("successfully")
                  ? "as-success"
                  : "as-error"
              }
            >
              {message}
            </div>
          )}

          <div className="as-history">
            <h3>Status History</h3>

            {detailsLoading ? (
              <p>Loading history...</p>
            ) : !selected.history?.length ? (
              <p>No status history available.</p>
            ) : (
              [...selected.history].reverse().map((item, index) => (
                <div
                  className="as-history-row"
                  key={`${item.id || item.new_status}-${item.created_at}-${index}`}
                >
                  <span className="as-history-dot" />
                  <div>
                    <strong>
                      {LABELS[item.new_status] || item.new_status}
                    </strong>
                    <p>{item.note || "Status updated"}</p>
                    <small>{formatDate(item.created_at)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <section className="as-panel">
        <div className="as-table-heading">
          <div>
            <h2>Shipment Records</h2>
            <p>
              Select a shipment to review tracking or update its status.
            </p>
          </div>
          <span>{filtered.length} records</span>
        </div>

        <div className="as-filters">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shipment, route, payment status..."
            aria-label="Search shipments"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by shipment status"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="as-empty">Loading shipments...</p>
        ) : filtered.length === 0 ? (
          <p className="as-empty">No matching shipments found.</p>
        ) : (
          <div className="as-table-wrap">
            <table className="as-table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Quotation ID</th>
                  <th>Route ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Cargo</th>
                  <th>Quantity</th>
                  <th>Shipment Status</th>
                  <th>Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((shipment) => (
                  <tr
                    key={shipment.shipment_id}
                    className={
                      selected?.shipment_id === shipment.shipment_id
                        ? "as-selected-row"
                        : ""
                    }
                  >
                    <td>
                      <strong>{shipment.shipment_id}</strong>
                    </td>
                    <td>{shipment.quotation_id ?? "—"}</td>
                    <td>{shipment.route_id || "—"}</td>
                    <td>{shipment.origin || "—"}</td>
                    <td>{shipment.destination || "—"}</td>
                    <td>{shipment.cargo_type || "—"}</td>
                    <td>{shipment.container_count ?? "—"}</td>
                    <td>
                      <span
                        className={`as-status as-status-${shipment.status}`}
                      >
                        {LABELS[shipment.status] || shipment.status}
                      </span>
                    </td>
                    <td>
                      <PaymentStatusBadge shipment={shipment} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="as-view"
                        onClick={() => openDetails(shipment)}
                      >
                        Track / Manage →
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

export default AdminShipments;

