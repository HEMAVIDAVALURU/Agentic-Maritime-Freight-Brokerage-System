import { useCallback, useEffect, useState } from "react";
import "./AdminFeedback.css";

const API_URL = "http://localhost:8000/api/feedback";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCustomerName(feedback) {
  return (
    feedback.customer?.name ||
    feedback.customer_name ||
    "Unknown Customer"
  );
}

function getCustomerEmail(feedback) {
  return feedback.customer?.email || feedback.customer_email || "";
}

function AdminFeedback() {
  const [feedbackList, setFeedbackList] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [highlightedFeedbackId, setHighlightedFeedbackId] = useState(null);

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/admin`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load customer feedback."
        );
      }

      const records = Array.isArray(data.feedback)
        ? data.feedback
        : [];

      setFeedbackList(records);

      // Preserve the text already entered for each feedback.
      setResponses((previous) => {
        const updated = { ...previous };

        records.forEach((item) => {
          if (!(item.id in updated)) {
            updated[item.id] = "";
          }
        });

        return updated;
      });
    } catch (err) {
      console.error("Admin feedback loading error:", err);
      setError(err.message || "Unable to load customer feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    if (!feedbackList.length) return;

    try {
      const storedTarget = sessionStorage.getItem(
        "admin_notification_target"
      );

      if (!storedTarget) return;

      const target = JSON.parse(storedTarget);

      if (target?.type !== "feedback") return;

      const feedback = feedbackList.find(
        (item) => String(item.id) === String(target.id)
      );

      if (feedback) {
        sessionStorage.removeItem(
          "admin_notification_target"
        );

        setHighlightedFeedbackId(String(feedback.id));

        window.setTimeout(() => {
          document
            .getElementById(`admin-feedback-${feedback.id}`)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }, 100);

        window.setTimeout(() => {
          setHighlightedFeedbackId(null);
        }, 4500);
      }
    } catch (error) {
      console.error(
        "Admin feedback notification target error:",
        error
      );
    }
  }, [feedbackList]);

  const handleResponseChange = (feedbackId, value) => {
    setResponses((previous) => ({
      ...previous,
      [feedbackId]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSendResponse = async (feedbackId) => {
    const responseText = (responses[feedbackId] || "").trim();

    if (!responseText) {
      setError("Please enter a response before sending.");
      setSuccess("");
      return;
    }

    try {
      setSendingId(feedbackId);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/${feedbackId}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            response: responseText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to send the response."
        );
      }

      setSuccess(
        `Response sent successfully for feedback #${feedbackId}.`
      );

      setResponses((previous) => ({
        ...previous,
        [feedbackId]: "",
      }));

      // Reload the saved response from the database.
      await fetchFeedback();
    } catch (err) {
      console.error("Admin feedback response error:", err);
      setError(err.message || "Unable to send the response.");
    } finally {
      setSendingId(null);
    }
  };

  const repliedFeedback = feedbackList.filter(
    (item) => (item.admin_response || "").trim()
  );

  const pendingFeedback = feedbackList.filter(
    (item) => !(item.admin_response || "").trim()
  );

  return (
    <section className="admin-feedback-page">
      {/* PAGE HEADER */}
      <header className="admin-feedback-header">
        <div>
          <span className="admin-feedback-eyebrow">
            CUSTOMER EXPERIENCE
          </span>

          <h1>Feedback Management</h1>

          <p>
            Review customer feedback and respond to their
            suggestions and concerns.
          </p>
        </div>

        <button
          type="button"
          className="admin-feedback-refresh"
          onClick={fetchFeedback}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </header>

      {/* SUMMARY CARDS */}
      <div className="admin-feedback-stats">
        <article className="admin-feedback-stat-card">
          <span className="admin-feedback-stat-icon">▤</span>
          <div>
            <p>Total Feedback</p>
            <h2>{feedbackList.length}</h2>
          </div>
        </article>

        <article className="admin-feedback-stat-card">
          <span className="admin-feedback-stat-icon">✉</span>
          <div>
            <p>Awaiting Response</p>
            <h2>{pendingFeedback.length}</h2>
          </div>
        </article>

        <article className="admin-feedback-stat-card">
          <span className="admin-feedback-stat-icon">✓</span>
          <div>
            <p>Responses Sent</p>
            <h2>{repliedFeedback.length}</h2>
          </div>
        </article>
      </div>

      {/* STATUS MESSAGES */}
      {error && (
        <div className="admin-feedback-alert error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div
          className="admin-feedback-alert success"
          role="status"
        >
          {success}
        </div>
      )}

      {/* ALL CUSTOMER FEEDBACK */}
      <div className="admin-feedback-section-heading">
        <div>
          <h2>Customer Feedback</h2>
          <p>Review ratings and reply to each customer.</p>
        </div>

        <span className="admin-feedback-count">
          {feedbackList.length} feedback
          {feedbackList.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <div className="admin-feedback-empty">
          Loading customer feedback...
        </div>
      ) : feedbackList.length === 0 ? (
        <div className="admin-feedback-empty">
          <span className="admin-feedback-empty-icon">☆</span>
          <h3>No feedback available</h3>
          <p>
            Customer feedback will appear here after it is submitted.
          </p>
        </div>
      ) : (
        <div className="admin-feedback-list">
          {feedbackList.map((item) => {
            const customerName = getCustomerName(item);
            const customerEmail = getCustomerEmail(item);
            const rating = Number(item.rating) || 0;
            const hasResponse = Boolean(
              (item.admin_response || "").trim()
            );

            return (
              <article
                id={`admin-feedback-${item.id}`}
                className={`admin-feedback-card ${
                  String(item.id) === String(highlightedFeedbackId)
                    ? "admin-feedback-notification-highlight"
                    : ""
                }`}
                key={item.id}
              >
                {/* CUSTOMER DETAILS */}
                <div className="admin-feedback-card-top">
                  <div className="admin-feedback-customer">
                    <div className="admin-feedback-avatar">
                      {customerName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3>{customerName}</h3>

                      {customerEmail && (
                        <p>{customerEmail}</p>
                      )}

                      <span className="admin-feedback-date">
                        Submitted: {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`admin-feedback-status ${
                      hasResponse ? "replied" : "awaiting"
                    }`}
                  >
                    {hasResponse
                      ? "Response Sent"
                      : "Awaiting Response"}
                  </span>
                </div>

                {/* RATING */}
                <div className="admin-feedback-rating">
                  <div
                    className="admin-feedback-stars"
                    aria-label={`${rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={
                          star <= rating
                            ? "admin-feedback-star active"
                            : "admin-feedback-star"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <span>
                    {rating}/5
                  </span>
                </div>

                {/* CUSTOMER MESSAGE */}
                <div className="admin-feedback-message">
                  <span className="admin-feedback-message-label">
                    CUSTOMER FEEDBACK
                  </span>

                  <p>
                    {item.comments?.trim() ||
                      "No written feedback was provided."}
                  </p>
                </div>

                {/* RELATED QUOTATION, IF ANY */}
                {item.quotation && (
                  <div className="admin-feedback-quotation">
                    <strong>Related Quotation</strong>

                    <span>
                      {item.quotation.origin || "Unknown origin"}
                      {" → "}
                      {item.quotation.destination ||
                        "Unknown destination"}
                    </span>

                    {item.quotation_id && (
                      <small>
                        Quotation #{item.quotation_id}
                      </small>
                    )}
                  </div>
                )}

                {/* EXISTING ADMIN RESPONSE */}
                {hasResponse && (
                  <div className="admin-feedback-saved-response">
                    <div className="admin-feedback-response-heading">
                      <span>✓</span>
                      <div>
                        <h4>Admin Response</h4>
                        <small>
                          {formatDate(item.admin_response_at)}
                        </small>
                      </div>
                    </div>

                    <p>{item.admin_response}</p>
                  </div>
                )}

                {/* ADMIN RESPONSE FORM */}
                <div className="admin-feedback-reply-form">
                  <label htmlFor={`response-${item.id}`}>
                    {hasResponse
                      ? "Write an updated response"
                      : "Write your response"}
                  </label>

                  <textarea
                    id={`response-${item.id}`}
                    value={responses[item.id] || ""}
                    onChange={(event) =>
                      handleResponseChange(
                        item.id,
                        event.target.value
                      )
                    }
                    placeholder="Type a helpful response to the customer..."
                    rows={3}
                    maxLength={5000}
                  />

                  <div className="admin-feedback-reply-footer">
                    <small>
                      {(responses[item.id] || "").length}/5000
                      characters
                    </small>

                    <button
                      type="button"
                      className="admin-feedback-send-button"
                      onClick={() => handleSendResponse(item.id)}
                      disabled={
                        sendingId === item.id ||
                        !(responses[item.id] || "").trim()
                      }
                    >
                      {sendingId === item.id
                        ? "Sending..."
                        : hasResponse
                          ? "Update Response →"
                          : "Send Response →"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* RECENT FEEDBACK RESPONSES */}
      <section className="admin-feedback-recent-section">
        <div className="admin-feedback-section-heading">
          <div>
            <h2>Recent Feedback Responses</h2>
            <p>Responses currently saved in the database.</p>
          </div>
        </div>

        {repliedFeedback.length === 0 ? (
          <div className="admin-feedback-empty compact">
            <p>No admin responses have been sent yet.</p>
          </div>
        ) : (
          <div className="admin-feedback-recent-list">
            {[...repliedFeedback]
              .sort((a, b) => {
                const dateA = new Date(
                  a.admin_response_at || a.created_at || 0
                ).getTime();

                const dateB = new Date(
                  b.admin_response_at || b.created_at || 0
                ).getTime();

                return dateB - dateA;
              })
              .map((item) => (
                <article
                  className="admin-feedback-recent-card"
                  key={`recent-${item.id}`}
                >
                  <div className="admin-feedback-recent-top">
                    <div>
                      <h3>{getCustomerName(item)}</h3>
                      <span>Feedback #{item.id}</span>
                    </div>

                    <time>
                      {formatDate(item.admin_response_at)}
                    </time>
                  </div>

                  <p>{item.admin_response}</p>
                </article>
              ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default AdminFeedback;