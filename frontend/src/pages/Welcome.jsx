import { useNavigate } from "react-router-dom";

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-page">

      {/* Background decorative elements */}
      <div className="background-grid"></div>
      <div className="glow glow-left"></div>
      <div className="glow glow-right"></div>

      {/* World route lines */}
      <div className="route-line route-one"></div>
      <div className="route-line route-two"></div>
      <div className="route-line route-three"></div>

      {/* Main Content */}
      <div className="welcome-content">

        {/* Maritime Icon */}
        <div className="ship-icon">
          ⚓
        </div>

        {/* Project Title */}
        <h1>
          <span>Agentic AI</span> for Maritime Freight
          <br />
          Pricing and Route Optimization
        </h1>

        {/* Small line */}
        <div className="title-line"></div>

        {/* Tagline */}
        <p className="welcome-tagline">
          Smarter routes. Better pricing. A more connected world.
        </p>

        {/* Welcome Heading */}
        <div className="welcome-section">

          <h2>Welcome to Maritime Freight</h2>

          <p>
            Please select your login type to continue.
          </p>

        </div>

        {/* Login Cards */}
        <div className="login-options">

          {/* Customer Login */}
          <div className="login-card customer-card">

            <div className="login-icon customer-icon">
              👤
            </div>

            <h3>Customer Login</h3>

            <p>
              Access your account, manage shipments
              and track your cargo.
            </p>

            <button
              type="button"
              onClick={() => navigate("/login")}
            >
              <span>Login Now</span>
              <span className="arrow">→</span>
            </button>

          </div>

          {/* Admin Login */}
          <div className="login-card admin-card">

            <div className="login-icon admin-icon">
              🛡
            </div>

            <h3>Admin Login</h3>

            <p>
              Secure access for authorized
              administrators.
            </p>

            <button
              type="button"
              onClick={() => navigate("/admin-login")}
            >
              <span>Login Now</span>
              <span className="arrow">→</span>
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Welcome;