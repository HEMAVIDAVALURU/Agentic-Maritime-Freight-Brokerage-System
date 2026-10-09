import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./VerifyOTP.css";

function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [timeLeft, setTimeLeft] = useState(300);
  const [isExpired, setIsExpired] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const navigate = useNavigate();

  const email = sessionStorage.getItem("otpEmail");

  useEffect(() => {
    if (!email || isVerified) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) => {
        if (previousTime <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          return 0;
        }

        return previousTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [email, isVerified]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email) {
      setMessage("Registration session expired. Please register again.");
      setMessageType("error");
      return;
    }

    if (!otp) {
      setMessage("Please enter the OTP.");
      setMessageType("error");
      return;
    }

    if (otp.length !== 6) {
      setMessage("Please enter the complete 6-digit OTP.");
      setMessageType("error");
      return;
    }

    if (isVerifying || isVerified) {
      return;
    }

    try {
      setIsVerifying(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email,
            otp: otp,
          }),
        }
      );

      const data = await response.json();

      console.log("OTP verification response:", data);

      if (!response.ok || data.status !== "success") {
        setMessage(data.message || "OTP verification failed.");
        setMessageType("error");

        if (
          data.message &&
          data.message.toLowerCase().includes("expired")
        ) {
          setIsExpired(true);
          setTimeLeft(0);
        }

        return;
      }

      setIsVerified(true);
      setIsExpired(false);
      setTimeLeft(0);

      setMessage(
        "Email verified successfully! Redirecting to login..."
      );
      setMessageType("success");

      sessionStorage.removeItem("otpEmail");
      sessionStorage.removeItem("otpUserId");
      sessionStorage.removeItem("developmentOtp");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (error) {
      console.error("OTP verification error:", error);

      setMessage(
        "Unable to connect to the server. Please try again."
      );
      setMessageType("error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    setMessage("");

    if (!email) {
      setMessage("Registration session expired. Please register again.");
      setMessageType("error");
      return;
    }

    if (isResending || isVerified) {
      return;
    }

    try {
      setIsResending(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/resend-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email,
          }),
        }
      );

      const data = await response.json();

      console.log("Resend OTP response:", data);

      if (!response.ok || data.status !== "success") {
        setMessage(data.message || "Unable to resend OTP.");
        setMessageType("error");
        return;
      }

      setOtp("");
      setTimeLeft(300);
      setIsExpired(false);

      setMessage("A new OTP has been sent to your email.");
      setMessageType("success");
    } catch (error) {
      console.error("Resend OTP error:", error);

      setMessage(
        "Unable to connect to the server. Please try again."
      );
      setMessageType("error");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="otp-container">

      {/* ================================
          MARITIME INFORMATION PANEL
      ================================= */}
      <div className="auth-visual-panel">

        <div className="auth-kicker">
          MARITIME FREIGHT BROKERAGE
        </div>

        <h1>
          Secure Your
          <br />
          Voyage
        </h1>

        <p>
          One final checkpoint before you enter your maritime
          freight workspace. Verify your email to securely continue
          with quotations, route analysis, pricing and shipment
          management.
        </p>

        <div className="auth-route-note">
          <b>EMAIL</b>
          <span>→</span>
          <b>VERIFIED</b>
          <span>→</span>
          <b>ACCESS</b>
        </div>

      </div>

      {/* ================================
          OTP CARD
      ================================= */}
      <div className="otp-card">

        <h2>Verify Your Email</h2>

        <p className="otp-info">
          We have sent a 6-digit OTP to your registered email
          address.
        </p>

        {email && (
          <p className="otp-email">
            Email: <strong>{email}</strong>
          </p>
        )}

        {!isVerified && (
          <div
            className={`otp-timer ${
              isExpired ? "expired" : ""
            }`}
          >
            {isExpired ? (
              <span>OTP expired</span>
            ) : (
              <span>
                OTP expires in:{" "}
                <strong>{formatTime(timeLeft)}</strong>
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleVerifyOTP}>

          {!isVerified && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit OTP"
              value={otp}
              maxLength={6}
              disabled={isVerifying}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setOtp(value);
              }}
            />
          )}

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          {!isExpired && !isVerified && (
            <button
              type="submit"
              disabled={otp.length !== 6 || isVerifying}
            >
              {isVerifying ? "Verifying..." : "Verify OTP"}
            </button>
          )}

          {isExpired && !isVerified && (
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={isResending}
            >
              {isResending ? "Sending OTP..." : "Resend OTP"}
            </button>
          )}

        </form>

        {!isVerified && (
          <p className="login-text">
            Already verified?{" "}
            <span onClick={() => navigate("/login")}>
              Login here
            </span>
          </p>
        )}

      </div>
    </div>
  );
}

export default VerifyOTP;