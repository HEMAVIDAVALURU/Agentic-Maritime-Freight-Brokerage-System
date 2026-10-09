import React, { useEffect, useState } from "react";
import "./AdminSettings.css";

const API_BASE = "/api";

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getErrorMessage = async (response) => {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // Ignore JSON parsing errors.
  }

  return "Something went wrong. Please try again.";
};

const AdminSettings = ({ initialSection = "profile" }) => {
  const [activeSection, setActiveSection] =
    useState(initialSection);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    mobile_number: "",
    city: "",
    gender: "",
  });

  const [emailForm, setEmailForm] = useState({
    current_email: "",
    new_email: "",
    confirm_new_email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    quotation_alerts: true,
    feedback_alerts: true,
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] =
    useState(false);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const showMessage = (type, text) => {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 4500);
  };

  const loadProfile = async () => {
    const response = await fetch(
      `${API_BASE}/admin/settings/profile`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const data = await response.json();

    const loadedProfile = {
      name: data.name || "",
      email: data.email || "",
      mobile_number: data.mobile_number || "",
      city: data.city || "",
      gender: data.gender || "",
    };

    setProfile(loadedProfile);

    setEmailForm((previous) => ({
      ...previous,
      current_email: loadedProfile.email,
    }));
  };

  const loadNotifications = async () => {
    const response = await fetch(
      `${API_BASE}/admin/settings/notifications`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const data = await response.json();

    setNotifications({
      email_notifications: Boolean(
        data.email_notifications
      ),
      quotation_alerts: Boolean(data.quotation_alerts),
      feedback_alerts: Boolean(data.feedback_alerts),
    });
  };

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      try {
        await Promise.all([
          loadProfile(),
          loadNotifications(),
        ]);
      } catch (error) {
        showMessage(
          "error",
          error.message || "Unable to load settings."
        );
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEmailChange = (event) => {
    const { name, value } = event.target;

    setEmailForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleNotificationToggle = (name) => {
    setNotifications((previous) => {
      const next = {
        ...previous,
        [name]: !previous[name],
      };

      if (
        name === "email_notifications" &&
        !next.email_notifications
      ) {
        next.quotation_alerts = false;
        next.feedback_alerts = false;
      }

      return next;
    });
  };

  // ---------------- PROFILE ----------------

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    setSavingProfile(true);

    try {
      const response = await fetch(
        `${API_BASE}/admin/settings/profile`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            name: profile.name.trim(),
            mobile_number: profile.mobile_number.trim(),
            city: profile.city.trim(),
            gender: profile.gender.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setProfile((previous) => ({
        ...previous,
        name: data.name ?? previous.name,
        mobile_number:
          data.mobile_number ?? previous.mobile_number,
        city: data.city ?? previous.city,
        gender: data.gender ?? previous.gender,
        email: data.email ?? previous.email,
      }));

      showMessage(
        "success",
        data.message || "Profile updated successfully."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to update profile."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------------- EMAIL ----------------

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    const currentEmail =
      emailForm.current_email.trim().toLowerCase();

    const newEmail =
      emailForm.new_email.trim().toLowerCase();

    const confirmEmail =
      emailForm.confirm_new_email.trim().toLowerCase();

    if (!currentEmail || !newEmail || !confirmEmail) {
      showMessage(
        "error",
        "Please complete all email fields."
      );
      return;
    }

    if (newEmail !== confirmEmail) {
      showMessage(
        "error",
        "New email and confirmation email do not match."
      );
      return;
    }

    if (newEmail === currentEmail) {
      showMessage(
        "error",
        "New email must be different from the current email."
      );
      return;
    }

    setSavingEmail(true);

    try {
      const response = await fetch(
        `${API_BASE}/admin/settings/email`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            current_email: currentEmail,
            new_email: newEmail,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      const updatedEmail = data.email || newEmail;

      setProfile((previous) => ({
        ...previous,
        email: updatedEmail,
      }));

      setEmailForm({
        current_email: updatedEmail,
        new_email: "",
        confirm_new_email: "",
      });

      showMessage(
        "success",
        data.message ||
          "Email updated successfully. A confirmation email has been sent to the new address."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to update email."
      );
    } finally {
      setSavingEmail(false);
    }
  };

  // ---------------- PASSWORD ----------------

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (
      !passwordForm.current_password ||
      !passwordForm.new_password ||
      !passwordForm.confirm_password
    ) {
      showMessage(
        "error",
        "Please complete all password fields."
      );
      return;
    }

    if (
      passwordForm.new_password !==
      passwordForm.confirm_password
    ) {
      showMessage(
        "error",
        "New password and confirmation password do not match."
      );
      return;
    }

    if (
      passwordForm.current_password ===
      passwordForm.new_password
    ) {
      showMessage(
        "error",
        "New password must be different from the current password."
      );
      return;
    }

    if (passwordForm.new_password.length < 8) {
      showMessage(
        "error",
        "New password must contain at least 8 characters."
      );
      return;
    }

    setSavingPassword(true);

    try {
      const response = await fetch(
        `${API_BASE}/auth/admin/change-password`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({
            current_password:
              passwordForm.current_password,
            new_password: passwordForm.new_password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      showMessage(
        "success",
        data.message ||
          "Password updated successfully. A confirmation email has been sent to your email address."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message || "Unable to update password."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // ---------------- NOTIFICATIONS ----------------

  const handleNotificationsSubmit = async (event) => {
    event.preventDefault();

    setSavingNotifications(true);

    try {
      const response = await fetch(
        `${API_BASE}/admin/settings/notifications`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(notifications),
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      setNotifications({
        email_notifications: Boolean(
          data.email_notifications
        ),
        quotation_alerts: Boolean(
          data.quotation_alerts
        ),
        feedback_alerts: Boolean(
          data.feedback_alerts
        ),
      });

      showMessage(
        "success",
        data.message ||
          "Notification settings updated successfully."
      );
    } catch (error) {
      showMessage(
        "error",
        error.message ||
          "Unable to update notification settings."
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-settings-container">
        <div className="settings-loading-text">
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-settings-container">

      {/* HEADER */}
      <div className="admin-settings-header">
        <div>
          <span className="settings-eyebrow">
            SYSTEM SETTINGS
          </span>

          <h1>Settings</h1>

          <p>
            Manage your administrator account and system
            preferences.
          </p>
        </div>
      </div>

      {/* MESSAGE */}
      {message.text && (
        <div
          className={`settings-message ${message.type}`}
        >
          <span className="settings-message-icon">
            {message.type === "success" ? "✓" : "!"}
          </span>

          <span>{message.text}</span>
        </div>
      )}

      {/* CONTENT */}
      <main className="settings-content">

        {/* ================= PROFILE ================= */}

        {activeSection === "profile" && (
          <section className="settings-section">

            <div className="settings-section-header">
              <div>
                <span className="settings-eyebrow">
                  ADMIN ACCOUNT
                </span>

                <h2>Profile</h2>

                <p>
                  Manage your administrator profile
                  information.
                </p>
              </div>
            </div>

            <form
              className="settings-card"
              onSubmit={handleProfileSubmit}
            >

              <div className="settings-card-heading">

                <div className="settings-card-icon">
                  ◉
                </div>

                <div>
                  <h3>
                    Administrator Profile
                  </h3>

                  <p>
                    Update the personal information
                    associated with your admin account.
                  </p>
                </div>

              </div>

              <div className="settings-divider" />

              <div className="settings-form-grid">

                <div className="settings-field">

                  <label htmlFor="admin-name">
                    Name
                  </label>

                  <input
                    id="admin-name"
                    name="name"
                    type="text"
                    value={profile.name}
                    onChange={handleProfileChange}
                    placeholder="Enter your name"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-email">
                    Email
                  </label>

                  <input
                    id="admin-email"
                    type="email"
                    value={profile.email}
                    readOnly
                    className="settings-readonly-input"
                  />

                  <span className="settings-field-note">
                    Change this email from Security
                    settings.
                  </span>

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-mobile">
                    Mobile Number
                  </label>

                  <input
                    id="admin-mobile"
                    name="mobile_number"
                    type="tel"
                    value={profile.mobile_number}
                    onChange={handleProfileChange}
                    placeholder="Enter mobile number"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-city">
                    City
                  </label>

                  <input
                    id="admin-city"
                    name="city"
                    type="text"
                    value={profile.city}
                    onChange={handleProfileChange}
                    placeholder="Enter city"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-gender">
                    Gender
                  </label>

                  <select
                    id="admin-gender"
                    name="gender"
                    value={profile.gender}
                    onChange={handleProfileChange}
                  >
                    <option value="">
                      Select gender
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>

                    <option value="Other">
                      Other
                    </option>

                    <option value="Prefer not to say">
                      Prefer not to say
                    </option>
                  </select>

                </div>

              </div>

              <div className="settings-card-actions">

                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={savingProfile}
                >
                  {savingProfile
                    ? "Saving..."
                    : "Save Profile"}
                </button>

              </div>

            </form>

          </section>
        )}

        {/* ================= NOTIFICATIONS ================= */}

        {activeSection === "notifications" && (
          <section className="settings-section">

            <div className="settings-section-header">
              <div>
                <span className="settings-eyebrow">
                  SYSTEM PREFERENCES
                </span>

                <h2>Notifications</h2>

                <p>
                  Choose which administrator
                  notifications you want to receive.
                </p>
              </div>
            </div>

            <form
              className="settings-card"
              onSubmit={handleNotificationsSubmit}
            >

              <div className="settings-card-heading">

                <div className="settings-card-icon">
                  ◌
                </div>

                <div>
                  <h3>
                    Notification Preferences
                  </h3>

                  <p>
                    Control email notifications for
                    important system activity.
                  </p>
                </div>

              </div>

              <div className="settings-divider" />

              <div className="settings-toggle-row">

                <div>
                  <h4>
                    Email Notifications
                  </h4>

                  <p>
                    Receive administrator
                    notifications by email.
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-switch ${
                    notifications.email_notifications
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    handleNotificationToggle(
                      "email_notifications"
                    )
                  }
                >
                  <span />
                </button>

              </div>

              <div className="settings-toggle-row">

                <div>
                  <h4>
                    Quotation Alerts
                  </h4>

                  <p>
                    Receive notifications related to
                    quotation activity.
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-switch ${
                    notifications.quotation_alerts
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    handleNotificationToggle(
                      "quotation_alerts"
                    )
                  }
                  disabled={
                    !notifications.email_notifications
                  }
                >
                  <span />
                </button>

              </div>

              <div className="settings-toggle-row">

                <div>
                  <h4>
                    Feedback Alerts
                  </h4>

                  <p>
                    Receive notifications when users
                    submit feedback.
                  </p>
                </div>

                <button
                  type="button"
                  className={`settings-switch ${
                    notifications.feedback_alerts
                      ? "on"
                      : ""
                  }`}
                  onClick={() =>
                    handleNotificationToggle(
                      "feedback_alerts"
                    )
                  }
                  disabled={
                    !notifications.email_notifications
                  }
                >
                  <span />
                </button>

              </div>

              <div className="settings-card-actions">

                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={savingNotifications}
                >
                  {savingNotifications
                    ? "Saving..."
                    : "Save Preferences"}
                </button>

              </div>

            </form>

          </section>
        )}

        {/* ================= SECURITY ================= */}

        {activeSection === "security" && (
          <section className="settings-section">

            <div className="settings-section-header">
              <div>
                <span className="settings-eyebrow">
                  ACCOUNT SECURITY
                </span>

                <h2>Security</h2>

                <p>
                  Manage your administrator email
                  address and password.
                </p>
              </div>
            </div>

            {/* CHANGE EMAIL */}

            <form
              className="settings-card"
              onSubmit={handleEmailSubmit}
            >

              <div className="settings-card-heading">

                <div className="settings-card-icon">
                  ✉
                </div>

                <div>
                  <h3>
                    Change Email
                  </h3>

                  <p>
                    Update the email address used for
                    your administrator account.
                  </p>
                </div>

              </div>

              <div className="settings-divider" />

              <div className="settings-form-grid">

                <div className="settings-field settings-field-full">

                  <label htmlFor="current-admin-email">
                    Current Email
                  </label>

                  <input
                    id="current-admin-email"
                    name="current_email"
                    type="email"
                    value={emailForm.current_email}
                    readOnly
                    className="settings-readonly-input"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="new-admin-email">
                    New Email
                  </label>

                  <input
                    id="new-admin-email"
                    name="new_email"
                    type="email"
                    value={emailForm.new_email}
                    onChange={handleEmailChange}
                    placeholder="Enter new email"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="confirm-admin-email">
                    Confirm New Email
                  </label>

                  <input
                    id="confirm-admin-email"
                    name="confirm_new_email"
                    type="email"
                    value={
                      emailForm.confirm_new_email
                    }
                    onChange={handleEmailChange}
                    placeholder="Confirm new email"
                  />

                </div>

              </div>

              <div className="settings-security-note">

                <span>i</span>

                <p>
                  No current password is required here.
                  After the email is changed, a
                  confirmation message will be sent to
                  the new email address.
                </p>

              </div>

              <div className="settings-card-actions">

                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={savingEmail}
                >
                  {savingEmail
                    ? "Updating..."
                    : "Update Email"}
                </button>

              </div>

            </form>

            {/* CHANGE PASSWORD */}

            <form
              className="settings-card"
              onSubmit={handlePasswordSubmit}
            >

              <div className="settings-card-heading">

                <div className="settings-card-icon">
                  ◆
                </div>

                <div>
                  <h3>
                    Change Password
                  </h3>

                  <p>
                    Change the password used to access
                    the administrator account.
                  </p>
                </div>

              </div>

              <div className="settings-divider" />

              <div className="settings-form-grid">

                <div className="settings-field settings-field-full">

                  <label htmlFor="admin-current-password">
                    Current Password
                  </label>

                  <input
                    id="admin-current-password"
                    name="current_password"
                    type="password"
                    value={
                      passwordForm.current_password
                    }
                    onChange={handlePasswordChange}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-new-password">
                    New Password
                  </label>

                  <input
                    id="admin-new-password"
                    name="new_password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />

                </div>

                <div className="settings-field">

                  <label htmlFor="admin-confirm-password">
                    Confirm New Password
                  </label>

                  <input
                    id="admin-confirm-password"
                    name="confirm_password"
                    type="password"
                    value={
                      passwordForm.confirm_password
                    }
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />

                </div>

              </div>

              <div className="settings-security-note">

                <span>i</span>

                <p>
                  Your new password is never included
                  in the confirmation email.
                </p>

              </div>

              <div className="settings-card-actions">

                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={savingPassword}
                >
                  {savingPassword
                    ? "Updating..."
                    : "Update Password"}
                </button>

              </div>

            </form>

          </section>
        )}

        {/* ================= ABOUT ================= */}

        {activeSection === "about" && (
          <section className="settings-section settings-about-section">

            <div className="settings-section-header">
              <div>

                <span className="settings-eyebrow">
                  SYSTEM INFORMATION
                </span>

                <h2>About</h2>

                <p>
                  Information about the maritime freight
                  administration system.
                </p>

              </div>
            </div>

            {/* HERO */}

            <div className="settings-about-card settings-about-hero">

              <div className="settings-about-anchor">
                ⚓
              </div>

              <div className="settings-about-hero-content">

                <h3>
                  Agentic AI for Maritime Freight
                </h3>

                <p>
                  Maritime Freight Brokerage &
                  Administration System
                </p>

                <div className="settings-about-line" />

                <p className="settings-about-description">
                  The platform supports maritime freight
                  route analysis, quotation management,
                  pricing intelligence, weather
                  intelligence and customs validation
                  through an integrated administrative
                  dashboard.
                </p>

                <p className="settings-about-description">
                  Administrators can manage users,
                  quotations, feedback and system
                  information while monitoring the
                  operational capabilities available
                  across the platform.
                </p>

              </div>

            </div>

            {/* SYSTEM INFORMATION */}

            <div className="settings-about-card">

              <div className="settings-about-card-header">

                <h3>
                  System Information
                </h3>

                <p>
                  Current administrator application
                  information.
                </p>

              </div>

              <div className="settings-about-grid">

                <div className="settings-about-info">
                  <span>APPLICATION</span>
                  <strong>
                    Agentic Maritime Brokerage
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>SYSTEM VERSION</span>
                  <strong>
                    Version 1.0.0
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>USER MANAGEMENT</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>QUOTATION MANAGEMENT</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>ROUTE INTELLIGENCE</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>PRICING INTELLIGENCE</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>WEATHER INTELLIGENCE</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>CUSTOMS VALIDATION</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

                <div className="settings-about-info">
                  <span>FEEDBACK MANAGEMENT</span>
                  <strong>
                    Enabled
                  </strong>
                </div>

              </div>

            </div>

            {/* ADMIN RESPONSIBILITIES */}

            <div className="settings-about-card">

              <div className="settings-about-card-header">

                <h3>
                  Admin Responsibilities
                </h3>

                <p>
                  Key administrative functions available
                  in the system.
                </p>

              </div>

              <div className="settings-about-steps">

                <div className="settings-about-step">

                  <span>1</span>

                  <div>
                    <strong>
                      User Management
                    </strong>

                    <p>
                      Manage registered users and monitor
                      account-related information.
                    </p>
                  </div>

                </div>

                <div className="settings-about-step">

                  <span>2</span>

                  <div>
                    <strong>
                      Quotation Management
                    </strong>

                    <p>
                      Review quotation requests and
                      manage quotation-related
                      operations.
                    </p>
                  </div>

                </div>

                <div className="settings-about-step">

                  <span>3</span>

                  <div>
                    <strong>
                      Feedback Management
                    </strong>

                    <p>
                      Review user feedback and provide
                      appropriate administrative
                      responses.
                    </p>
                  </div>

                </div>

                <div className="settings-about-step">

                  <span>4</span>

                  <div>
                    <strong>
                      System Monitoring
                    </strong>

                    <p>
                      Monitor route, pricing, weather
                      and customs information used by
                      the platform.
                    </p>
                  </div>

                </div>

              </div>

            </div>

            {/* TERMS */}

            <div className="settings-about-card">

              <div className="settings-about-card-header">

                <h3>
                  Terms & Administrative Information
                </h3>

                <p>
                  Important information about using the
                  admin platform.
                </p>

              </div>

              <p className="settings-about-paragraph">
                The information provided by this system
                is intended to support maritime freight
                planning, quotation management and
                administrative decision-making.
                Administrators should verify operational,
                commercial and regulatory information
                before taking final business actions.
              </p>

              <p className="settings-about-paragraph">
                Route recommendations, pricing
                information, weather information and
                customs validation are generated from the
                data available to the system and may
                change when the underlying information is
                updated.
              </p>

            </div>

            {/* HELP */}

            <div className="settings-about-card">

              <div className="settings-about-card-header">

                <h3>
                  Help & Support
                </h3>

                <p>
                  Key areas for managing the maritime
                  freight platform.
                </p>

              </div>

              <div className="settings-about-help-list">

                <div className="settings-about-help-item">

                  <span>1</span>

                  <div>
                    <strong>
                      User Management
                    </strong>

                    <p>
                      Manage user accounts and review
                      account information.
                    </p>
                  </div>

                </div>

                <div className="settings-about-help-item">

                  <span>2</span>

                  <div>
                    <strong>
                      Quotation Review
                    </strong>

                    <p>
                      Review quotation requests and
                      manage quotation decisions.
                    </p>
                  </div>

                </div>

                <div className="settings-about-help-item">

                  <span>3</span>

                  <div>
                    <strong>
                      Feedback Management
                    </strong>

                    <p>
                      Review submitted feedback and
                      respond when required.
                    </p>
                  </div>

                </div>

                <div className="settings-about-help-item">

                  <span>4</span>

                  <div>
                    <strong>
                      Account & Security
                    </strong>

                    <p>
                      Use Profile and Security settings
                      to manage your administrator
                      account.
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </section>
        )}

      </main>
    </div>
  );
};

export default AdminSettings;