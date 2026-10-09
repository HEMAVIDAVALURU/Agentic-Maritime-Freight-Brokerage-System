import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    setMessage("");

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage("Please fill in all required fields.");
      setMessageType("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: fullName.trim(),
            email: email.trim(),
            password,
            company_name: companyName.trim() || null,
          }),
        }
      );

      const data = await response.json();

      console.log("Registration response:", data);

      if (!response.ok || data.status !== "success") {
        setMessage(data.message || "Registration failed.");
        setMessageType("error");
        return;
      }

      sessionStorage.setItem(
        "otpEmail",
        data.email || email.trim()
      );

      sessionStorage.removeItem("otpUserId");
      sessionStorage.removeItem("developmentOtp");

      setMessage(
        "Registration successful! OTP has been sent to your email."
      );
      setMessageType("success");

      setTimeout(() => {
        navigate("/verify-otp");
      }, 800);
    } catch (error) {
      console.error("Registration error:", error);

      setMessage(
        "Unable to connect to the server. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">

      {/* LEFT MARITIME INFORMATION PANEL */}
      <div className="register-visual-panel">

        <div className="register-kicker">
          MARITIME FREIGHT INTELLIGENCE
        </div>

        <h1>
          Build your
          <br />
          maritime workspace.
        </h1>

        <p>
          Create your account to explore intelligent sea routes,
          compare freight pricing, analyze weather conditions,
          and manage your quotation requests in one connected
          maritime workspace.
        </p>

        <div className="register-route-note">
          <span>ORIGIN</span>
          <b>SEA ROUTE</b>
          <span>DESTINATION</span>
        </div>

        <div className="register-benefits">
          <div>
            <span className="benefit-icon">✓</span>
            Smart route analysis
          </div>

          <div>
            <span className="benefit-icon">✓</span>
            Freight quotation intelligence
          </div>

          <div>
            <span className="benefit-icon">✓</span>
            Weather & customs insights
          </div>
        </div>

      </div>

      {/* RIGHT REGISTRATION CARD */}
      <div className="register-card">

        <h2>Create Your Account</h2>

        <p className="register-subtitle">
          Join Maritime Freight Intelligence.
        </p>

        <form onSubmit={handleRegister} autoComplete="on">

          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <input
            type="text"
            name="company_name"
            placeholder="Company Name (Optional)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            autoComplete="organization"
          />

          {/* PASSWORD */}
          <div className="register-password-wrap">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <button
              type="button"
              className={`register-password-toggle ${
                showPassword ? "active" : ""
              }`}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "◉" : "◌"}
            </button>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="register-password-wrap">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirm_password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <button
              type="button"
              className={`register-password-toggle ${
                showConfirmPassword ? "active" : ""
              }`}
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              title={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
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
            className="register-submit"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register Now"}
          </button>

        </form>

        <p className="login-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>
            Login here
          </span>
        </p>

      </div>
    </div>
  );
}

export default Register;