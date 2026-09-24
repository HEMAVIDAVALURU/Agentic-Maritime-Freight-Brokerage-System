import { useEffect, useState } from "react";

import "./Feedback.css";

function Feedback() {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // FETCH CURRENT LOGGED-IN USER
  // =========================================================

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setLoadingUser(true);
        setError("");

        const response = await fetch(
          "http://localhost:8000/api/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to identify the logged-in user."
          );
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error(
            "User information not found. Please login again."
          );
        }

        setCurrentUser(data.user);
      } catch (error) {
        console.error(
          "Current user error:",
          error
        );

        setError(
          error.message ||
            "Unable to identify the logged-in user."
        );
      } finally {
        setLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // =========================================================
  // SUBMIT FEEDBACK
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (rating === 0) {
      setError(
        "Please select a rating before submitting."
      );
      return;
    }

    if (!currentUser?.id) {
      setError(
        "User information not found. Please login again."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "http://localhost:8000/api/feedback/submit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            user_id: currentUser.id,
            rating: rating,
            feedback_text: feedback.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        throw new Error(
          data.message ||
            "Unable to submit feedback."
        );
      }

      setSubmitted(true);

      setRating(0);
      setFeedback("");
    } catch (error) {
      console.error(
        "Feedback submission error:",
        error
      );

      setError(
        error.message ||
          "Unable to submit feedback."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================
  // RATING TEXT
  // =========================================================

  const getRatingText = () => {
    switch (rating) {
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
  // UI
  // =========================================================

  return (
    <section className="feedback-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="feedback-header">

        <p className="feedback-eyebrow">
          USER EXPERIENCE
        </p>

        <h1>
          Feedback
        </h1>

        <p>
          Share your experience with our maritime
          freight platform.
        </p>

      </div>

      {/* =====================================================
          LOADING USER
      ===================================================== */}

      {loadingUser ? (

        <div className="feedback-card feedback-loading-card">

          <div className="feedback-loading">

            Loading your feedback form...

          </div>

        </div>

      ) : submitted ? (

        /* ===================================================
           SUCCESS MESSAGE
        =================================================== */

        <div className="feedback-success-card">

          <div className="feedback-success-icon">
            ✓
          </div>

          <h2>
            Thank you for your valuable feedback!
          </h2>

          <p>
            Your feedback has been submitted
            successfully.
          </p>

        </div>

      ) : (

        /* ===================================================
           FEEDBACK FORM
        =================================================== */

        <form
          className="feedback-card"
          onSubmit={handleSubmit}
        >

          {/* =================================================
              QUESTION
          ================================================= */}

          <div className="feedback-question">

            <h2>
              Overall Satisfaction
            </h2>

            <p>
              How satisfied are you with your
              overall experience?
            </p>

          </div>

          {/* =================================================
              STAR RATING
          ================================================= */}

          <div className="feedback-stars">

            {[1, 2, 3, 4, 5].map((star) => (

              <button
                type="button"
                key={star}
                className={`feedback-star ${
                  star <= rating
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setRating(star)
                }
                aria-label={`${star} star`}
              >
                ★
              </button>

            ))}

          </div>

          {/* =================================================
              RATING DESCRIPTION
          ================================================= */}

          {rating > 0 && (

            <p className="feedback-rating-text">
              {getRatingText()}
            </p>

          )}

          {/* =================================================
              FEEDBACK TEXT
          ================================================= */}

          <div className="feedback-text-section">

            <label htmlFor="feedback">
              Your Feedback
            </label>

            <textarea
              id="feedback"
              value={feedback}
              onChange={(event) =>
                setFeedback(
                  event.target.value
                )
              }
              placeholder="Write your feedback or suggestions..."
              rows={7}
            />

          </div>

          {/* =================================================
              ERROR MESSAGE
          ================================================= */}

          {error && (

            <p className="feedback-error">
              {error}
            </p>

          )}

          {/* =================================================
              SUBMIT BUTTON
          ================================================= */}

          <button
            type="submit"
            className="feedback-submit-button"
            disabled={
              rating === 0 ||
              submitting
            }
          >

            {submitting
              ? "Submitting..."
              : "Submit Feedback"}

          </button>

          {/* =================================================
              RATING HINT
          ================================================= */}

          {rating === 0 && !error && (

            <p className="feedback-hint">
              Please select a rating before submitting.
            </p>

          )}

        </form>

      )}

    </section>
  );
}

export default Feedback;