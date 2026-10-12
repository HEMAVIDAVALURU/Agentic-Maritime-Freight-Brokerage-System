
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const handleRoleChange = (nextRole) => {
    if (loading) return;

    setRole(nextRole);
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setMessage("");
    setMessageType("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const endpoint = isAdmin
        ? "http://localhost:8000/api/auth/admin-login"
        : "http://localhost:8000/api/auth/login";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        setMessage(
          data.message ||
            (isAdmin
              ? "Invalid admin credentials."
              : "Invalid customer email or password.")
        );
        setMessageType("error");
        return;
      }

      if (!isAdmin) {
        const meResponse = await fetch(
          "http://localhost:8000/api/auth/me",
          {
            method: "GET",
            credentials: "include",
          }
        );

        const meData = await meResponse.json();

        if (!meResponse.ok || !meData.success) {
          setMessage(
            "Login succeeded, but the authentication session could not be established."
          );
          setMessageType("error");
          return;
        }
      }

      setMessage("Login successful! Redirecting...");
      setMessageType("success");

      const destination = isAdmin
        ? "/admin-dashboard"
        : "/user-dashboard";

      window.setTimeout(() => {
        navigate(destination, { replace: true });
      }, 600);
    } catch (error) {
      console.error("Login error:", error);

      setMessage("Unable to connect to the server. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-container">
      {/* LEFT MARITIME VISUAL PANEL */}
      <section className="auth-visual-panel">
        <div className="auth-visual-content">
          <span className="auth-kicker">
            MARITIME FREIGHT INTELLIGENCE
          </span>

          <h1>
            Smarter
            <br />
            quotations for
            <br />
            every sea route.
          </h1>

          <p>
            Access intelligent route analysis, freight pricing,
            quotation management and maritime operations from
            one connected workspace.
          </p>

          <div className="auth-route-note">
            <span>ORIGIN</span>
            <b>SEA ROUTE</b>
            <span>DESTINATION</span>
          </div>
        </div>

        <div className="auth-watermark" aria-hidden="true">
          MARITIME
        </div>
      </section>

      {/* RIGHT LOGIN CARD */}
      <section className="login-card">
        <div className="login-card-content">
          <span className="login-eyebrow">
            {isAdmin ? "ADMINISTRATOR PORTAL" : "CUSTOMER PORTAL"}
          </span>

          <h2>Welcome Back</h2>

          <p className="login-subtitle">
            Select your account type to continue.
          </p>

          <div
            className="login-role-tabs"
            role="group"
            aria-label="Select account type"
          >
            <button
              type="button"
              className={`login-role-tab ${
                role === "customer" ? "active" : ""
              }`}
              aria-pressed={role === "customer"}
              onClick={() => handleRoleChange("customer")}
              disabled={loading}
            >
              Customer Login
            </button>

            <button
              type="button"
              className={`login-role-tab ${
                role === "admin" ? "active" : ""
              }`}
              aria-pressed={role === "admin"}
              onClick={() => handleRoleChange("admin")}
              disabled={loading}
            >
              Admin Login
            </button>
          </div>

          <p className="login-role-description">
            {isAdmin
              ? "Sign in with your authorized administrator credentials."
              : "Sign in to manage your routes and freight quotations."}
          </p>

          <form onSubmit={handleLogin} autoComplete="on">
            <label className="login-field-label" htmlFor="login-email">
              Email Address
            </label>

            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={loading}
              required
            />

            <label
              className="login-field-label"
              htmlFor="login-password"
            >
              Password
            </label>

            <div className="password-field-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {message && (
              <p
                className={`message ${messageType}`}
                role="alert"
                aria-live="polite"
              >
                {message}
              </p>
            )}

            {!isAdmin && (
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => navigate("/forgot-password")}
                disabled={loading}
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              className="login-submit-button"
              disabled={loading}
            >
              {loading
                ? "Logging in..."
                : isAdmin
                ? "Admin Login"
                : "Customer Login"}
            </button>
          </form>

          {!isAdmin ? (
            <p className="login-text">
              Don't have an account?{" "}
              <button
                type="button"
                className="login-inline-link"
                onClick={() => navigate("/register")}
                disabled={loading}
              >
                Register here
              </button>
            </p>
          ) : (
            <p className="login-text admin-login-footer">
              Authorized administrators only.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default Login;

