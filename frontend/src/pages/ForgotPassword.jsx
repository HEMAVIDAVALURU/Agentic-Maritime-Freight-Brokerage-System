import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

const OTP_DURATION_SECONDS = 5 * 60;
const OTP_EXPIRY_STORAGE_KEY = "forgotPasswordOtpExpiresAt";

function ForgotPassword() {
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [loading, setLoading] = useState(false);

  // OTP countdown
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);

  const navigate = useNavigate();

  // =========================================================
  // COMMON MESSAGE
  // =========================================================

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
  };

  // =========================================================
  // OTP COUNTDOWN
  // =========================================================

  useEffect(() => {
    if (!otpExpiresAt) {
      setOtpTimeLeft(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(otpExpiresAt).getTime() - Date.now()) / 1000
        )
      );

      setOtpTimeLeft(remaining);
    };

    updateCountdown();

    const timer = window.setInterval(() => {
      updateCountdown();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [otpExpiresAt]);

  // =========================================================
  // RESTORE OTP TIMER AFTER REFRESH
  // =========================================================

  useEffect(() => {
    if (step !== 2) {
      return;
    }

    const storedExpiry = sessionStorage.getItem(
      OTP_EXPIRY_STORAGE_KEY
    );

    if (storedExpiry) {
      const expiry = Number(storedExpiry);

      if (
        Number.isFinite(expiry) &&
        expiry > Date.now()
      ) {
        setOtpExpiresAt(expiry);
      } else {
        sessionStorage.removeItem(
          OTP_EXPIRY_STORAGE_KEY
        );
        setOtpExpiresAt(null);
        setOtpTimeLeft(0);
      }
    }
  }, [step]);

  // =========================================================
  // START / RESET OTP TIMER
  // =========================================================

  const startOtpTimer = (expiresAtFromServer = null) => {
    let expiryTime;

    if (expiresAtFromServer) {
      const serverExpiry = new Date(
        expiresAtFromServer
      ).getTime();

      if (Number.isFinite(serverExpiry)) {
        expiryTime = serverExpiry;
      }
    }

    // If backend does not send expires_at,
    // use the same 5-minute OTP duration.
    if (!expiryTime) {
      expiryTime =
        Date.now() + OTP_DURATION_SECONDS * 1000;
    }

    sessionStorage.setItem(
      OTP_EXPIRY_STORAGE_KEY,
      String(expiryTime)
    );

    setOtpExpiresAt(expiryTime);
  };

  // =========================================================
  // FORMAT OTP TIMER
  // =========================================================

  const formatOtpTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  // =========================================================
  // STEP 1 - SEND PASSWORD RESET OTP
  // =========================================================

  const handleSendOTP = async (e) => {
    e.preventDefault();

    setMessage("");

    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      showMessage(
        "Please enter your registered email address.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to send password reset OTP."
        );
      }

      if (data.status !== "success") {
        throw new Error(
          data.message ||
            "Unable to send password reset OTP."
        );
      }

      sessionStorage.setItem(
        "forgotPasswordEmail",
        cleanedEmail
      );

      // Start the 5-minute countdown.
      // If backend provides expires_at, use that exact value.
      startOtpTimer(data.expires_at);

      showMessage(
        data.message ||
          "OTP has been sent to your email address.",
        "success"
      );

      setTimeout(() => {
        setMessage("");
        setStep(2);
      }, 700);
    } catch (error) {
      console.error(
        "Send password reset OTP error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to send OTP. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // STEP 2 - VERIFY PASSWORD RESET OTP
  // =========================================================

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    setMessage("");

    const cleanedEmail =
      email.trim() ||
      sessionStorage.getItem("forgotPasswordEmail") ||
      "";

    const cleanedOTP = otp.trim();

    if (!cleanedEmail) {
      showMessage(
        "Email information is missing. Please start again.",
        "error"
      );
      setStep(1);
      return;
    }

    if (otpTimeLeft <= 0) {
      showMessage(
        "This OTP has expired. Please request a new OTP.",
        "error"
      );
      return;
    }

    if (!cleanedOTP) {
      showMessage(
        "Please enter the OTP.",
        "error"
      );
      return;
    }

    if (cleanedOTP.length !== 6) {
      showMessage(
        "Please enter the complete 6-digit OTP.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/forgot-password/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanedEmail,
            otp: cleanedOTP,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Invalid password reset OTP."
        );
      }

      if (data.status !== "success") {
        throw new Error(
          data.message ||
            "Invalid password reset OTP."
        );
      }

      showMessage(
        data.message ||
          "OTP verified successfully.",
        "success"
      );

      setTimeout(() => {
        setMessage("");
        setStep(3);
      }, 700);
    } catch (error) {
      console.error(
        "Password reset OTP verification error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to verify OTP. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // STEP 3 - UPDATE PASSWORD
  // =========================================================

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    setMessage("");

    const cleanedEmail =
      email.trim() ||
      sessionStorage.getItem("forgotPasswordEmail") ||
      "";

    const cleanedOTP = otp.trim();

    if (!cleanedEmail) {
      showMessage(
        "Email information is missing. Please start again.",
        "error"
      );
      setStep(1);
      return;
    }

    if (!cleanedOTP) {
      showMessage(
        "OTP information is missing. Please verify again.",
        "error"
      );
      setStep(2);
      return;
    }

    if (!newPassword || !confirmPassword) {
      showMessage(
        "Please enter and confirm your new password.",
        "error"
      );
      return;
    }

    if (newPassword.length < 8) {
      showMessage(
        "Password must contain at least 8 characters.",
        "error"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        "Passwords do not match.",
        "error"
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/forgot-password/reset",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanedEmail,
            otp: cleanedOTP,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to reset password."
        );
      }

      if (data.status !== "success") {
        throw new Error(
          data.message ||
            "Unable to reset password."
        );
      }

      sessionStorage.removeItem(
        "forgotPasswordEmail"
      );

      sessionStorage.removeItem(
        OTP_EXPIRY_STORAGE_KEY
      );

      setOtpExpiresAt(null);
      setOtpTimeLeft(0);

      setNewPassword("");
      setConfirmPassword("");

      showMessage(
        data.message ||
          "Password updated successfully!",
        "success"
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1500);
    } catch (error) {
      console.error(
        "Password reset error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to update password. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESEND PASSWORD RESET OTP
  // =========================================================

  const handleResendOTP = async () => {
    setMessage("");

    const cleanedEmail =
      email.trim() ||
      sessionStorage.getItem("forgotPasswordEmail") ||
      "";

    if (!cleanedEmail) {
      showMessage(
        "Email information is missing. Please start again.",
        "error"
      );
      setStep(1);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to resend OTP."
        );
      }

      if (data.status !== "success") {
        throw new Error(
          data.message ||
            "Unable to resend OTP."
        );
      }

      setOtp("");

      // Restart the countdown from 5 minutes.
      // If backend provides expires_at, use it.
      startOtpTimer(data.expires_at);

      showMessage(
        data.message ||
          "A new OTP has been sent to your email.",
        "success"
      );
    } catch (error) {
      console.error(
        "Resend password reset OTP error:",
        error
      );

      showMessage(
        error.message ||
          "Unable to resend OTP.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LEFT MARITIME PANEL CONTENT
  // =========================================================

  const renderVisualPanel = () => {
    return (
      <div className="forgot-auth-visual-panel">
        <div className="forgot-auth-kicker">
          SECURE MARITIME ACCESS
        </div>

        <h1>
          Reset Your
          <br />
          Password
        </h1>

        <p>
          Securely recover access to your maritime freight
          account and continue managing your quotations,
          routes and freight operations.
        </p>

        <div className="forgot-route-note">
          <b>EMAIL</b>
          <span>→</span>
          <b>OTP</b>
          <span>→</span>
          <b>RESET</b>
        </div>
      </div>
    );
  };

  // =========================================================
  // STEP INDICATOR
  // =========================================================

  const renderSteps = () => {
    return (
      <div className="forgot-step-indicator">
        <div
          className={`forgot-step ${
            step >= 1 ? "active" : ""
          }`}
        >
          <span>1</span>
          <small>Email</small>
        </div>

        <div className="forgot-step-line"></div>

        <div
          className={`forgot-step ${
            step >= 2 ? "active" : ""
          }`}
        >
          <span>2</span>
          <small>OTP</small>
        </div>

        <div className="forgot-step-line"></div>

        <div
          className={`forgot-step ${
            step >= 3 ? "active" : ""
          }`}
        >
          <span>3</span>
          <small>Password</small>
        </div>
      </div>
    );
  };

  // =========================================================
  // STEP 1
  // =========================================================

  const renderEmailStep = () => {
    return (
      <>
        <h2>Forgot Password?</h2>

        <p className="forgot-info">
          Enter your registered email address and we will
          send you a verification OTP.
        </p>

        <form
          onSubmit={handleSendOTP}
          autoComplete="on"
        >
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
            autoFocus
            required
          />

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>

        <p className="back-login-text">
          Remember your password?{" "}
          <span onClick={() => navigate("/login")}>
            Back to Login
          </span>
        </p>
      </>
    );
  };

  // =========================================================
  // STEP 2
  // =========================================================

  const renderOTPStep = () => {
    const otpExpired = otpTimeLeft <= 0;

    return (
      <>
        <h2>Verify Your Email</h2>

        <p className="forgot-info">
          Enter the 6-digit OTP sent to
          <br />
          <strong>{email}</strong>
        </p>

        <form
          onSubmit={handleVerifyOTP}
          autoComplete="off"
        >
          <input
            type="text"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit OTP"
            value={otp}
            maxLength={6}
            disabled={loading || otpExpired}
            autoFocus
            required
            onChange={(e) => {
              const value = e.target.value.replace(
                /\D/g,
                ""
              );

              setOtp(value);
            }}
          />

          <div
            className={`forgot-otp-timer ${
              otpExpired ? "expired" : ""
            }`}
          >
            {otpExpired ? (
              <>
                OTP expired.{" "}
                <strong>00:00</strong>
              </>
            ) : (
              <>
                OTP expires in:{" "}
                <strong>
                  {formatOtpTime(otpTimeLeft)}
                </strong>
              </>
            )}
          </div>

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              otp.length !== 6 ||
              otpExpired
            }
          >
            {loading
              ? "Verifying..."
              : otpExpired
                ? "OTP Expired"
                : "Verify OTP"}
          </button>
        </form>

        <p className="resend-otp-text">
          Didn't receive the OTP?{" "}
          <span
            onClick={
              loading
                ? undefined
                : handleResendOTP
            }
          >
            Resend OTP
          </span>
        </p>

        <p className="back-login-text">
          <span onClick={() => navigate("/login")}>
            Back to Login
          </span>
        </p>
      </>
    );
  };

  // =========================================================
  // STEP 3
  // =========================================================

  const renderPasswordStep = () => {
    return (
      <>
        <h2>Create New Password</h2>

        <p className="forgot-info">
          Create a new password for your account.
        </p>

        <form
          onSubmit={handleUpdatePassword}
          autoComplete="off"
        >
          <div className="forgot-password-field">
            <input
              type={
                showNewPassword
                  ? "text"
                  : "password"
              }
              name="new_password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              autoComplete="new-password"
              disabled={loading}
              autoFocus
              required
            />

            <button
              type="button"
              className="forgot-password-toggle"
              onClick={() =>
                setShowNewPassword(
                  (previous) => !previous
                )
              }
              aria-label={
                showNewPassword
                  ? "Hide new password"
                  : "Show new password"
              }
              disabled={loading}
            >
              {showNewPassword ? "◉" : "◌"}
            </button>
          </div>

          <div className="forgot-password-field">
            <input
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              name="confirm_password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <button
              type="button"
              className="forgot-password-toggle"
              onClick={() =>
                setShowConfirmPassword(
                  (previous) => !previous
                )
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              disabled={loading}
            >
              {showConfirmPassword ? "◉" : "◌"}
            </button>
          </div>

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Updating Password..."
              : "Update Password"}
          </button>
        </form>

        <p className="back-login-text">
          <span onClick={() => navigate("/login")}>
            Back to Login
          </span>
        </p>
      </>
    );
  };

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <div className="forgot-password-container">
      {renderVisualPanel()}

      <div className="forgot-password-card">
        {renderSteps()}

        {step === 1 && renderEmailStep()}

        {step === 2 && renderOTPStep()}

        {step === 3 && renderPasswordStep()}
      </div>
    </div>
  );
}

export default ForgotPassword;