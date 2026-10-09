import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
import Register from "./pages/Register";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";
import ForgotPassword from "./pages/ForgotPassword";
import AdminLogin from "./pages/AdminLogin";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =====================================================
            FIRST PAGE - SELECT LOGIN TYPE
        ===================================================== */}

        <Route
          path="/"
          element={
            <>
              <Welcome />
            </>
          }
        />


        {/* =====================================================
            CUSTOMER REGISTRATION
        ===================================================== */}

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


        {/* =====================================================
            CUSTOMER LOGIN
        ===================================================== */}

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


        {/* =====================================================
            FORGOT PASSWORD
        ===================================================== */}

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />


        {/* =====================================================
            OTP VERIFICATION
        ===================================================== */}

        <Route
          path="/verify-otp"
          element={<VerifyOTP />}
        />


        {/* =====================================================
            ADMIN LOGIN
        ===================================================== */}

        <Route
          path="/admin-login"
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

              <AdminLogin />
            </>
          }
        />


        {/* =====================================================
            CUSTOMER DASHBOARD
        ===================================================== */}

        <Route
          path="/user-dashboard"
          element={<UserDashboard />}
        />


        {/* =====================================================
            ADMIN DASHBOARD
        ===================================================== */}

        <Route
          path="/admin-dashboard"
          element={<AdminDashboard />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;