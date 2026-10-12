import { useCallback, useEffect, useState } from "react";
import "./AdminPayment.css";

const API_BASE = "http://localhost:8000/api/payments";

function getArray(data) {
if (Array.isArray(data)) return data;

for (const key of ["payments", "items", "results", "data"]) {
if (Array.isArray(data?.[key])) return data[key];
}

return [];
}

function money(value, currency = "USD") {
const amount = Number(value ?? 0);

try {
return new Intl.NumberFormat("en-US", {
style: "currency",
currency,
maximumFractionDigits: 2,
}).format(Number.isFinite(amount) ? amount : 0);
} catch {
return `${currency} ${amount.toFixed(2)}`;
}
}

function formatStatus(status) {
const normalized = String(status || "pending_verification").toLowerCase();

const labels = {
pending_verification: "Pending Verification",
verified: "Verified",
paid: "Paid",
rejected: "Rejected",
failed: "Failed",
};

return labels[normalized] || normalized.replaceAll("_", " ");
}

function statusClass(status) {
const normalized = String(status || "").toLowerCase();

if (["verified", "paid"].includes(normalized)) return "success";
if (normalized === "pending_verification") return "pending";
if (["rejected", "failed"].includes(normalized)) return "danger";

return "neutral";
}

function displayDate(value) {
if (!value) return "—";

const date = new Date(value);
return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function getErrorMessage(data, fallback) {
if (typeof data?.detail === "string") return data.detail;
if (typeof data?.message === "string") return data.message;

if (Array.isArray(data?.detail)) {
return data.detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
}

return fallback;
}

export default function AdminPayment() {
const [payments, setPayments] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [notice, setNotice] = useState("");
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [selectedPayment, setSelectedPayment] = useState(null);
const [decision, setDecision] = useState("verify");
const [adminNote, setAdminNote] = useState("");
const [submitting, setSubmitting] = useState(false);

const loadPayments = useCallback(async () => {
setLoading(true);
setError("");


try {
  const response = await fetch(`${API_BASE}/admin/all`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "Unable to load payment requests.")
    );
  }

  setPayments(getArray(data));
} catch (err) {
  setError(
    err.message ||
      "Could not load payment requests. Check the server and admin login."
  );
} finally {
  setLoading(false);
}


}, []);

useEffect(() => {
loadPayments();
}, [loadPayments]);

const openDecision = (payment, action) => {
setSelectedPayment(payment);
setDecision(action);
setAdminNote("");
setError("");
setNotice("");
};

const closeDecision = () => {
if (submitting) return;
setSelectedPayment(null);
};

const submitDecision = async (event) => {
event.preventDefault();


if (!selectedPayment) return;

if (decision === "reject" && !adminNote.trim()) {
  setError("Please provide a reason before rejecting a payment.");
  return;
}

const paymentId = selectedPayment.id ?? selectedPayment.payment_id;

if (paymentId == null) {
  setError("Payment ID is missing. Refresh the list and try again.");
  return;
}

setSubmitting(true);
setError("");
setNotice("");

try {
  const response = await fetch(
    `${API_BASE}/admin/${paymentId}/decision`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: decision,
        note: adminNote.trim() || null,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "Unable to update payment status.")
    );
  }

  setSelectedPayment(null);
  setNotice(
    decision === "verify"
      ? `Payment request #${paymentId} was verified successfully.`
      : `Payment request #${paymentId} was rejected.`
  );

  await loadPayments();
} catch (err) {
  setError(err.message || "Could not update the payment request.");
} finally {
  setSubmitting(false);
}


};

const filteredPayments = payments.filter((payment) => {
const status = String(payment.status || "pending_verification").toLowerCase();


const matchesStatus =
  statusFilter === "all" || status === statusFilter;

const searchableText = [
  payment.id,
  payment.payment_id,
  payment.quotation_id,
  payment.user_id,
  payment.customer_name,
  payment.user_name,
  payment.email,
  payment.customer_email,
  payment.origin,
  payment.destination,
  payment.payment_reference,
  payment.payment_method,
]
  .filter((value) => value != null)
  .join(" ")
  .toLowerCase();

return matchesStatus && searchableText.includes(search.toLowerCase());


});

const pendingCount = payments.filter(
(payment) => payment.status === "pending_verification"
).length;

const verifiedCount = payments.filter((payment) =>
["verified", "paid"].includes(String(payment.status).toLowerCase())
).length;

const rejectedCount = payments.filter(
(payment) => payment.status === "rejected"
).length;

const pendingAmount = payments
.filter((payment) => payment.status === "pending_verification")
.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

return ( <div className="admin-payment-page"> <div className="admin-payment-header"> <div> <p className="admin-payment-eyebrow">FINANCE MANAGEMENT</p> <h1>Payment Verification</h1> <p className="admin-payment-subtitle">
Review customer payment requests and record verification decisions. </p> </div>


    <button
      type="button"
      className="admin-payment-refresh"
      onClick={loadPayments}
      disabled={loading || submitting}
    >
      ↻ Refresh
    </button>
  </div>

  {error && (
    <div className="admin-payment-alert admin-payment-alert-error" role="alert">
      <strong>Action needed</strong>
      <span>{error}</span>
    </div>
  )}

  {notice && (
    <div
      className="admin-payment-alert admin-payment-alert-success"
      role="status"
    >
      <strong>Updated</strong>
      <span>{notice}</span>
    </div>
  )}

  <div className="admin-payment-stats">
    <div className="admin-payment-stat-card">
      <span className="admin-payment-stat-icon">📋</span>
      <div>
        <p>Total Requests</p>
        <h2>{loading ? "—" : payments.length}</h2>
      </div>
    </div>

    <div className="admin-payment-stat-card">
      <span className="admin-payment-stat-icon">⏳</span>
      <div>
        <p>Awaiting Verification</p>
        <h2>{loading ? "—" : pendingCount}</h2>
      </div>
    </div>

    <div className="admin-payment-stat-card">
      <span className="admin-payment-stat-icon">✓</span>
      <div>
        <p>Verified Requests</p>
        <h2>{loading ? "—" : verifiedCount}</h2>
      </div>
    </div>

    <div className="admin-payment-stat-card">
      <span className="admin-payment-stat-icon">↩</span>
      <div>
        <p>Rejected Requests</p>
        <h2>{loading ? "—" : rejectedCount}</h2>
      </div>
    </div>
  </div>

  <section className="admin-payment-section">
    <div className="admin-payment-section-heading">
      <div>
        <h2>All Payment Requests</h2>
        <p>
          Pending amount: <strong>{money(pendingAmount)}</strong>
        </p>
      </div>
    </div>

    <div className="admin-payment-toolbar">
      <div className="admin-payment-search">
        <span>⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer, quotation, route or reference…"
          aria-label="Search payment requests"
        />
      </div>

      <select
        className="admin-payment-filter"
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        aria-label="Filter payment requests by status"
      >
        <option value="all">All statuses</option>
        <option value="pending_verification">Pending Verification</option>
        <option value="verified">Verified</option>
        <option value="paid">Paid</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    {loading ? (
      <div className="admin-payment-empty">Loading payment requests…</div>
    ) : filteredPayments.length === 0 ? (
      <div className="admin-payment-empty">
        <span className="admin-payment-empty-icon">💳</span>
        <h3>No payment requests found</h3>
        <p>Try changing your search or status filter.</p>
      </div>
    ) : (
      <div className="admin-payment-table-wrap">
        <table className="admin-payment-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Customer</th>
              <th>Quotation / Route</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment, index) => {
              const id = payment.id ?? payment.payment_id ?? index;
              const status = payment.status || "pending_verification";
              const isPending = status === "pending_verification";

              return (
                <tr key={id}>
                  <td className="admin-payment-id">#{id}</td>
                  <td>
                    <div className="admin-payment-customer">
                      <strong>
                        {payment.customer_name ||
                          payment.user_name ||
                          payment.name ||
                          (payment.user_id != null
                            ? `User #${payment.user_id}`
                            : "Customer")}
                      </strong>
                      <span>
                        {payment.customer_email || payment.email || "—"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-payment-route-cell">
                      <strong>
                        #
                        {payment.quotation_id ??
                          payment.quotation?.id ??
                          "—"}
                      </strong>
                      <span>
                        {payment.origin || "Origin —"} →{" "}
                        {payment.destination || "Destination —"}
                      </span>
                    </div>
                  </td>
                  <td className="admin-payment-amount">
                    {money(payment.amount, payment.currency || "USD")}
                  </td>
                  <td>
                    {String(payment.payment_method || "—").replaceAll(
                      "_",
                      " "
                    )}
                  </td>
                  <td className="admin-payment-reference">
                    {payment.payment_reference || "—"}
                  </td>
                  <td>{displayDate(payment.submitted_at || payment.created_at)}</td>
                  <td>
                    <span
                      className={`admin-payment-status admin-payment-status-${statusClass(
                        status
                      )}`}
                    >
                      {formatStatus(status)}
                    </span>
                  </td>
                  <td>
                    {isPending ? (
                      <div className="admin-payment-row-actions">
                        <button
                          type="button"
                          className="admin-payment-verify-btn"
                          onClick={() => openDecision(payment, "verify")}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="admin-payment-reject-btn"
                          onClick={() => openDecision(payment, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="admin-payment-reviewed">Reviewed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>

  {selectedPayment && (
    <div
      className="admin-payment-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDecision();
      }}
    >
      <div
        className="admin-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-payment-modal-title"
      >
        <div className="admin-payment-modal-header">
          <div>
            <p className="admin-payment-eyebrow">PAYMENT REVIEW</p>
            <h2 id="admin-payment-modal-title">
              {decision === "verify"
                ? "Verify Payment Request"
                : "Reject Payment Request"}
            </h2>
            <p>
              Request #
              {selectedPayment.id ?? selectedPayment.payment_id}
            </p>
          </div>

          <button
            type="button"
            className="admin-payment-modal-close"
            onClick={closeDecision}
            disabled={submitting}
            aria-label="Close review dialog"
          >
            ×
          </button>
        </div>

        <div className="admin-payment-review-details">
          <div>
            <span>Amount</span>
            <strong>
              {money(
                selectedPayment.amount,
                selectedPayment.currency || "USD"
              )}
            </strong>
          </div>
          <div>
            <span>Method</span>
            <strong>
              {String(selectedPayment.payment_method || "—").replaceAll(
                "_",
                " "
              )}
            </strong>
          </div>
          <div>
            <span>Reference</span>
            <strong>{selectedPayment.payment_reference || "—"}</strong>
          </div>
          <div>
            <span>Quotation</span>
            <strong>
              #
              {selectedPayment.quotation_id ??
                selectedPayment.quotation?.id ??
                "—"}
            </strong>
          </div>
        </div>

        {selectedPayment.proof_description && (
          <div className="admin-payment-proof">
            <strong>Customer notes</strong>
            <p>{selectedPayment.proof_description}</p>
          </div>
        )}

        <form onSubmit={submitDecision} className="admin-payment-review-form">
          <label htmlFor="admin-payment-note">
            {decision === "verify"
              ? "Admin note (optional)"
              : "Reason for rejection (required)"}
          </label>
          <textarea
            id="admin-payment-note"
            rows={4}
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            placeholder={
              decision === "verify"
                ? "Add a verification note, if needed"
                : "Explain why this request is being rejected"
            }
            required={decision === "reject"}
          />

          <div className="admin-payment-review-warning">
            {decision === "verify"
              ? "Verify only after checking the payment evidence through your normal review process."
              : "The customer will see that this request was rejected. Include a clear reason."}
          </div>

          <div className="admin-payment-form-actions">
            <button
              type="button"
              className="admin-payment-cancel-btn"
              onClick={closeDecision}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={
                decision === "verify"
                  ? "admin-payment-confirm-verify"
                  : "admin-payment-confirm-reject"
              }
              disabled={submitting}
            >
              {submitting
                ? "Saving…"
                : decision === "verify"
                  ? "Confirm Verification"
                  : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>


);
}
