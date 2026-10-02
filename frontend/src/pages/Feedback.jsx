import { useCallback, useEffect, useState } from "react";
import "./Feedback.css";

const API_URL = "http://localhost:8000/api/feedback";
const AUTH_URL = "http://localhost:8000/api/auth/me";

function Feedback() {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  // =========================================================
  // FETCH CURRENT LOGGED-IN USER
  // =========================================================

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoadingUser(true);
        setError("");

        const response = await fetch(AUTH_URL, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(
            "Unable to identify the logged-in user. Please login again."
          );
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error(
            "User information not found. Please login again."
          );
        }

        setCurrentUser(data.user);
      } catch (err) {
        console.error("Current user error:", err);

        setError(
          err.message || "Unable to identify the logged-in user."
        );
      } finally {
        setLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // =========================================================
  // FETCH USER FEEDBACK HISTORY
  // =========================================================

  const fetchFeedbackHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setHistoryError("");

      const response = await fetch(
        `${API_URL}/my-feedback`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load your feedback history."
        );
      }

      setFeedbackHistory(
        Array.isArray(data.feedback) ? data.feedback : []
      );
    } catch (err) {
      console.error("Feedback history error:", err);

      setHistoryError(
        err.message || "Unable to load your feedback history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchFeedbackHistory();
    }
  }, [currentUser, fetchFeedbackHistory]);

  // =========================================================
  // SUBMIT FEEDBACK
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (rating === 0) {
      setError("Please select a rating before submitting.");
      return;
    }

    if (!currentUser?.id) {
      setError("Please login again to submit your feedback.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API_URL}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          user_id: currentUser.id,
          rating,
          feedback_text: feedback.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to submit feedback."
        );
      }

      setSuccessMessage(
        data.message || "Thank you for your valuable feedback!"
      );

      setRating(0);
      setFeedback("");

      // Refresh history so the new feedback appears.
      await fetchFeedbackHistory();
    } catch (err) {
      console.error("Feedback submission error:", err);

      setError(
        err.message || "Unable to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // RATING TEXT
  // =========================================================

  const getRatingText = (value) => {
    switch (value) {
      case 1:
        return "Very dissatisfied";
      case 2:
        return "Dissatisfied";
      case 3:
        return "Neutral";
      case 4:
        return "Satisfied";
      case 5:
        return "Very satisfied";
      default:
        return "";
    }
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Date unavailable";
    }

    const date = new Date(dateValue);

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
  };

  // =========================================================
  // STAR DISPLAY
  // =========================================================

  const renderStars = (value) => (
    <div
      className="feedback-history-stars"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= value
              ? "feedback-history-star filled"
              : "feedback-history-star"
          }
        >
          ★
        </span>
      ))}
    </div>
  );

  // =========================================================
  // LOADING
  // =========================================================

  if (loadingUser) {
    return (
      <section className="feedback-page">
        <div className="feedback-loading-card">
          <div className="feedback-loading">
            Loading your feedback page...
          </div>
        </div>
      </section>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <section className="feedback-page">

      {/* PAGE HEADER */}

      <div className="feedback-header">
        <p className="feedback-eyebrow">
          USER EXPERIENCE
        </p>

        <h1>Feedback</h1>

        <p>
          Share your experience with our maritime
          freight platform.
        </p>
      </div>

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div
          className="feedback-success-banner"
          role="status"
        >
          <span className="feedback-banner-icon">✓</span>

          <div>
            <strong>Feedback submitted successfully!</strong>
            <p>{successMessage}</p>
          </div>

          <button
            type="button"
            className="feedback-banner-close"
            onClick={() => setSuccessMessage("")}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      {/* SUBMIT FEEDBACK FORM */}

      <form
        className="feedback-card"
        onSubmit={handleSubmit}
      >
        <div className="feedback-question">
          <h2>Overall Satisfaction</h2>

          <p>
            How satisfied are you with your overall experience?
          </p>
        </div>

        {/* STAR RATING */}

        <div
          className="feedback-stars"
          role="group"
          aria-label="Select your rating"
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              className={`feedback-star ${
                star <= rating ? "active" : ""
              }`}
              onClick={() => setRating(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              aria-pressed={rating === star}
            >
              ★
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="feedback-rating-text">
            {getRatingText(rating)}
          </p>
        )}

        {/* FEEDBACK TEXT */}

        <div className="feedback-text-section">
          <label htmlFor="feedback">
            Your Feedback
          </label>

          <textarea
            id="feedback"
            value={feedback}
            onChange={(event) =>
              setFeedback(event.target.value)
            }
            placeholder="Write your feedback or suggestions..."
            rows={7}
            maxLength={5000}
          />

          <div className="feedback-character-count">
            {feedback.length}/5000 characters
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}

        {/* SUBMIT BUTTON */}

        <button
          type="submit"
          className="feedback-submit-button"
          disabled={rating === 0 || submitting}
        >
          {submitting
            ? "Submitting..."
            : "Submit Feedback"}
        </button>

        {rating === 0 && !error && (
          <p className="feedback-hint">
            Please select a rating before submitting.
          </p>
        )}
      </form>

      {/* =====================================================
          MY FEEDBACK HISTORY
      ===================================================== */}

      <section className="feedback-history-section">

        <div className="feedback-history-header">
          <div>
            <p className="feedback-eyebrow">
              YOUR ACTIVITY
            </p>

            <h2>My Feedback History</h2>

            <p>
              Review your previous feedback and responses
              from our team.
            </p>
          </div>

          <button
            type="button"
            className="feedback-refresh-button"
            onClick={fetchFeedbackHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* HISTORY ERROR */}

        {historyError && (
          <div className="feedback-history-error" role="alert">
            <p>{historyError}</p>

            <button
              type="button"
              onClick={fetchFeedbackHistory}
              disabled={loadingHistory}
            >
              Try Again
            </button>
          </div>
        )}

        {/* LOADING HISTORY */}

        {loadingHistory && feedbackHistory.length === 0 ? (
          <div className="feedback-history-empty">
            Loading your feedback history...
          </div>
        ) : !historyError && feedbackHistory.length === 0 ? (
          <div className="feedback-history-empty">
            <div className="feedback-empty-icon">✎</div>

            <h3>No feedback submitted yet</h3>

            <p>
              Your submitted feedback will appear here.
            </p>
          </div>
        ) : (
          <div className="feedback-history-list">

            {feedbackHistory.map((item) => {
              const hasResponse =
                typeof item.admin_response === "string" &&
                item.admin_response.trim().length > 0;

              return (
                <article
                  className="feedback-history-card"
                  key={item.id}
                >
                  {/* USER FEEDBACK */}

                  <div className="feedback-history-card-header">
                    <div>
                      <span className="feedback-history-label">
                        YOUR FEEDBACK
                      </span>

                      {renderStars(item.rating)}
                    </div>

                    <span
                      className={`feedback-response-status ${
                        hasResponse
                          ? "response-received"
                          : "response-pending"
                      }`}
                    >
                      {hasResponse
                        ? "Response received"
                        : "Awaiting response"}
                    </span>
                  </div>

                  <div className="feedback-history-message">
                    <p>
                      {item.comments?.trim()
                        ? item.comments
                        : "No written comment provided."}
                    </p>
                  </div>

                  <p className="feedback-history-date">
                    Submitted: {formatDate(item.created_at)}
                  </p>

                  {/* RELATED QUOTATION */}

                  {item.quotation && (
                    <div className="feedback-related-quotation">
                      <strong>Related quotation</strong>

                      <p>
                        {item.quotation.origin} →{" "}
                        {item.quotation.destination}
                      </p>

                      {item.quotation.selected_route_id && (
                        <span>
                          Route: {item.quotation.selected_route_id}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ADMIN RESPONSE */}

                  {hasResponse ? (
                    <div className="feedback-admin-response">

                      <div className="feedback-admin-response-header">
                        <div className="feedback-admin-avatar">
                          A
                        </div>

                        <div>
                          <strong>Admin Response</strong>

                          <span>
                            {formatDate(item.admin_response_at)}
                          </span>
                        </div>
                      </div>

                      <div className="feedback-admin-message">
                        <p>{item.admin_response}</p>
                      </div>

                    </div>
                  ) : (
                    <div className="feedback-pending-message">
                      <span className="feedback-pending-dot" />

                      Our team has received your feedback.
                      A response will appear here when available.
                    </div>
                  )}
                </article>
              );
            })}

          </div>
        )}
      </section>
    </section>
  );
}

export default Feedback;