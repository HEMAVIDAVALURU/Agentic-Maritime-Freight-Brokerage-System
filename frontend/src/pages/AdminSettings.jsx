import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./AdminSettings.css";

const API_BASE = "/api";

function AdminSettings({ initialSection = "profile" }) {
  /* =========================================================
     SECTION
  ========================================================= */

  const [activeSection, setActiveSection] =
    useState(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  /* =========================================================
     MESSAGE
  ========================================================= */

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const messageTimerRef = useRef(null);

  const showMessage = useCallback((type, text) => {
    // Clear previous timer so messages do not disappear unexpectedly
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }

    setMessage({
      type,
      text,
    });

    messageTimerRef.current = setTimeout(() => {
      setMessage({
        type: "",
        text: "",
      });

      messageTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  /* =========================================================
     PROFILE STATE
  ========================================================= */

  const [profile, setProfile] = useState({
    name: "",
    mobile_number: "",
    email: "",
    gender: "",
  });

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileSaving, setProfileSaving] =
    useState(false);

  /* =========================================================
     NOTIFICATION STATE
  ========================================================= */

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    quotation_alerts: true,
    feedback_alerts: true,
  });

  const [notificationLoading, setNotificationLoading] =
    useState(false);

  const [notificationSaving, setNotificationSaving] =
    useState(false);

  /* =========================================================
     SECURITY STATE
  ========================================================= */

  const [emailForm, setEmailForm] = useState({
    current_password: "",
    new_email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [emailSaving, setEmailSaving] =
    useState(false);

  const [passwordSaving, setPasswordSaving] =
    useState(false);

  /* =========================================================
     RESPONSE HELPER
  ========================================================= */

  const readResponse = async (response) => {
    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();

    return {
      detail:
        text || "Server returned an unexpected response.",
    };
  };

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);

      const response = await fetch(
        `${API_BASE}/admin/settings/profile`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load profile."
        );
      }

      setProfile({
        name: data.name || "",
        mobile_number: data.mobile_number || "",
        email: data.email || "",
        gender: data.gender || "",
      });
    } catch (error) {
      console.error(
        "Load profile error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to load administrator profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }, [showMessage]);

  /* =========================================================
     LOAD NOTIFICATIONS
  ========================================================= */

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationLoading(true);

      const response = await fetch(
        `${API_BASE}/admin/settings/notifications`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load notification settings."
        );
      }

      setNotifications({
        email_notifications:
          Boolean(data.email_notifications),

        quotation_alerts:
          Boolean(data.quotation_alerts),

        feedback_alerts:
          Boolean(data.feedback_alerts),
      });
    } catch (error) {
      console.error(
        "Load notifications error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to load notification settings."
      );
    } finally {
      setNotificationLoading(false);
    }
  }, [showMessage]);

  /* =========================================================
     INITIAL DATA LOAD
  ========================================================= */

  useEffect(() => {
    if (activeSection === "profile") {
      loadProfile();
    }

    if (activeSection === "notifications") {
      loadNotifications();
    }

    if (activeSection === "security") {
      loadProfile();
    }
  }, [
    activeSection,
    loadProfile,
    loadNotifications,
  ]);

  /* =========================================================
     PROFILE INPUT
  ========================================================= */

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =========================================================
     UPDATE PROFILE
  ========================================================= */

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    try {
      setProfileSaving(true);

      const response = await fetch(
        `${API_BASE}/admin/settings/profile`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: profile.name.trim(),
            mobile_number:
              profile.mobile_number.trim(),
            gender: profile.gender.trim(),
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to update profile."
        );
      }

      setProfile({
        name: data.name || "",
        mobile_number:
          data.mobile_number || "",
        email: data.email || "",
        gender: data.gender || "",
      });

      showMessage(
        "success",
        data.message ||
          "Profile updated successfully."
      );
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to update profile."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  /* =========================================================
     NOTIFICATION MASTER TOGGLE
  ========================================================= */

  const handleEmailNotificationsToggle = (
    event
  ) => {
    const enabled = event.target.checked;

    setNotifications((previous) => ({
      ...previous,
      email_notifications: enabled,

      // Master OFF means child alerts OFF
      quotation_alerts: enabled
        ? previous.quotation_alerts
        : false,

      feedback_alerts: enabled
        ? previous.feedback_alerts
        : false,
    }));
  };

  /* =========================================================
     NOTIFICATION CHILD TOGGLE
  ========================================================= */

  const handleNotificationToggle = (
    field
  ) => {
    setNotifications((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  /* =========================================================
     UPDATE NOTIFICATIONS
  ========================================================= */

  const handleNotificationSubmit = async (
    event
  ) => {
    event.preventDefault();

    try {
      setNotificationSaving(true);

      const emailEnabled =
        notifications.email_notifications;

      const payload = {
        email_notifications: emailEnabled,

        quotation_alerts: emailEnabled
          ? notifications.quotation_alerts
          : false,

        feedback_alerts: emailEnabled
          ? notifications.feedback_alerts
          : false,
      };

      const response = await fetch(
        `${API_BASE}/admin/settings/notifications`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to update notification settings."
        );
      }

      setNotifications({
        email_notifications:
          Boolean(data.email_notifications),

        quotation_alerts:
          Boolean(data.quotation_alerts),

        feedback_alerts:
          Boolean(data.feedback_alerts),
      });

      showMessage(
        "success",
        data.message ||
          "Notification settings updated successfully."
      );
    } catch (error) {
      console.error(
        "Update notifications error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to update notification settings."
      );
    } finally {
      setNotificationSaving(false);
    }
  };

  /* =========================================================
     CHANGE EMAIL INPUT
  ========================================================= */

  const handleEmailChange = (event) => {
    const { name, value } = event.target;

    setEmailForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =========================================================
     CHANGE PASSWORD INPUT
  ========================================================= */

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =========================================================
     CHANGE ADMIN EMAIL
  ========================================================= */

  const handleChangeEmail = async (event) => {
    event.preventDefault();

    const currentPassword =
      emailForm.current_password.trim();

    const newEmail =
      emailForm.new_email.trim();

    if (!currentPassword) {
      showMessage(
        "error",
        "Please enter your current password."
      );
      return;
    }

    if (!newEmail) {
      showMessage(
        "error",
        "Please enter a new email address."
      );
      return;
    }

    try {
      setEmailSaving(true);

      const response = await fetch(
        `${API_BASE}/auth/admin/change-email`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_password:
              currentPassword,

            new_email: newEmail,
          }),
        }
      );

      const data = await readResponse(response);

      console.log(
        "Change email response:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to change email."
        );
      }

      // Clear form first
      setEmailForm({
        current_password: "",
        new_email: "",
      });

      // Reload profile so the new email appears
      await loadProfile();

      // Show success AFTER profile reload
      showMessage(
        "success",
        data.message ||
          "Admin email updated successfully."
      );
    } catch (error) {
      console.error(
        "Change email error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to change email."
      );
    } finally {
      setEmailSaving(false);
    }
  };

  /* =========================================================
     CHANGE ADMIN PASSWORD
  ========================================================= */

  const handleChangePassword = async (
    event
  ) => {
    event.preventDefault();

    const currentPassword =
      passwordForm.current_password;

    const newPassword =
      passwordForm.new_password;

    const confirmPassword =
      passwordForm.confirm_password;

    if (!currentPassword) {
      showMessage(
        "error",
        "Please enter your current password."
      );
      return;
    }

    if (!newPassword) {
      showMessage(
        "error",
        "Please enter a new password."
      );
      return;
    }

    if (newPassword.length < 6) {
      showMessage(
        "error",
        "New password must be at least 6 characters."
      );
      return;
    }

    if (!confirmPassword) {
      showMessage(
        "error",
        "Please confirm your new password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        "error",
        "New password and confirm password do not match."
      );
      return;
    }

    try {
      setPasswordSaving(true);

      const response = await fetch(
        `${API_BASE}/auth/admin/change-password`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_password:
              currentPassword,

            new_password:
              newPassword,
          }),
        }
      );

      const data = await readResponse(response);

      console.log(
        "Change password response:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to change password."
        );
      }

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      showMessage(
        "success",
        data.message ||
          "Admin password updated successfully."
      );
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      showMessage(
        "error",
        error.message ||
          "Unable to change password."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  /* =========================================================
     PROFILE SECTION
  ========================================================= */

  const renderProfile = () => {
    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h2>Profile</h2>

          <p>
            Manage your administrator profile
            information.
          </p>
        </div>

        <form
          className="settings-card"
          onSubmit={handleProfileSubmit}
        >
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
              <label htmlFor="admin-email">
                Email
              </label>

              <input
                id="admin-email"
                type="email"
                value={profile.email}
                disabled
              />

              <small>
                Email can be changed from Security.
              </small>
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

          <button
            type="submit"
            className="settings-primary-button"
            disabled={profileSaving}
          >
            {profileSaving
              ? "Saving..."
              : "Update Profile"}
          </button>
        </form>
      </div>
    );
  };

  /* =========================================================
     NOTIFICATIONS SECTION
  ========================================================= */

  const renderNotifications = () => {
    const childrenDisabled =
      !notifications.email_notifications;

    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h2>Notifications</h2>

          <p>
            Control administrator notification
            emails.
          </p>
        </div>

        <form
          className="settings-card"
          onSubmit={handleNotificationSubmit}
        >
          {/* MASTER */}
          <div className="settings-toggle-row">
            <div className="settings-toggle-content">
              <h3>Email Notifications</h3>

              <p>
                Enable or disable all administrator
                notification emails.
              </p>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={
                  notifications.email_notifications
                }
                onChange={
                  handleEmailNotificationsToggle
                }
              />

              <span className="settings-slider" />
            </label>
          </div>

          <div className="settings-divider" />

          {/* QUOTATION */}
          <div
            className={`settings-toggle-row ${
              childrenDisabled
                ? "settings-toggle-disabled"
                : ""
            }`}
          >
            <div className="settings-toggle-content">
              <h3>Quotation Alerts</h3>

              <p>
                Receive email notifications when a
                customer submits a quotation request.
              </p>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={
                  notifications.quotation_alerts
                }
                disabled={childrenDisabled}
                onChange={() =>
                  handleNotificationToggle(
                    "quotation_alerts"
                  )
                }
              />

              <span className="settings-slider" />
            </label>
          </div>

          <div className="settings-divider" />

          {/* FEEDBACK */}
          <div
            className={`settings-toggle-row ${
              childrenDisabled
                ? "settings-toggle-disabled"
                : ""
            }`}
          >
            <div className="settings-toggle-content">
              <h3>Feedback Alerts</h3>

              <p>
                Receive email notifications when a
                customer submits feedback.
              </p>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={
                  notifications.feedback_alerts
                }
                disabled={childrenDisabled}
                onChange={() =>
                  handleNotificationToggle(
                    "feedback_alerts"
                  )
                }
              />

              <span className="settings-slider" />
            </label>
          </div>

          <button
            type="submit"
            className="settings-primary-button"
            disabled={notificationSaving}
          >
            {notificationSaving
              ? "Saving..."
              : "Save Notification Settings"}
          </button>

          {notificationLoading && (
            <div className="settings-loading-text">
              Loading notification settings...
            </div>
          )}
        </form>
      </div>
    );
  };

  /* =========================================================
     SECURITY SECTION
  ========================================================= */

  const renderSecurity = () => {
    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h2>Security</h2>

          <p>
            Manage your administrator email and
            password securely.
          </p>
        </div>

        {/* CHANGE EMAIL */}
        <form
          className="settings-card"
          onSubmit={handleChangeEmail}
        >
          <div className="settings-card-title">
            <h3>Change Email</h3>

            <p>
              Your current password is required to
              change the administrator email address.
            </p>
          </div>

          <div className="settings-field">
            <label htmlFor="current-email-password">
              Current Password
            </label>

            <input
              id="current-email-password"
              name="current_password"
              type="password"
              value={
                emailForm.current_password
              }
              onChange={handleEmailChange}
              placeholder="Enter current password"
              autoComplete="current-password"
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
              placeholder="Enter new email address"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            className="settings-primary-button"
            disabled={emailSaving}
          >
            {emailSaving
              ? "Changing..."
              : "Change Email"}
          </button>
        </form>

        {/* CHANGE PASSWORD */}
        <form
          className="settings-card"
          onSubmit={handleChangePassword}
        >
          <div className="settings-card-title">
            <h3>Change Password</h3>

            <p>
              Enter your current password and choose
              a new password.
            </p>
          </div>

          <div className="settings-field">
            <label htmlFor="current-password">
              Current Password
            </label>

            <input
              id="current-password"
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
            <label htmlFor="new-password">
              New Password
            </label>

            <input
              id="new-password"
              name="new_password"
              type="password"
              value={
                passwordForm.new_password
              }
              onChange={handlePasswordChange}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div className="settings-field">
            <label htmlFor="confirm-password">
              Confirm New Password
            </label>

            <input
              id="confirm-password"
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

          <button
            type="submit"
            className="settings-primary-button"
            disabled={passwordSaving}
          >
            {passwordSaving
              ? "Changing..."
              : "Change Password"}
          </button>
        </form>
      </div>
    );
  };

  /* =========================================================
     ABOUT SECTION
  ========================================================= */

  const renderAbout = () => {
    return (
      <div className="settings-section">
        <div className="settings-section-header">
          <h2>About</h2>

          <p>
            Information about the maritime freight
            brokerage system.
          </p>
        </div>

        <div className="settings-card settings-about-card">
          <div className="settings-about-row">
            <span>System Name</span>

            <strong>
              Agentic Maritime Freight Brokerage
              System
            </strong>
          </div>

          <div className="settings-divider" />

          <div className="settings-about-row">
            <span>Version</span>

            <strong>1.0.0</strong>
          </div>

          <div className="settings-divider" />

          <div className="settings-about-row">
            <span>Help</span>

            <strong>
              Contact system administrator for
              assistance.
            </strong>
          </div>

          <div className="settings-divider" />

          <div className="settings-about-row">
            <span>Terms & Conditions</span>

            <strong>
              Use of this system is subject to the
              organization's policies and terms.
            </strong>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     MAIN RENDER
  ========================================================= */

  return (
    <div className="admin-settings-container">
      {/* =====================================================
          GLOBAL MESSAGE
      ===================================================== */}

      {message.text && (
        <div
          className={`settings-message ${
            message.type === "success"
              ? "settings-message-success"
              : "settings-message-error"
          }`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      {/* =====================================================
          CONTENT
      ===================================================== */}

      {activeSection === "profile" &&
        renderProfile()}

      {activeSection === "notifications" &&
        renderNotifications()}

      {activeSection === "security" &&
        renderSecurity()}

      {activeSection === "about" &&
        renderAbout()}
    </div>
  );
}

export default AdminSettings;