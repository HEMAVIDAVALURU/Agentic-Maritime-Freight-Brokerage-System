import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Please enter email and password.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:8000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      console.log("Login response:", data);

      if (!response.ok || data.status !== "success") {
        setMessage(data.message || "Invalid email or password.");
        setMessageType("error");
        return;
      }

      // -----------------------------------------------------
      // Verify that the authentication cookie is working
      // -----------------------------------------------------

      const meResponse = await fetch(
        "http://localhost:8000/api/auth/me",
        {
          method: "GET",
          credentials: "include",
        }
      );

      const meData = await meResponse.json();

      console.log("Current user response:", meData);

      if (!meResponse.ok || !meData.success) {
        setMessage(
          "Login succeeded, but the authentication session could not be established."
        );
        setMessageType("error");
        return;
      }

      setMessage("Login successful! Redirecting...");
      setMessageType("success");

      setTimeout(() => {
        navigate("/user-dashboard", {
          replace: true,
        });
      }, 700);
    } catch (error) {
      console.error("Login error:", error);

      setMessage(
        "Unable to connect to the server. Please try again."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="auth-visual-panel">
        <span className="auth-kicker">MARITIME FREIGHT INTELLIGENCE</span>
        <h1>Smarter quotations for every sea route.</h1>
        <p>Compare freight costs, route intelligence and approval status from one connected maritime workspace.</p>
        <div className="auth-route-note">
          <span>Origin</span><b>SEA ROUTE</b><span>Destination</span>
        </div>
      </div>

      <div className="login-card">

        <h2>Welcome Back</h2>

        <p className="otp-info">
          Login to continue to Maritime Freight.
        </p>

        <form
          onSubmit={handleLogin}
          autoComplete="on"
        >

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />

          <div className="password-field-wrap">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "◉" : "◌"}
            </button>
          </div>

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          <p className="forgot-password-link" onClick={() => navigate("/forgot-password")}>Forgot password?</p>

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

        </form>

        <p className="login-text">
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")}>
            Register here
          </span>
        </p>

      </div>

    </div>
  );
}

export default Login;