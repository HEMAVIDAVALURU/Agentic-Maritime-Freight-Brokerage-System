import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminLogin.css";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!email.trim() || !password) {
      setMessage("Please enter admin email and password.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/admin-login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          credentials: "include",

          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      const data = await response.json();

      console.log("Admin login response:", data);

      if (!response.ok || data.status !== "success") {
        setMessage(
          data.message || "Invalid admin credentials."
        );

        setMessageType("error");
        return;
      }

      setMessage(
        "Admin login successful! Redirecting..."
      );

      setMessageType("success");

      console.log("Admin login successful.");
      console.log("Navigating to /admin-dashboard");

      setTimeout(() => {
        navigate("/admin-dashboard");
      }, 1000);

    } catch (error) {
      console.error("Admin login error:", error);

      setMessage(
        "Unable to connect to the server. Please try again."
      );

      setMessageType("error");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">

      {/* =================================================
          MARITIME INFORMATION PANEL
      ================================================= */}

      <div className="admin-auth-visual-panel">

        <div className="admin-auth-kicker">
          MARITIME FREIGHT BROKERAGE
        </div>

        <h1>
          Command Your
          <br />
          Fleet
        </h1>

        <p>
          Access the administrative control center for maritime
          freight operations. Manage quotations, users, approvals,
          pricing, routes and platform activity from one secure
          workspace.
        </p>

        <div className="admin-auth-route-note">
          <b>CONTROL</b>
          <span>→</span>
          <b>MANAGE</b>
          <span>→</span>
          <b>APPROVE</b>
        </div>

      </div>


      {/* =================================================
          ADMIN LOGIN CARD
      ================================================= */}

      <div className="admin-login-card">

        <h2>Admin Login</h2>

        <p className="admin-login-info">
          Login to access the Maritime Freight Admin Dashboard.
        </p>

        <form
          onSubmit={handleAdminLogin}
          autoComplete="on"
        >

          {/* =================================================
              ADMIN EMAIL
          ================================================= */}

          <input
            type="email"
            name="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            disabled={loading}
            required
          />


          {/* =================================================
              ADMIN PASSWORD
          ================================================= */}

          <div className="admin-password-field-wrap">

            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />

            <button
              type="button"
              className="admin-password-toggle"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              aria-label={
                showPassword
                  ? "Hide admin password"
                  : "Show admin password"
              }
              title={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              disabled={loading}
            >
              {showPassword ? "◉" : "◉"}
            </button>

          </div>


          {/* =================================================
              MESSAGE
          ================================================= */}

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}


          {/* =================================================
              LOGIN BUTTON
          ================================================= */}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Admin Login"}
          </button>

        </form>


        {/* =================================================
            CUSTOMER LOGIN
        ================================================= */}

        <p className="login-text">
          Customer?{" "}

          <span
            onClick={() => navigate("/login")}
          >
            Customer Login
          </span>

        </p>

      </div>

    </div>
  );
}

export default AdminLogin;