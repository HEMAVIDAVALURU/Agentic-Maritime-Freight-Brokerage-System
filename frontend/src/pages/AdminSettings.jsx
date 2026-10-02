import "./AdminSettings.css";

function AdminSettings() {
  return (
    <div className="admin-page-content admin-settings-page">

      <section className="admin-section-card admin-settings-section">

        <div className="admin-section-header">

          <div>

            <h2>
              Admin Settings
            </h2>

            <p>
              Manage administrator settings.
            </p>

          </div>

        </div>

        <div className="admin-empty-state">

          <div className="admin-empty-icon">
            ⚙️
          </div>

          <h3>
            Settings
          </h3>

          <p>
            Additional administrator settings can be configured here.
          </p>

        </div>

      </section>

    </div>
  );
}

export default AdminSettings;