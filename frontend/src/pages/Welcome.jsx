
import { useNavigate } from "react-router-dom";
import "./Welcome.css";

function Welcome() {
  const navigate = useNavigate();

  return (
    <main className="welcome-page">
      <div className="welcome-overlay" aria-hidden="true" />

      <div className="welcome-content">
        <div className="ship-icon" aria-hidden="true">
          ⚓
        </div>

        <h1>
          <span>Agentic AI</span> for Maritime Freight
          <br />
          Pricing and Route Optimization
        </h1>

        <div className="title-line" />

        <p className="welcome-tagline">
          Smarter routes. Better pricing. A more connected world.
        </p>

        <section className="welcome-section">
          <h2>Welcome to Maritime Freight</h2>
          <p>
            Intelligent maritime freight pricing and route
            optimization in one place.
          </p>
        </section>

        <div className="welcome-actions">
          <button
            type="button"
            className="welcome-login-button"
            onClick={() => navigate("/login")}
          >
            <span>Login</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>

          <button
            type="button"
            className="welcome-register-button"
            onClick={() => navigate("/register")}
          >
            <span>Register</span>
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default Welcome;