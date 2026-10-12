
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";
import ForgotPassword from "./pages/ForgotPassword";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Welcome Page */}
        <Route path="/" element={<Welcome />} />

        {/* Customer Registration */}
        <Route
          path="/register"
          element={
            <>
              <header className="project-header">
                <h1>
                  Agentic AI for Maritime Freight Pricing and Route Optimization
                </h1>
                <p>
                  Intelligent routes. Optimized decisions. Smarter freight pricing.
                </p>
              </header>
              <Register />
            </>
          }
        />

        {/* Combined Customer + Admin Login */}
        <Route
          path="/login"
          element={
            <>
              <header className="project-header">
                <h1>
                  Agentic AI for Maritime Freight Pricing and Route Optimization
                </h1>
                <p>
                  Intelligent routes. Optimized decisions. Smarter freight pricing.
                </p>
              </header>
              <Login />
            </>
          }
        />

        {/* Forgot Password */}
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        {/* OTP Verification */}
        <Route
          path="/verify-otp"
          element={<VerifyOTP />}
        />

        {/* Customer Dashboard */}
        <Route
          path="/user-dashboard"
          element={<UserDashboard />}
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin-dashboard"
          element={<AdminDashboard />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

