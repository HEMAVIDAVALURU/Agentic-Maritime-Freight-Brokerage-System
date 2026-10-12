import { useCallback, useEffect, useState } from "react";
import "./UserPayment.css";

const API_BASE = "http://localhost:8000/api/payments";

function getArray(response, possibleKeys = []) {
if (Array.isArray(response)) return response;

for (const key of possibleKeys) {
if (Array.isArray(response?.[key])) return response[key];
}

if (Array.isArray(response?.data)) return response.data;
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
const normalized = String(status ?? "unpaid").toLowerCase();

const labels = {
paid: "Paid",
verified: "Verified",
pending_verification: "Pending Verification",
partially_paid: "Partially Paid",
unpaid: "Unpaid",
rejected: "Rejected",
approved: "Approved",
failed: "Failed",
};

return labels[normalized] || normalized.replaceAll("_", " ");
}

function statusClass(status) {
const normalized = String(status ?? "unpaid").toLowerCase();

if (["paid", "verified"].includes(normalized)) return "success";
if (["pending_verification", "partially_paid"].includes(normalized)) {
return "pending";
}
if (["rejected", "failed"].includes(normalized)) return "danger";

return "neutral";
}

function displayDate(value) {
if (!value) return "—";

const date = new Date(value);
if (Number.isNaN(date.getTime())) return String(value);

return date.toLocaleString();
}

function getErrorMessage(data, fallback) {
if (typeof data?.detail === "string") return data.detail;
if (typeof data?.message === "string") return data.message;

if (Array.isArray(data?.detail)) {
return data.detail.map((item) => item.msg || JSON.stringify(item)).join(", ");
}

return fallback;
}

export default function UserPayment() {
const [quotations, setQuotations] = useState([]);
const [payments, setPayments] = useState([]);
const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState("");
const [notice, setNotice] = useState("");
const [selectedQuotation, setSelectedQuotation] = useState(null);

const [form, setForm] = useState({
payment_method: "upi",
payment_reference: "",
proof_description: "",
});

const fetchPaymentData = useCallback(async () => {
setLoading(true);
setError("");


try {
  const [summaryResponse, historyResponse] = await Promise.all([
    fetch(`${API_BASE}/summary`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    }),
    fetch(`${API_BASE}/my`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    }),
  ]);

  const summaryData = await summaryResponse.json().catch(() => ({}));
  const historyData = await historyResponse.json().catch(() => ({}));

  if (!summaryResponse.ok) {
    throw new Error(
      getErrorMessage(summaryData, "Could not load quotation payment summary.")
    );
  }

  if (!historyResponse.ok) {
    throw new Error(
      getErrorMessage(historyData, "Could not load payment history.")
    );
  }

  setQuotations(
    getArray(summaryData, ["quotations", "items", "summary", "results"])
  );
  setPayments(
    getArray(historyData, ["payments", "items", "results", "history"])
  );
} catch (err) {
  setError(
    err.message ||
      "Unable to load payments. Check your login and backend server."
  );
} finally {
  setLoading(false);
}


}, []);

useEffect(() => {
fetchPaymentData();
}, [fetchPaymentData]);

const openPaymentForm = (quotation) => {
setSelectedQuotation(quotation);
setForm({
payment_method: "upi",
payment_reference: "",
proof_description: "",
});
setNotice("");
setError("");
};

const closePaymentForm = () => {
if (submitting) return;
setSelectedQuotation(null);
};

const handleFormChange = (event) => {
const { name, value } = event.target;
setForm((previous) => ({ ...previous, [name]: value }));
};

const handleSubmit = async (event) => {
event.preventDefault();


if (!selectedQuotation) return;

const quotationId =
  selectedQuotation.quotation_id ?? selectedQuotation.id;

if (quotationId == null) {
  setError("Quotation ID is missing. Please refresh and try again.");
  return;
}

setSubmitting(true);
setError("");
setNotice("");

try {
  const response = await fetch(`${API_BASE}/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quotation_id: Number(quotationId),
      payment_method: form.payment_method,
      payment_reference: form.payment_reference.trim() || null,
      proof_description: form.proof_description.trim() || null,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "Payment request could not be submitted.")
    );
  }

  setSelectedQuotation(null);
  setNotice(
    "Payment request submitted. It will remain pending until an admin verifies it. No money was transferred by this demo."
  );

  await fetchPaymentData();
} catch (err) {
  setError(err.message || "Could not submit the payment request.");
} finally {
  setSubmitting(false);
}


};

const totalOutstanding = quotations.reduce((sum, item) => {
const remaining = Number(
item.remaining_amount ??
item.amount_remaining ??
item.balance_amount ??
0
);
return sum + (Number.isFinite(remaining) ? Math.max(0, remaining) : 0);
}, 0);

const totalPending = quotations.reduce((sum, item) => {
const pending = Number(
item.pending_amount ?? item.pending_verification_amount ?? 0
);
return sum + (Number.isFinite(pending) ? Math.max(0, pending) : 0);
}, 0);

const selectedCurrency = selectedQuotation?.currency || "USD";

return ( <div className="user-payment-page"> <div className="user-payment-header"> <div> <p className="user-payment-eyebrow">ACCOUNT & BILLING</p> <h1>My Payments</h1> <p className="user-payment-subtitle">
Review quotation balances, submit payment requests, and track
verification. </p> </div>


    <button
      type="button"
      className="user-payment-refresh"
      onClick={fetchPaymentData}
      disabled={loading || submitting}
    >
      ↻ Refresh
    </button>
  </div>

  {error && (
    <div className="user-payment-alert user-payment-alert-error" role="alert">
      <strong>Something went wrong</strong>
      <span>{error}</span>
    </div>
  )}

  {notice && (
    <div className="user-payment-alert user-payment-alert-success" role="status">
      <strong>Request submitted</strong>
      <span>{notice}</span>
    </div>
  )}

  <div className="user-payment-summary-grid">
    <div className="user-payment-summary-card">
      <span className="user-payment-summary-icon">📄</span>
      <div>
        <p>Approved Quotations</p>
        <h2>{loading ? "—" : quotations.length}</h2>
      </div>
    </div>

    <div className="user-payment-summary-card">
      <span className="user-payment-summary-icon">⏳</span>
      <div>
        <p>Pending Verification</p>
        <h2>{loading ? "—" : money(totalPending)}</h2>
      </div>
    </div>

    <div className="user-payment-summary-card">
      <span className="user-payment-summary-icon">💰</span>
      <div>
        <p>Outstanding Balance</p>
        <h2>{loading ? "—" : money(totalOutstanding)}</h2>
      </div>
    </div>
  </div>

  <section className="user-payment-section">
    <div className="user-payment-section-heading">
      <div>
        <h2>Quotation Payment Summary</h2>
        <p>Payment requests are subject to admin verification.</p>
      </div>
    </div>

    {loading ? (
      <div className="user-payment-empty">Loading payment details…</div>
    ) : quotations.length === 0 ? (
      <div className="user-payment-empty">
        <span className="user-payment-empty-icon">📑</span>
        <h3>No approved quotations found</h3>
        <p>
          Once a quotation is approved, its payment details will appear
          here.
        </p>
      </div>
    ) : (
      <div className="user-payment-table-wrap">
        <table className="user-payment-table">
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Route</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((quotation, index) => {
              const id =
                quotation.quotation_id ??
                quotation.id ??
                `quotation-${index}`;

              const currency = quotation.currency || "USD";
              const total = Number(
                quotation.total_amount ??
                  quotation.selling_price ??
                  quotation.total_selling_price ??
                  quotation.amount ??
                  0
              );
              const paid = Number(
                quotation.paid_amount ?? quotation.verified_amount ?? 0
              );
              const pending = Number(
                quotation.pending_amount ??
                  quotation.pending_verification_amount ??
                  0
              );
              const remaining = Number(
                quotation.remaining_amount ??
                  quotation.amount_remaining ??
                  quotation.balance_amount ??
                  Math.max(0, total - paid - pending)
              );
              const status =
                quotation.payment_status ??
                quotation.status ??
                (remaining <= 0
                  ? "paid"
                  : pending > 0
                    ? "pending_verification"
                    : paid > 0
                      ? "partially_paid"
                      : "unpaid");

              return (
                <tr key={id}>
                  <td>
                    <span className="user-payment-quotation-id">
                      #{id}
                    </span>
                  </td>
                  <td>
                    <div className="user-payment-route">
                      <span>{quotation.origin || "Origin —"}</span>
                      <span className="user-payment-route-arrow">→</span>
                      <span>{quotation.destination || "Destination —"}</span>
                    </div>
                  </td>
                  <td>{money(total, currency)}</td>
                  <td>{money(paid, currency)}</td>
                  <td>{money(pending, currency)}</td>
                  <td className="user-payment-remaining">
                    {money(remaining, currency)}
                  </td>
                  <td>
                    <span
                      className={`user-payment-status user-payment-status-${statusClass(
                        status
                      )}`}
                    >
                      {formatStatus(status)}
                    </span>
                  </td>
                  <td>
                    {remaining > 0 ? (
                      <button
                        type="button"
                        className="user-payment-request-btn"
                        onClick={() => openPaymentForm(quotation)}
                      >
                        Request Payment
                      </button>
                    ) : (
                      <span className="user-payment-complete">Complete</span>
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

  <section className="user-payment-section">
    <div className="user-payment-section-heading">
      <div>
        <h2>Payment Request History</h2>
        <p>Track the status of requests you have submitted.</p>
      </div>
    </div>

    {loading ? (
      <div className="user-payment-empty">Loading payment history…</div>
    ) : payments.length === 0 ? (
      <div className="user-payment-empty">
        <h3>No payment requests yet</h3>
        <p>Your submitted requests will appear here.</p>
      </div>
    ) : (
      <div className="user-payment-table-wrap">
        <table className="user-payment-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Quotation</th>
              <th>Submitted</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Admin Note</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => {
              const id = payment.id ?? payment.payment_id ?? index;
              const status = payment.status || "pending_verification";

              return (
                <tr key={id}>
                  <td>#{id}</td>
                  <td>
                    #{payment.quotation_id ?? payment.quotation?.id ?? "—"}
                  </td>
                  <td>{displayDate(payment.submitted_at || payment.created_at)}</td>
                  <td>
                    {String(payment.payment_method || "—").replaceAll(
                      "_",
                      " "
                    )}
                  </td>
                  <td>{payment.payment_reference || "—"}</td>
                  <td>
                    {money(payment.amount, payment.currency || "USD")}
                  </td>
                  <td>
                    <span
                      className={`user-payment-status user-payment-status-${statusClass(
                        status
                      )}`}
                    >
                      {formatStatus(status)}
                    </span>
                  </td>
                  <td>{payment.admin_note || payment.note || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>

  {selectedQuotation && (
    <div
      className="user-payment-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePaymentForm();
      }}
    >
      <div
        className="user-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-payment-modal-title"
      >
        <div className="user-payment-modal-header">
          <div>
            <p className="user-payment-eyebrow">DEMO PAYMENT</p>
            <h2 id="user-payment-modal-title">Submit Payment Request</h2>
            <p>
              Quotation #
              {selectedQuotation.quotation_id ?? selectedQuotation.id}
            </p>
          </div>
          <button
            type="button"
            className="user-payment-modal-close"
            onClick={closePaymentForm}
            disabled={submitting}
            aria-label="Close payment form"
          >
            ×
          </button>
        </div>

        <div className="user-payment-modal-amount">
          <span>Remaining balance</span>
          <strong>
            {money(
              selectedQuotation.remaining_amount ??
                selectedQuotation.amount_remaining ??
                selectedQuotation.balance_amount ??
                Math.max(
                  0,
                  Number(
                    selectedQuotation.total_amount ??
                      selectedQuotation.selling_price ??
                      selectedQuotation.total_selling_price ??
                      selectedQuotation.amount ??
                      0
                  ) -
                    Number(
                      selectedQuotation.paid_amount ??
                        selectedQuotation.verified_amount ??
                        0
                    ) -
                    Number(
                      selectedQuotation.pending_amount ??
                        selectedQuotation.pending_verification_amount ??
                        0
                    )
                ),
              selectedCurrency
            )}
          </strong>
        </div>

        <form className="user-payment-form" onSubmit={handleSubmit}>
          <label htmlFor="payment_method">Payment method</label>
          <select
            id="payment_method"
            name="payment_method"
            value={form.payment_method}
            onChange={handleFormChange}
            required
          >
            <option value="upi">UPI</option>
            <option value="net_banking">Net Banking</option>
            <option value="card">Credit / Debit Card (Demo)</option>
            <option value="offline">Offline Payment</option>
          </select>

          <label htmlFor="payment_reference">
            Transaction / reference ID <span>(optional)</span>
          </label>
          <input
            id="payment_reference"
            name="payment_reference"
            type="text"
            value={form.payment_reference}
            onChange={handleFormChange}
            maxLength={255}
            placeholder="Enter a transaction reference, if available"
          />

          <label htmlFor="proof_description">
            Payment notes <span>(optional)</span>
          </label>
          <textarea
            id="proof_description"
            name="proof_description"
            value={form.proof_description}
            onChange={handleFormChange}
            rows={3}
            placeholder="Add payment details for the admin to review"
          />

          <div className="user-payment-demo-warning">
            This is a demo request only. Do not enter your PIN, OTP, full
            card number, CVV, or bank password. No money will be transferred.
          </div>

          <div className="user-payment-form-actions">
            <button
              type="button"
              className="user-payment-cancel-btn"
              onClick={closePaymentForm}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="user-payment-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Demo Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>

);
}
