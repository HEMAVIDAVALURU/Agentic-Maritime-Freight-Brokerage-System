import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

      // Store only the email needed for OTP verification.
      sessionStorage.setItem("otpEmail", data.email || email.trim());

      // Remove any old OTP session data.
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
      <div className="register-card">

        <h2>Create Your Account</h2>

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

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <input
            type="password"
            name="confirm_password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}

          <button type="submit" disabled={loading}>
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