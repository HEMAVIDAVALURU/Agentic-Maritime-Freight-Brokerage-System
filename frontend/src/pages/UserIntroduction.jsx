import React, { useState } from "react";
import "./UserIntroduction.css";

const UserIntroduction = ({ userName, onNavigate }) => {
  const [openFaq, setOpenFaq] = useState(0);

  const displayName = userName?.trim()?.split(" ")[0] || "there";

  const goTo = (page) => {
    if (typeof onNavigate === "function") onNavigate(page);
  };

  
const processes = [
  {
    number: "01",
    title: "Prepare Your Shipment Details",
    text: "Enter origin and destination ports, cargo-ready date, cargo dimensions, weight, and other shipment details requested by the application.",
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=85",
    alt: "Cargo boxes in a shipping warehouse",
  },
  {
    number: "02",
    title: "Compare Routes and Freight Options",
    text: "Review the route information, transit details, and freight prices returned by the application. Availability depends on the data and features connected to your project.",
    image:
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1000&q=85",
    alt: "Shipping containers at a maritime port",
  },
  {
    number: "03",
    title: "Review Your Freight Quotation",
    text: "Check the freight amount, included services, possible additional charges, estimated transit time, exclusions, and quotation validity before making a decision.",
    image:
      "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=1000&q=85",
    alt: "Cargo containers being transported",
  },
  {
    number: "04",
    title: "Complete Payment and Verification",
    text: "Follow the available payment process, submit the required payment details, and check payment verification progress and status in the Payments section.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1000&q=85",
    alt: "Payment being completed at a counter",
  },
  {
    number: "05",
    title: "Track Your Shipment",
    text: "Open My Shipments to review shipment status, origin and destination details, and available tracking updates. Tracking information depends on the data connected to the application.",
    image:
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1000&q=85",
    alt: "Freight logistics and transportation",
  },
  {
    number: "06",
    title: "Save and Manage Your Shipment",
    text: "Revisit saved quotations in My Quotations and review shipment details in My Shipments to keep track of your freight workflow.",
    image:
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1000&q=85",
    alt: "Shipping containers at a maritime port",
  },
];

  const resources = [
    {
      icon: "📘",
      title: "International Trade",
      text: "Explore official information about international trade and exporting.",
      url: "https://www.trade.gov/",
      label: "Explore Trade Resources",
    },
    {
      icon: "⚖️",
      title: "Incoterms Resources",
      text: "Learn how shipping responsibilities, costs, and risks are allocated.",
      url: "https://iccwbo.org/business-solutions/incoterms-rules/",
      label: "Explore Incoterms",
    },
    {
      icon: "🌐",
      title: "World Trade Information",
      text: "Read about international trade and global trade policies.",
      url: "https://www.wto.org/",
      label: "Explore World Trade",
    },
  ];

 const faqs = [
  {
    q: "What is a Freight Quotation?",
    a: "A freight quotation is an estimated cost for transporting cargo from one location to another. It helps users understand the expected shipping cost before proceeding with a shipment.",
  },
  {
    q: "What are the benefits of using this platform?",
    a: "This platform helps users search shipping routes, compare freight prices, review route details, and submit quotation requests from one place.",
  },
  {
    q: "How can I search for a freight route?",
    a: "Open New Route Search, enter your origin, destination, and required cargo or container details, and submit the search to view the available route options.",
  },
  {
    q: "How can I understand freight pricing?",
    a: "After searching for a route, review the estimated price and other route details displayed in the results. The price depends on the information and pricing factors used by the system.",
  },
  {
    q: "How is the best route selected?",
    a: "Compare the available routes using their displayed scores, estimated prices, transit details, and other route information. Consider the system's best-route recommendation when choosing a route.",
  },
  {
    q: "How can I submit a quotation request?",
    a: "Open New Route Search, enter your shipment details, review the available routes, select a suitable option, and follow the quotation request steps shown in the application.",
  },
  {
    q: "Where can I view my quotations?",
    a: "Open My Quotations in your dashboard to view your submitted quotation requests and check their current status.",
  },
  {
    q: "How can I check whether my quotation is approved?",
    a: "Go to My Quotations and check the status displayed for your request. An approved quotation should be marked with an Approved status.",
  },
  {
    q: "Where can I track my shipments?",
    a: "Open My Shipments in your dashboard to view your shipments and check the shipment status or tracking information available in the application.",
  },
  {
    q: "Where can I check payment details?",
    a: "Open Payments in your dashboard to view the payment information and status available for your account.",
  },
  {
    q: "How can I check weather information for a route?",
    a: "Search for your required route and review the weather information displayed in the route results, if this information is available for that route.",
  },
  {
    q: "How can I submit feedback?",
    a: "Open Feedback in your dashboard, enter your comments or suggestions, and submit them using the available form.",
  },
];

  return (
    <div className="user-introduction">
      <section className="intro-hero">
        <div className="intro-hero-content">
          <span className="intro-eyebrow">
            AGENTIC AI · MARITIME LOGISTICS
          </span>

          <h1>
            Welcome , <span>{displayName}.</span>
          </h1>

          <h2 className="intro-hero-tagline">
            Your Smarter Maritime Freight Journey Starts Here.
          </h2>

          <p className="intro-hero-description">
            Explore maritime routes, understand freight pricing, and manage
            shipping quotations in one intelligent workspace. Get started
            with your maritime freight workflow.
          </p>

          <div className="intro-hero-actions">
            <button
              type="button"
              className="intro-btn intro-btn-primary"
              onClick={() => goTo("new-route-search")}
            >
              Explore Routes <span>→</span>
            </button>

            <button
              type="button"
              className="intro-btn intro-btn-secondary"
              onClick={() => goTo("saved-quotations")}
            >
              My Quotations
            </button>
          </div>

          <div className="intro-hero-note">
            <span>✦</span> Route Discovery · Freight Insights · Quotations
          </div>
        </div>

        <div className="intro-hero-visual">
          <img
            src="https://images.unsplash.com/photo-1635690926948-06e5d7af93bb?auto=format&fit=crop&w=1200&q=85"
            alt="Cargo ship transporting containers across the ocean"
          />
          <div className="intro-image-overlay">
            <span>MARITIME FREIGHT WORKSPACE</span>
            <strong>Navigate global trade with confidence.</strong>
          </div>
        </div>
      </section>

      <section className="intro-section intro-process-section">
        <div className="intro-section-heading">
          <span className="intro-section-label">THE PROCESS</span>
          <h2>How to Use Maritime Freight Search</h2>
          <p>
            Follow these four steps, from entering shipment details to
            reviewing and managing your freight quotation.
          </p>
        </div>

        <div className="intro-process-list">
          {processes.map((item, index) => (
            <article
              className={`intro-process-row ${
                index % 2 === 1 ? "intro-process-reverse" : ""
              }`}
              key={item.number}
            >
              <div className="intro-process-image">
                <img src={item.image} alt={item.alt} loading="lazy" />
                <span className="intro-process-image-number">
                  {item.number}
                </span>
              </div>

              <div className="intro-process-content">
                <span className="intro-process-kicker">
                  STEP {item.number}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>

                {index === 0 && (
                  <button
                    type="button"
                    className="intro-text-link"
                    onClick={() => goTo("new-route-search")}
                  >
                    Enter Shipment Details →
                  </button>
                )}

                {index === 3 && (
                  <button
                    type="button"
                    className="intro-text-link"
                    onClick={() => goTo("saved-quotations")}
                  >
                    Open My Quotations →
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="intro-cost-section">
        <div className="intro-section-heading">
          <span className="intro-section-label">FREIGHT KNOWLEDGE</span>
          <h2>What Affects Ocean Freight Costs?</h2>
          <p>
            Compare the key cost factors when reviewing maritime routes
            and freight quotations. Actual charges depend on the shipment,
            provider, and information available to the application.
          </p>
        </div>

        <div className="intro-cost-table-wrap">
          <table className="intro-cost-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>What to Compare</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Route and Departure</td>
                <td>
                  Origin and destination ports, available services,
                  connections, and sailing date.
                </td>
              </tr>
              <tr>
                <td>Freight Price</td>
                <td>
                  Quoted ocean-freight amount, currency, pricing basis,
                  and the services included in the price.
                </td>
              </tr>
              <tr>
                <td>Cargo Details</td>
                <td>
                  Cargo type, dimensions, gross weight, packaging,
                  and handling requirements.
                </td>
              </tr>
              <tr>
                <td>Weather and Route Conditions</td>
                <td>
                  Severe weather, port disruption, and route changes
                  may affect availability, transit time, and related costs.
                  Live conditions require a connected data source.
                </td>
              </tr>
              <tr>
                <td>Additional Charges</td>
                <td>
                  Origin and destination handling, terminal fees, fuel
                  surcharges, insurance, taxes, and excluded services.
                </td>
              </tr>
              <tr>
                <td>Customs and Documents</td>
                <td>
                  Customs clearance requirements, applicable duties or
                  taxes, and documents required for the cargo and destination.
                </td>
              </tr>
              <tr>
                <td>Quotation Conditions</td>
                <td>
                  Quote validity, included services, estimated transit time,
                  availability, and conditions that could change the final price.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="intro-table-note">
          Tip: Compare quotations using the same shipment details,
          inclusions, and delivery requirements—not just the ocean-freight
          amount.
        </p>
      </section>

      <section className="intro-section">
        <div className="intro-section-heading">
          <span className="intro-section-label">YOUR WORKSPACE</span>
          <h2>Explore Your Dashboard</h2>
          <p>Choose a dashboard section to continue your work.</p>
        </div>

        <div className="intro-features-grid">
          <article className="intro-feature-card">
            <div className="intro-feature-icon">🧭</div>
            <h3>New Route Search</h3>
            <p>
              Enter shipment details and explore available route information.
            </p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("new-route-search")}
            >
              Search Routes →
            </button>
          </article>

          <article className="intro-feature-card">
            <div className="intro-feature-icon">📄</div>
            <h3>My Quotations</h3>
            <p>Revisit quotations saved in your account.</p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("saved-quotations")}
            >
              View Quotations →
            </button>
          </article>

          <article className="intro-feature-card">
            <div className="intro-feature-icon">📊</div>
            <h3>Activity Dashboard</h3>
            <p>Review activity information available in your workspace.</p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("activity")}
            >
              View Activity →
            </button>
          </article>

          
          {/* MY SHIPMENTS */}
          <article className="intro-feature-card">
            <div className="intro-feature-icon">🚢</div>
            <h3>My Shipments</h3>
            <p>
              View your shipments, check shipment status, review origin and
              destination details, and access available tracking information.
            </p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("my-shipments")}
            >
              Track Shipments →
            </button>
          </article>

          {/* PAYMENTS */}
          <article className="intro-feature-card">
            <div className="intro-feature-icon">💳</div>
            <h3>Payments</h3>
            <p>
              Submit payment details through the available payment workflow,
              review verification progress, and check your payment status.
            </p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("payments")}
            >
              View Payments →
            </button>
          </article>

          <article className="intro-feature-card">
            <div className="intro-feature-icon">💬</div>
            <h3>Feedback</h3>
            <p>Share your suggestions and experience with the application.</p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("feedback")}
            >
              Give Feedback →
            </button>
          </article>

          <article className="intro-feature-card">
            <div className="intro-feature-icon">⚙️</div>
            <h3>Settings</h3>
            <p>Access account settings supported by your dashboard.</p>
            <button
              type="button"
              className="intro-feature-link"
              onClick={() => goTo("settings-profile")}
            >
              Open Settings →
            </button>
          </article>
        </div>
      </section>

      <section className="intro-section intro-resources-section">
        <div className="intro-section-heading">
          <span className="intro-section-label">LEARN AND EXPLORE</span>
          <h2>Freight Resources</h2>
          <p>
            These external websites provide background information about
            international trade and shipping terms. They are not live data
            feeds from this application.
          </p>
        </div>

        <div className="intro-resources-grid">
          {resources.map((resource) => (
            <article className="intro-resource-card" key={resource.title}>
              <span className="intro-resource-icon">{resource.icon}</span>
              <h3>{resource.title}</h3>
              <p>{resource.text}</p>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {resource.label} ↗
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="intro-section intro-faq-section">
        <div className="intro-section-heading intro-faq-heading">
          <span className="intro-section-label">HELP CENTER</span>
          <h2>Frequently Asked Questions</h2>
          <p>
            Answers to common maritime freight and dashboard questions.
          </p>
        </div>

        <div className="intro-faq-list">
          {faqs.map((faq, index) => (
            <article
              className={`intro-faq-item ${
                openFaq === index ? "is-open" : ""
              }`}
              key={faq.q}
            >
              <button
                type="button"
                className="intro-faq-question"
                aria-expanded={openFaq === index}
                onClick={() =>
                  setOpenFaq(openFaq === index ? -1 : index)
                }
              >
                <span>{faq.q}</span>
                <span className="intro-faq-toggle">
                  {openFaq === index ? "−" : "+"}
                </span>
              </button>

              {openFaq === index && (
                <div className="intro-faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* CONNECT WITH US */}
      <section className="intro-contact-section" id="contact-us">
        <div className="intro-contact-info">
          <span className="intro-section-label">STAY CONNECTED</span>
          <h2>Connect With Us</h2>
          <p>
            Have questions or want to learn more about Maritime Freight
            Quotation? Contact us or follow our project updates on social media.
          </p>

          <div className="intro-contact-item">
            <span>✉</span>
            <div>
              <small>Email</small>
              <a href="mailto:maritimefreightquotation@gmail.com">
                maritimefreightquotation@gmail.com
              </a>
            </div>
          </div>

          <div className="intro-contact-item">
            <span>☎</span>
            <div>
              <small>Phone</small>
              <strong>Phone number to be updated</strong>
            </div>
          </div>

          <div className="intro-contact-item">
            <span>◷</span>
            <div>
              <small>Working Hours</small>
              <strong>Working hours to be updated</strong>
            </div>
          </div>
        </div>

        <div className="intro-follow-section">
          <div>
            <span className="intro-section-label">FOLLOW OUR JOURNEY</span>
            <h2>Follow Us</h2>
            <p>
              Explore our project and stay connected through these platforms.
            </p>
          </div>

          <div className="intro-social-links">
            <a
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>in</span> LinkedIn ↗
            </a>

            <a
              href="https://www.youtube.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>▶</span> YouTube ↗
            </a>

            <a
              href="https://github.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>⌘</span> GitHub ↗
            </a>
          </div>

          <p className="intro-contact-disclaimer">
            Replace these platform links with your official project profiles
            when available.
          </p>
        </div>
      </section>

      <footer className="intro-site-footer">
        <div className="intro-footer-main">
          <div className="intro-footer-brand">
            <div className="intro-brand-mark">⚓</div>
            <h3>Maritime Freight AI</h3>
            <p>
              An intelligent workspace for maritime route exploration,
              freight pricing, and quotation management.
            </p>
          </div>

          <div className="intro-footer-column">
            <h4>Quick Links</h4>
            <button type="button" onClick={() => goTo("introduction")}>
              Getting Started
            </button>
            <button type="button" onClick={() => goTo("new-route-search")}>
              Route Search
            </button>
            <button type="button" onClick={() => goTo("saved-quotations")}>
              My Quotations
            </button>
            <button type="button" onClick={() => goTo("activity")}>
              Activity
            </button>

            <button type="button" onClick={() => goTo("my-shipments")}>
              My Shipments
            </button>

            <button type="button" onClick={() => goTo("payments")}>
              Payments
            </button>

            <button type="button" onClick={() => goTo("settings-profile")}>
              Settings
              </button>
            <button type="button" onClick={() => goTo("feedback")}>
              Feedback
            </button>

          </div>

          <div className="intro-footer-column">
            <h4>Resources</h4>
            <a
              href="https://www.trade.gov/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Trade Resources ↗
            </a>
            <a
              href="https://iccwbo.org/business-solutions/incoterms-rules/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Incoterms ↗
            </a>
            <a
              href="https://www.wto.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              World Trade ↗
            </a>
          </div>

          <div className="intro-footer-column">
            <h4>Connect With Us</h4>

            <a href="mailto:maritimefreightquotation@gmail.com">
              maritimefreightquotation@gmail.com
            </a>

            <a href="#contact-us">Contact Information</a>
          </div>
        </div>

        <div className="intro-footer-bottom">
          <p>
            © {new Date().getFullYear()} Maritime Freight AI. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default UserIntroduction;