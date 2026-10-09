import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

import {
  removeSavedQuotation,
  requestQuotationApproval,
} from "../services/quotationApi";

import "./SavedQuotations.css";

function SavedQuotations() {
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [approvalLoading, setApprovalLoading] = useState(null);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalError, setApprovalError] = useState("");

  const [removingQuotationId, setRemovingQuotationId] =
    useState(null);

  const [pdfLoading, setPdfLoading] = useState(false);

  // =========================================================
  // TABLE / DETAILS VIEW STATE
  // =========================================================

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // =========================================================
  // FETCH CURRENT LOGGED-IN USER
  // =========================================================

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(
        "http://localhost:8000/api/auth/me",
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.user
      ) {
        throw new Error(
          "Authentication required."
        );
      }

      setCurrentUser(data.user);

      return data.user;
    } catch (err) {
      console.error(
        "Current user error:",
        err
      );

      setError(
        err.message ||
          "Unable to identify the logged-in user."
      );

      return null;
    }
  };

  // =========================================================
  // FETCH SAVED QUOTATIONS
  // =========================================================

  const fetchSavedQuotations = async (user) => {
    if (!user?.id) {
      setError(
        "User information not found."
      );

      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8000/api/quotations/saved/${user.id}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            data.message ||
            "Unable to load saved quotations."
        );
      }

      if (data.status === "success") {
        setQuotations(
          data.saved_quotations || []
        );
      } else {
        throw new Error(
          data.message ||
            "Unable to load saved quotations."
        );
      }
    } catch (err) {
      console.error(
        "Saved quotations error:",
        err
      );

      setError(
        err.message ||
          "Unable to load saved quotations."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!quotations.length) return;

    let targetQuotationId = null;

    try {
      targetQuotationId = sessionStorage.getItem(
        "user_dashboard_notification_target_quotation"
      );
    } catch (error) {
      console.error("Unable to read quotation notification target:", error);
    }

    if (!targetQuotationId) return;

    const target = quotations.find(
      (quotation) =>
        String(quotation.quotation_id ?? quotation.id ?? quotation.saved_quotation_id) ===
        String(targetQuotationId)
    );

    if (!target) return;

    const targetElementId = `saved-quotation-${target.id ?? target.saved_quotation_id ?? target.quotation_id}`;

    requestAnimationFrame(() => {
      const element = document.getElementById(targetElementId);
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("notification-target-quotation");

      window.setTimeout(() => {
        element.classList.remove("notification-target-quotation");
      }, 1800);
    });

    try {
      sessionStorage.removeItem(
        "user_dashboard_notification_target_quotation"
      );
    } catch (error) {
      console.error("Unable to clear quotation notification target:", error);
    }
  }, [quotations]);

  // =========================================================
  // REQUEST QUOTATION APPROVAL
  // =========================================================

  const handleRequestApproval = async (
    quotationId
  ) => {
    if (!quotationId) {
      return;
    }

    try {
      setApprovalLoading(
        quotationId
      );

      setApprovalMessage("");
      setApprovalError("");

      const data =
        await requestQuotationApproval(
          quotationId
        );

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Unable to request quotation approval."
        );
      }

      setQuotations(
        (previousQuotations) =>
          previousQuotations.map(
            (quotation) =>
              quotation.quotation_id ===
              quotationId
                ? {
                    ...quotation,
                    status: "pending",
                  }
                : quotation
          )
      );

      setApprovalMessage(
        "Quotation has been submitted for admin approval."
      );
    } catch (err) {
      console.error(
        "Quotation approval request error:",
        err
      );

      setApprovalError(
        err.message ||
          "Unable to request quotation approval. Please try again."
      );
    } finally {
      setApprovalLoading(null);
    }
  };

  // =========================================================
  // REMOVE SAVED QUOTATION
  // =========================================================

  const handleRemoveQuotation = async (
    quotation
  ) => {
    const savedQuotationId =
      quotation?.id ??
      quotation?.saved_quotation_id;

    if (!savedQuotationId) {
      setError(
        "Saved quotation ID not found."
      );
      return;
    }

    const quotationNumber =
      quotation?.quotation_id ??
      savedQuotationId;

    const confirmed = window.confirm(
      `Remove saved quotation #${quotationNumber}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingQuotationId(
        savedQuotationId
      );

      setError("");
      setApprovalMessage("");
      setApprovalError("");

      const result =
        await removeSavedQuotation(
          savedQuotationId
        );

      if (
        !result ||
        result.status !== "success"
      ) {
        throw new Error(
          result?.message ||
            "Unable to remove saved quotation."
        );
      }

      setQuotations(
        (previousQuotations) =>
          previousQuotations.filter(
            (savedQuotation) =>
              (savedQuotation.id ??
                savedQuotation.saved_quotation_id) !==
              savedQuotationId
          )
      );
    } catch (err) {
      console.error(
        "Remove saved quotation error:",
        err
      );

      setError(
        err.message ||
          "Unable to remove saved quotation."
      );
    } finally {
      setRemovingQuotationId(null);
    }
  };

  // =========================================================
  // FORMAT CURRENCY
  // =========================================================

  const formatCurrency = (
    value
  ) => {
    const number =
      Number(value) || 0;

    return number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // =========================================================
  // STATUS LABEL
  // =========================================================

  const getStatusLabel = (
    status
  ) => {
    const normalizedStatus =
      String(status || "")
        .toLowerCase()
        .trim();

    if (
      normalizedStatus ===
      "pending"
    ) {
      return "Pending";
    }

    if (
      normalizedStatus ===
      "approved"
    ) {
      return "Approved";
    }

    if (
      normalizedStatus ===
      "rejected"
    ) {
      return "Rejected";
    }

    return "Saved";
  };

  // =========================================================
  // PDF HELPER - ROUNDED BOX
  // =========================================================

  const drawRoundedBox = (
    doc,
    x,
    y,
    width,
    height,
    fillColor,
    borderColor = null,
    radius = 3
  ) => {
    doc.setFillColor(
      ...fillColor
    );

    if (borderColor) {
      doc.setDrawColor(
        ...borderColor
      );

      doc.setLineWidth(0.4);

      doc.roundedRect(
        x,
        y,
        width,
        height,
        radius,
        radius,
        "FD"
      );
    } else {
      doc.roundedRect(
        x,
        y,
        width,
        height,
        radius,
        radius,
        "F"
      );
    }
  };

  // =========================================================
  // PDF HELPER - SECTION TITLE
  // =========================================================

  const drawSectionTitle = (
    doc,
    title,
    x,
    y,
    pageWidth,
    margin
  ) => {
    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(10);

    doc.setTextColor(
      74,
      44,
      26
    );

    doc.text(
      title,
      x,
      y
    );

    doc.setDrawColor(
      215,
      184,
      148
    );

    doc.setLineWidth(0.4);

    doc.line(
      x,
      y + 2.5,
      pageWidth - margin,
      y + 2.5
    );
  };

  // =========================================================
  // PDF HELPER - LABEL / VALUE
  // =========================================================

  const drawLabelValue = (
    doc,
    label,
    value,
    x,
    y,
    labelWidth = 30,
    valueWidth = 55
  ) => {
    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(7.5);

    doc.setTextColor(
      118,
      91,
      71
    );

    doc.text(
      label,
      x,
      y
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.setTextColor(
      47,
      36,
      28
    );

    const wrappedValue =
      doc.splitTextToSize(
        String(value ?? "—"),
        valueWidth
      );

    doc.text(
      wrappedValue,
      x + labelWidth,
      y
    );
  };

  // =========================================================
  // PDF HELPER - STATUS COLORS
  // =========================================================

  const getPdfStatusColors = (
    status
  ) => {
    if (
      status === "approved"
    ) {
      return {
        fill: [225, 245, 230],
        text: [32, 115, 53],
      };
    }

    if (
      status === "rejected"
    ) {
      return {
        fill: [249, 230, 226],
        text: [150, 61, 50],
      };
    }

    if (
      status === "pending"
    ) {
      return {
        fill: [255, 242, 202],
        text: [145, 103, 20],
      };
    }

    return {
      fill: [248, 237, 220],
      text: [150, 96, 45],
    };
  };

  // =========================================================
  // DOWNLOAD PDF
  // =========================================================

  const handleDownloadPDF =
    async () => {
      if (
        !quotations ||
        quotations.length === 0
      ) {
        return;
      }

      try {
        setPdfLoading(true);

        setApprovalError("");
        setApprovalMessage("");

        const doc = new jsPDF({
          orientation:
            "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        const margin = 16;

        const contentWidth =
          pageWidth -
          margin * 2;

        const footerSpace = 20;

        let y = 52;

        // =====================================================
        // COLORS
        // =====================================================

        const DARK_BROWN = [
          74, 44, 26,
        ];

        const COFFEE_BROWN = [
          138, 90, 50,
        ];

        const MEDIUM_BROWN = [
          118, 91, 71,
        ];

        const LIGHT_BROWN = [
          215, 184, 148,
        ];

        const CREAM = [
          255, 250, 241,
        ];

        const SOFT_CREAM = [
          246, 234, 216,
        ];

        const WHITE = [
          255, 255, 255,
        ];

        // =====================================================
        // SORT QUOTATIONS
        // =====================================================

        const orderedQuotations =
          [...quotations].sort(
            (a, b) => {
              const aId =
                Number(
                  a.quotation_id ??
                    a.id ??
                    0
                );

              const bId =
                Number(
                  b.quotation_id ??
                    b.id ??
                    0
                );

              return (
                aId - bId
              );
            }
          );

        // =====================================================
        // PAGE HEADER
        // =====================================================

        const drawPageHeader = (
          isFirstPage = false
        ) => {
          if (
            isFirstPage
          ) {
            doc.setFillColor(
              ...DARK_BROWN
            );

            doc.rect(
              0,
              0,
              pageWidth,
              43,
              "F"
            );

            doc.setFillColor(
              ...LIGHT_BROWN
            );

            doc.rect(
              0,
              43,
              pageWidth,
              2,
              "F"
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(
              18
            );

            doc.setTextColor(
              ...CREAM
            );

            doc.text(
              "Saved Quotations",
              margin,
              18
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(
              8
            );

            doc.setTextColor(
              235,
              220,
              201
            );

            doc.text(
              "Agentic AI for Maritime Freight Pricing and Route Optimization",
              margin,
              26
            );

            doc.setFontSize(
              7.5
            );

            doc.text(
              "Customer Quotation Report",
              margin,
              34
            );

            y = 52;
          } else {
            doc.setFillColor(
              ...DARK_BROWN
            );

            doc.rect(
              0,
              0,
              pageWidth,
              18,
              "F"
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(
              10
            );

            doc.setTextColor(
              ...CREAM
            );

            doc.text(
              "Saved Quotations",
              margin,
              11
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(
              6.5
            );

            doc.setTextColor(
              230,
              214,
              194
            );

            doc.text(
              "Agentic AI for Maritime Freight Pricing and Route Optimization",
              pageWidth -
                margin,
              11,
              {
                align:
                  "right",
              }
            );

            doc.setFillColor(
              ...LIGHT_BROWN
            );

            doc.rect(
              0,
              18,
              pageWidth,
              1.5,
              "F"
            );

            y = 27;
          }
        };

        // =====================================================
        // SAFE SPACE
        // =====================================================

        const ensureSpace = (
          requiredHeight,
          minimumY = 27
        ) => {
          if (
            y +
              requiredHeight >
            pageHeight -
              footerSpace
          ) {
            doc.addPage();

            drawPageHeader(
              false
            );

            y = minimumY;
          }
        };

        // =====================================================
        // FIRST PAGE HEADER
        // =====================================================

        drawPageHeader(
          true
        );

        // =====================================================
        // CUSTOMER DETAILS
        // =====================================================

        if (currentUser) {
          const customerCardHeight =
            36;

          ensureSpace(
            customerCardHeight
          );

          drawRoundedBox(
            doc,
            margin,
            y,
            contentWidth,
            customerCardHeight,
            SOFT_CREAM,
            LIGHT_BROWN,
            4
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(
            9.5
          );

          doc.setTextColor(
            ...DARK_BROWN
          );

          doc.text(
            "CUSTOMER DETAILS",
            margin + 7,
            y + 8
          );

          doc.setDrawColor(
            ...LIGHT_BROWN
          );

          doc.line(
            margin + 7,
            y + 11,
            pageWidth -
              margin -
              7,
            y + 11
          );

          drawLabelValue(
            doc,
            "Name",
            currentUser.name ||
              "—",
            margin + 7,
            y + 19,
            25,
            55
          );

          drawLabelValue(
            doc,
            "Email",
            currentUser.email ||
              "—",
            margin + 7,
            y + 27,
            25,
            65
          );

          drawLabelValue(
            doc,
            "Company",
            currentUser.company_name ||
              "—",
            margin + 105,
            y + 19,
            28,
            48
          );

          drawLabelValue(
            doc,
            "Quotations",
            orderedQuotations.length,
            margin + 105,
            y + 27,
            28,
            48
          );

          y +=
            customerCardHeight +
            9;
        }

        // =====================================================
        // REPORT SUMMARY
        // =====================================================

        ensureSpace(25);

        drawRoundedBox(
          doc,
          margin,
          y,
          contentWidth,
          20,
          CREAM,
          LIGHT_BROWN,
          4
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          8.5
        );

        doc.setTextColor(
          ...MEDIUM_BROWN
        );

        doc.text(
          "REPORT SUMMARY",
          margin + 7,
          y + 7
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          7.5
        );

        doc.setTextColor(
          ...DARK_BROWN
        );

        doc.text(
          `Total Saved Quotations: ${orderedQuotations.length}`,
          margin + 7,
          y + 14
        );

        doc.text(
          `Generated: ${new Date().toLocaleString()}`,
          pageWidth -
            margin -
            7,
          y + 14,
          {
            align:
              "right",
          }
        );

        y += 28;

        // =====================================================
        // QUOTATIONS
        // =====================================================

        orderedQuotations.forEach(
          (quotation, index) => {
            const pricing =
              quotation.pricing ||
              {};

            const topRoutes =
              Array.isArray(
                quotation.top_routes
              )
                ? quotation.top_routes
                : [];

            const selectedRoute =
              topRoutes.find(
                (route) =>
                  route.route_id ===
                  quotation.route_id
              );

            const baseFreight =
              Number(
                selectedRoute?.base_freight_usd ??
                  quotation.base_freight_usd ??
                  quotation.freight_per_container_usd ??
                  0
              ) || 0;

            const normalizedStatus =
              String(
                quotation.status ||
                  ""
              )
                .toLowerCase()
                .trim();

            const statusLabel =
              getStatusLabel(
                normalizedStatus
              );

            const quotationNumber =
              quotation.quotation_id ??
              index + 1;

            // =================================================
            // GAP
            // =================================================

            if (y > 30) {
              y += 4;
            }

            // =================================================
            // QUOTATION HEADER
            // =================================================

            ensureSpace(25);

            const quotationStartY =
              y;

            drawRoundedBox(
              doc,
              margin,
              quotationStartY,
              contentWidth,
              22,
              DARK_BROWN,
              null,
              4
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(
              11
            );

            doc.setTextColor(
              ...CREAM
            );

            doc.text(
              `QUOTATION #${quotationNumber}`,
              margin + 7,
              quotationStartY +
                9
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(
              7.5
            );

            doc.setTextColor(
              232,
              216,
              195
            );

            doc.text(
              `${quotation.origin || "—"} → ${
                quotation.destination ||
                "—"
              }`,
              margin + 7,
              quotationStartY +
                16
            );

            const statusColors =
              getPdfStatusColors(
                normalizedStatus
              );

            const badgeWidth =
              Math.max(
                21,
                statusLabel.length *
                  2 +
                  8
              );

            const badgeX =
              pageWidth -
              margin -
              badgeWidth -
              7;

            doc.setFillColor(
              ...statusColors.fill
            );

            doc.roundedRect(
              badgeX,
              quotationStartY +
                6,
              badgeWidth,
              9,
              4,
              4,
              "F"
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(
              6.5
            );

            doc.setTextColor(
              ...statusColors.text
            );

            doc.text(
              statusLabel.toUpperCase(),
              badgeX +
                badgeWidth / 2,
              quotationStartY +
                12,
              {
                align:
                  "center",
              }
            );

            y += 28;

            // =================================================
            // QUOTATION DETAILS
            // =================================================

            ensureSpace(25);

            drawSectionTitle(
              doc,
              "QUOTATION DETAILS",
              margin + 7,
              y,
              pageWidth,
              margin
            );

            y += 9;

            drawRoundedBox(
              doc,
              margin + 7,
              y - 4,
              contentWidth - 14,
              17,
              WHITE,
              [224, 204, 181],
              2
            );

            drawLabelValue(
              doc,
              "Cargo Type",
              quotation.cargo_type ||
                "—",
              margin + 10,
              y + 3,
              25,
              45
            );

            drawLabelValue(
              doc,
              "Containers",
              quotation.containers ||
                "—",
              margin + 78,
              y + 3,
              24,
              30
            );

            drawLabelValue(
              doc,
              "Route",
              quotation.route_id ||
                "—",
              margin + 128,
              y + 3,
              20,
              35
            );

            y += 21;

            // =================================================
            // TOP ROUTES
            // =================================================

            if (
              topRoutes.length >
              0
            ) {
              ensureSpace(
                17 +
                  topRoutes.length *
                    7
              );

              drawSectionTitle(
                doc,
                "TOP ROUTES",
                margin + 7,
                y,
                pageWidth,
                margin
              );

              y += 7;

              const tableX =
                margin + 7;

              const tableWidth =
                contentWidth -
                14;

              doc.setFillColor(
                ...SOFT_CREAM
              );

              doc.rect(
                tableX,
                y - 4,
                tableWidth,
                7,
                "F"
              );

              doc.setFont(
                "helvetica",
                "bold"
              );

              doc.setFontSize(
                6.5
              );

              doc.setTextColor(
                ...MEDIUM_BROWN
              );

              doc.text(
                "RANK",
                tableX + 3,
                y
              );

              doc.text(
                "ROUTE",
                tableX + 23,
                y
              );

              doc.text(
                "SCORE",
                tableX + 62,
                y
              );

              doc.text(
                "BASE FREIGHT",
                tableX + 96,
                y
              );

              doc.text(
                "STATUS",
                tableX + 142,
                y
              );

              y += 7;

              topRoutes.forEach(
                (route) => {
                  const isSelected =
                    route.route_id ===
                    quotation.route_id;

                  if (
                    isSelected
                  ) {
                    doc.setFillColor(
                      238,
                      226,
                      208
                    );

                    doc.roundedRect(
                      tableX,
                      y - 4,
                      tableWidth,
                      7,
                      2,
                      2,
                      "F"
                    );
                  }

                  doc.setFont(
                    "helvetica",
                    isSelected
                      ? "bold"
                      : "normal"
                  );

                  doc.setFontSize(
                    6.8
                  );

                  doc.setTextColor(
                    ...DARK_BROWN
                  );

                  doc.text(
                    `#${route.rank ?? "—"}`,
                    tableX + 3,
                    y
                  );

                  doc.text(
                    route.route_id ||
                      "—",
                    tableX + 23,
                    y
                  );

                  doc.text(
                    Number(
                      route.route_score ||
                        0
                    ).toFixed(2),
                    tableX + 62,
                    y
                  );

                  doc.text(
                    `$${formatCurrency(
                      route.base_freight_usd
                    )}`,
                    tableX + 96,
                    y
                  );

                  doc.setFont(
                    "helvetica",
                    "bold"
                  );

                  doc.setTextColor(
                    ...COFFEE_BROWN
                  );

                  doc.text(
                    isSelected
                      ? "SELECTED"
                      : "ALTERNATIVE",
                    tableX + 142,
                    y
                  );

                  y += 7;
                }
              );

              y += 3;
            }

            // =================================================
            // QUOTATION SUMMARY
            // =================================================

            const finalSellingPrice =
              Number(
                quotation.final_selling_price_usd ??
                  quotation.selling_price ??
                  pricing.final_selling_price_usd ??
                  0
              ) || 0;

            const weatherCondition =
              quotation.weather_condition || "—";

            const customsStatus =
              quotation.customs_status || "—";

            ensureSpace(47);

            drawSectionTitle(
              doc,
              "QUOTATION SUMMARY",
              margin + 7,
              y,
              pageWidth,
              margin
            );

            y += 8;

            const summaryGap = 4;
            const summaryX = margin + 7;
            const summaryWidth = contentWidth - 14;
            const summaryCardWidth =
              (summaryWidth - summaryGap * 2) / 3;
            const summaryCardHeight = 30;

            // Selling Price Card
            drawRoundedBox(
              doc,
              summaryX,
              y,
              summaryCardWidth,
              summaryCardHeight,
              [248, 234, 219],
              COFFEE_BROWN,
              4
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(7);
            doc.setTextColor(
              ...MEDIUM_BROWN
            );
            doc.text(
              "SELLING PRICE",
              summaryX + summaryCardWidth / 2,
              y + 9,
              { align: "center" }
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(13);
            doc.setTextColor(
              ...DARK_BROWN
            );
            doc.text(
              `$${formatCurrency(finalSellingPrice)}`,
              summaryX + summaryCardWidth / 2,
              y + 21,
              { align: "center" }
            );

            // Weather Condition Card
            const weatherX =
              summaryX + summaryCardWidth + summaryGap;

            drawRoundedBox(
              doc,
              weatherX,
              y,
              summaryCardWidth,
              summaryCardHeight,
              WHITE,
              [224, 204, 181],
              4
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(7);
            doc.setTextColor(
              ...MEDIUM_BROWN
            );
            doc.text(
              "WEATHER CONDITION",
              weatherX + summaryCardWidth / 2,
              y + 9,
              { align: "center" }
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(10);
            doc.setTextColor(
              ...DARK_BROWN
            );

            const weatherText =
              doc.splitTextToSize(
                String(weatherCondition),
                summaryCardWidth - 8
              );

            doc.text(
              weatherText,
              weatherX + summaryCardWidth / 2,
              y + 19,
              { align: "center" }
            );

            // Customs Status Card
            const customsX =
              weatherX + summaryCardWidth + summaryGap;

            let customsFill = WHITE;
            let customsTextColor = DARK_BROWN;

            const normalizedCustomsStatus =
              String(customsStatus)
                .toLowerCase()
                .trim();

            if (normalizedCustomsStatus === "valid") {
              customsFill = [225, 245, 230];
              customsTextColor = [32, 115, 53];
            } else if (normalizedCustomsStatus === "warning") {
              customsFill = [255, 242, 202];
              customsTextColor = [145, 103, 20];
            } else if (normalizedCustomsStatus === "restricted") {
              customsFill = [249, 230, 226];
              customsTextColor = [150, 61, 50];
            }

            drawRoundedBox(
              doc,
              customsX,
              y,
              summaryCardWidth,
              summaryCardHeight,
              customsFill,
              [224, 204, 181],
              4
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(7);
            doc.setTextColor(
              ...MEDIUM_BROWN
            );
            doc.text(
              "CUSTOMS STATUS",
              customsX + summaryCardWidth / 2,
              y + 9,
              { align: "center" }
            );

            doc.setFont(
              "helvetica",
              "bold"
            );
            doc.setFontSize(10);
            doc.setTextColor(
              ...customsTextColor
            );
            doc.text(
              String(customsStatus),
              customsX + summaryCardWidth / 2,
              y + 19,
              { align: "center" }
            );

            y += 38;

            // =================================================
            // SAVED DATE
            // =================================================

            ensureSpace(13);

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setFontSize(
              6.8
            );

            doc.setTextColor(
              ...MEDIUM_BROWN
            );

            doc.text(
              `Saved on: ${
                quotation.saved_at
                  ? new Date(
                      quotation.saved_at
                    ).toLocaleString()
                  : "—"
              }`,
              margin + 7,
              y
            );

            y += 9;

            // =================================================
            // SEPARATOR
            // =================================================

            if (
              index <
              orderedQuotations.length -
                1
            ) {
              ensureSpace(8);

              doc.setDrawColor(
                215,
                184,
                148
              );

              doc.setLineWidth(
                0.4
              );

              doc.line(
                margin + 7,
                y,
                pageWidth -
                  margin -
                  7,
                y
              );

              y += 8;
            }
          }
        );

        // =====================================================
        // FOOTER
        // =====================================================

        const totalPages =
          doc.getNumberOfPages();

        for (
          let page = 1;
          page <= totalPages;
          page++
        ) {
          doc.setPage(page);

          doc.setDrawColor(
            215,
            184,
            148
          );

          doc.setLineWidth(
            0.4
          );

          doc.line(
            margin,
            pageHeight - 15,
            pageWidth -
              margin,
            pageHeight - 15
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(
            6.5
          );

          doc.setTextColor(
            ...MEDIUM_BROWN
          );

          doc.text(
            "Agentic AI for Maritime Freight Pricing and Route Optimization",
            margin,
            pageHeight - 9
          );

          doc.text(
            `Page ${page} of ${totalPages}`,
            pageWidth -
              margin,
            pageHeight - 9,
            {
              align:
                "right",
            }
          );
        }

        // =====================================================
        // FILE NAME
        // =====================================================

        const safeName =
          currentUser?.name
            ? currentUser.name
                .replace(
                  /\s+/g,
                  "_"
                )
                .replace(
                  /[^a-zA-Z0-9_-]/g,
                  ""
                )
            : "Customer";

        const fileName =
          `${safeName}_Saved_Quotations.pdf`;

        // =====================================================
        // DOWNLOAD
        // =====================================================

        doc.save(
          fileName
        );
      } catch (err) {
        console.error(
          "PDF generation error:",
          err
        );

        setApprovalError(
          "Unable to generate the PDF. Please try again."
        );
      } finally {
        setPdfLoading(
          false
        );
      }
    };

  // =========================================================
  // LOAD PAGE DATA
  // =========================================================

  useEffect(() => {
    const loadSavedQuotations =
      async () => {
        setLoading(true);
        setError("");

        const user =
          await fetchCurrentUser();

        if (user) {
          await fetchSavedQuotations(
            user
          );
        } else {
          setLoading(false);
        }
      };

    loadSavedQuotations();
  }, []);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="saved-quotations-page">
        <div className="saved-quotations-header">
          <div>
            <h1>
              My Quotations
            </h1>

            <p>
              Your saved freight quotations
            </p>
          </div>
        </div>

        <div className="saved-quotations-message">
          Loading saved quotations...
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="saved-quotations-page">
        <div className="saved-quotations-header">
          <div>
            <h1>
              My Quotations
            </h1>

            <p>
              Your saved freight quotations
            </p>
          </div>
        </div>

        <div className="saved-quotations-message error">
          {error}
        </div>
      </div>
    );
  }

  // =========================================================
  // TABLE HELPERS
  // =========================================================

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSellingPrice = (quotation) => {
    const pricing = quotation?.pricing || {};
    const value =
      quotation?.final_selling_price_usd ??
      quotation?.selling_price ??
      pricing?.final_selling_price_usd;
    return value === null || value === undefined || value === ""
      ? null
      : Number(value);
  };

  const normalizedQuotations = quotations || [];

  const quotationCounts = {
    total: normalizedQuotations.length,
    pending: normalizedQuotations.filter(
      (quotation) => String(quotation.status || "").toLowerCase() === "pending"
    ).length,
    approved: normalizedQuotations.filter(
      (quotation) => String(quotation.status || "").toLowerCase() === "approved"
    ).length,
    rejected: normalizedQuotations.filter(
      (quotation) => String(quotation.status || "").toLowerCase() === "rejected"
    ).length,
  };

  const filteredQuotations = normalizedQuotations.filter((quotation) => {
    const status = String(quotation.status || "").toLowerCase();
    if (activeFilter !== "all" && status !== activeFilter) return false;

    const routeText = `${quotation.origin || ""} ${quotation.destination || ""}`;
    const searchText = [
      quotation.quotation_id,
      quotation.route_id,
      quotation.cargo_type,
      quotation.origin,
      quotation.destination,
      routeText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchText.includes(searchTerm.trim().toLowerCase());
  });

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="saved-quotations-page">
        <header className="saved-quotations-page-header">
          <div>
            <span className="saved-quotations-eyebrow">USER DASHBOARD</span>
            <h1>My Quotations</h1>
            <p>View and review your saved freight quotations.</p>
          </div>
        </header>
        <div className="saved-quotations-alert">Loading quotations...</div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="saved-quotations-page">
        <header className="saved-quotations-page-header">
          <div>
            <span className="saved-quotations-eyebrow">USER DASHBOARD</span>
            <h1>My Quotations</h1>
            <p>View and review your saved freight quotations.</p>
          </div>
        </header>
        <div className="saved-quotations-alert saved-quotations-alert-error">
          {error}
        </div>
      </div>
    );
  }

  // =========================================================
  // MAIN PAGE — ADMIN-STYLE QUOTATION MANAGEMENT VIEW
  // =========================================================

  return (
    <div className="saved-quotations-page">
      <header className="saved-quotations-page-header">
        <div>
          <span className="saved-quotations-eyebrow">USER DASHBOARD</span>
          <h1>My Quotations</h1>
          <p>View quotation information and manage your saved quotations.</p>
        </div>

        <button
          type="button"
          className="saved-quotations-refresh-button"
          onClick={async () => {
            setLoading(true);
            const user = currentUser || (await fetchCurrentUser());
            if (user) await fetchSavedQuotations(user);
            else setLoading(false);
          }}
          disabled={loading || pdfLoading}
        >
          ↻ &nbsp; Refresh
        </button>
      </header>

      {approvalMessage && (
        <div className="saved-quotations-alert saved-quotations-alert-success">
          {approvalMessage}
        </div>
      )}

      {approvalError && (
        <div className="saved-quotations-alert saved-quotations-alert-error">
          {approvalError}
        </div>
      )}

      <section className="saved-quotations-summary-grid">
        <div className="saved-quotations-summary-card">
          <span className="saved-quotations-summary-icon">▤</span>
          <div><p>Total Quotations</p><strong>{quotationCounts.total}</strong></div>
        </div>
        <div className="saved-quotations-summary-card saved-quotations-summary-pending">
          <span className="saved-quotations-summary-icon">◷</span>
          <div><p>Pending Review</p><strong>{quotationCounts.pending}</strong></div>
        </div>
        <div className="saved-quotations-summary-card saved-quotations-summary-approved">
          <span className="saved-quotations-summary-icon">✓</span>
          <div><p>Approved</p><strong>{quotationCounts.approved}</strong></div>
        </div>
        <div className="saved-quotations-summary-card saved-quotations-summary-rejected">
          <span className="saved-quotations-summary-icon">×</span>
          <div><p>Rejected</p><strong>{quotationCounts.rejected}</strong></div>
        </div>
      </section>

      {normalizedQuotations.length > 0 && (
        <section className="saved-quotations-list-section">
          <div className="saved-quotations-list-heading">
            <div>
              <h2>My Quotations</h2>
              <p>View your quotation details and approval status.</p>
            </div>
            <span className="saved-quotations-record-count">
              {filteredQuotations.length} records
            </span>
          </div>

          <div className="saved-quotations-toolbar">
            <input
              type="search"
              className="saved-quotations-search"
              placeholder="Search quotation, route, or cargo..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search quotations"
            />

            <div className="saved-quotations-filter-buttons">
              {[
                ["all", "All"],
                ["pending", "Pending"],
                ["approved", "Approved"],
                ["rejected", "Rejected"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={activeFilter === value ? "saved-quotations-filter active" : "saved-quotations-filter"}
                  onClick={() => setActiveFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="saved-quotations-table-wrapper">
            <table className="saved-quotations-table">
              <thead>
                <tr>
                  <th>Quotation ID</th>
                  <th>Route</th>
                  <th>Cargo</th>
                  <th>Containers</th>
                  <th>Date</th>
                  <th>Selling Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="saved-quotations-empty-cell">
                      No quotations found.
                    </td>
                  </tr>
                ) : (
                  filteredQuotations.map((quotation) => {
                    const status = String(quotation.status || "saved").toLowerCase();
                    const sellingPrice = getSellingPrice(quotation);
                    const quotationDate = quotation.saved_at || quotation.created_at;

                    return (
                      <tr key={quotation.id ?? quotation.quotation_id}>
                        <td className="saved-quotations-id">
                          #{quotation.quotation_id ?? quotation.id ?? "—"}
                        </td>
                        <td>
                          <div className="saved-quotations-route-cell">
                            <span>{quotation.origin || "—"}</span>
                            <span className="saved-quotations-route-arrow">→</span>
                            <span>{quotation.destination || "—"}</span>
                          </div>
                          <div className="saved-quotations-secondary">Route: {quotation.route_id || "—"}</div>
                        </td>
                        <td>{quotation.cargo_type || "—"}</td>
                        <td>{quotation.containers ?? "—"}</td>
                        <td>{formatDate(quotationDate)}</td>
                        <td className="saved-quotations-money">
                          {sellingPrice !== null && Number.isFinite(sellingPrice)
                            ? `$${formatCurrency(sellingPrice)}`
                            : "—"}
                        </td>
                        <td>
                          <span className={`saved-quotations-status saved-status-${status}`}>
                            <span className="saved-status-dot" />
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="saved-quotations-view-button"
                            onClick={() => {
                              setApprovalMessage("");
                              setApprovalError("");
                              setSelectedQuotation(quotation);
                            }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {normalizedQuotations.length === 0 && (
        <div className="saved-quotations-empty">
          <div className="empty-icon">📄</div>
          <h2>No Quotations</h2>
          <p>You have no quotations yet.</p>
        </div>
      )}

      {normalizedQuotations.length > 0 && (
        <div className="saved-quotations-download-row">
          <button
            type="button"
            className="download-quotation-pdf-button"
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      )}

      {selectedQuotation && (
        <div
          className="saved-quotations-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedQuotation(null);
          }}
        >
          <div
            className="saved-quotations-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-quotation-modal-title"
          >
            <header className="saved-quotations-modal-header">
              <div>
                <span className="saved-quotations-eyebrow">QUOTATION DETAILS</span>
                <h2 id="saved-quotation-modal-title">
                  Quotation #{selectedQuotation.quotation_id ?? selectedQuotation.id ?? "—"}
                </h2>
                <span className={`saved-quotations-status saved-status-${String(selectedQuotation.status || "saved").toLowerCase()}`}>
                  <span className="saved-status-dot" />
                  {getStatusLabel(selectedQuotation.status)}
                </span>
              </div>
              <button
                type="button"
                className="saved-quotations-close-button"
                onClick={() => setSelectedQuotation(null)}
                aria-label="Close quotation details"
              >
                ×
              </button>
            </header>

            <div className="saved-quotations-modal-body">
              <section className="saved-detail-section">
                <div className="saved-detail-heading">
                  <h3>A. Route Details</h3>
                  <p>Complete details of the selected maritime route and shipment.</p>
                </div>
                <div className="saved-detail-grid">
                  <div><span>Quotation ID</span><strong>#{selectedQuotation.quotation_id ?? selectedQuotation.id ?? "—"}</strong></div>
                  <div><span>Route ID</span><strong>{selectedQuotation.route_id || "—"}</strong></div>
                  <div><span>Origin</span><strong>{selectedQuotation.origin || "—"}</strong></div>
                  <div><span>Destination</span><strong>{selectedQuotation.destination || "—"}</strong></div>
                  <div><span>Cargo Type</span><strong>{selectedQuotation.cargo_type || "—"}</strong></div>
                  <div><span>Container Type</span><strong>{selectedQuotation.container_type || "—"}</strong></div>
                  <div><span>Containers</span><strong>{selectedQuotation.containers ?? "—"}</strong></div>
                  <div><span>Transshipments</span><strong>{selectedQuotation.transshipments ?? "—"}</strong></div>
                  <div><span>Distance</span><strong>{selectedQuotation.distance_nm != null ? `${Number(selectedQuotation.distance_nm).toLocaleString("en-US")} NM` : "—"}</strong></div>
                  <div><span>Transit Days</span><strong>{selectedQuotation.transit_days != null ? `${selectedQuotation.transit_days} days` : "—"}</strong></div>
                </div>
              </section>

              <section className="saved-detail-section">
                <div className="saved-detail-heading">
                  <h3>B. Pricing Details</h3>
                  <p>Full cost, demand, margin and final selling-price breakdown.</p>
                </div>
                <div className="saved-detail-grid">
                  <div><span>Base Freight</span><strong>{selectedQuotation.pricing?.base_freight_usd != null ? `$${formatCurrency(selectedQuotation.pricing.base_freight_usd)}` : (selectedQuotation.base_freight_usd != null ? `$${formatCurrency(selectedQuotation.base_freight_usd)}` : "—")}</strong></div>
                  <div><span>Fuel Surcharge</span><strong>{selectedQuotation.pricing?.fuel_surcharge_usd != null ? `$${formatCurrency(selectedQuotation.pricing.fuel_surcharge_usd)}` : "—"}</strong></div>
                  <div><span>Port Charge</span><strong>{selectedQuotation.pricing?.port_charge_usd != null ? `$${formatCurrency(selectedQuotation.pricing.port_charge_usd)}` : "—"}</strong></div>
                  <div><span>Risk Surcharge</span><strong>{selectedQuotation.pricing?.risk_surcharge_usd != null ? `$${formatCurrency(selectedQuotation.pricing.risk_surcharge_usd)}` : "—"}</strong></div>
                  <div><span>Operating Cost</span><strong>{selectedQuotation.pricing?.operating_cost_usd != null ? `$${formatCurrency(selectedQuotation.pricing.operating_cost_usd)}` : "—"}</strong></div>
                  <div><span>Demand Factor</span><strong>{selectedQuotation.pricing?.demand_factor != null ? Number(selectedQuotation.pricing.demand_factor).toFixed(2) : "—"}</strong></div>
                  <div><span>Demand Adjusted Cost</span><strong>{selectedQuotation.pricing?.demand_adjusted_cost_usd != null ? `$${formatCurrency(selectedQuotation.pricing.demand_adjusted_cost_usd)}` : "—"}</strong></div>
                  <div className="saved-detail-highlight"><span>Total Selling Price</span><strong>{getSellingPrice(selectedQuotation) != null ? `$${formatCurrency(getSellingPrice(selectedQuotation))}` : "—"}</strong></div>
                </div>
              </section>

              <section className="saved-detail-section">
                <div className="saved-detail-heading">
                  <h3>C. Weather Details</h3>
                  <p>Weather conditions and risk indicators for the selected route.</p>
                </div>
                <div className="saved-detail-grid">
                  <div><span>Wind Speed</span><strong>{selectedQuotation.weather?.wind_speed_knots != null ? `${selectedQuotation.weather.wind_speed_knots} knots` : (selectedQuotation.weather?.wind_speed != null ? `${selectedQuotation.weather.wind_speed} knots` : "—")}</strong></div>
                  <div><span>Wave Height</span><strong>{selectedQuotation.weather?.wave_height_m != null ? `${selectedQuotation.weather.wave_height_m} m` : (selectedQuotation.weather?.wave_height != null ? `${selectedQuotation.weather.wave_height} m` : "—")}</strong></div>
                  <div><span>Storm Probability</span><strong>{selectedQuotation.weather?.storm_probability_percent != null ? `${selectedQuotation.weather.storm_probability_percent}%` : (selectedQuotation.weather?.storm_probability != null ? `${selectedQuotation.weather.storm_probability}%` : "—")}</strong></div>
                  <div><span>Visibility</span><strong>{selectedQuotation.weather?.visibility_km != null ? `${selectedQuotation.weather.visibility_km} km` : (selectedQuotation.weather?.visibility != null ? `${selectedQuotation.weather.visibility} km` : "—")}</strong></div>
                  <div><span>Weather Condition</span><strong>{selectedQuotation.weather?.weather_condition || selectedQuotation.weather_condition || "—"}</strong></div>
                  <div><span>Weather Risk Level</span><strong>{selectedQuotation.weather?.weather_risk || selectedQuotation.weather?.risk_level || "—"}</strong></div>
                </div>
              </section>

              <section className="saved-detail-section">
                <div className="saved-detail-heading">
                  <h3>D. Customs Details</h3>
                  <p>Customs documentation, cargo restrictions and compliance assessment.</p>
                </div>
                <div className="saved-detail-grid">
                  <div><span>Customs ID</span><strong>{selectedQuotation.customs?.customs_id || "—"}</strong></div>
                  <div><span>Cargo Type</span><strong>{selectedQuotation.customs?.cargo_type || selectedQuotation.cargo_type || "—"}</strong></div>
                  <div><span>HS Code Required</span><strong>{selectedQuotation.customs?.hs_code_required ?? selectedQuotation.customs?.hs_code ?? selectedQuotation.hs_code_required ?? "—"}</strong></div>
                  <div><span>Commercial Invoice</span><strong>{selectedQuotation.customs?.commercial_invoice ?? selectedQuotation.commercial_invoice ?? "—"}</strong></div>
                  <div><span>Packing List</span><strong>{selectedQuotation.customs?.packing_list ?? selectedQuotation.packing_list ?? "—"}</strong></div>
                  <div><span>Certificate of Origin</span><strong>{selectedQuotation.customs?.certificate_of_origin ?? selectedQuotation.customs?.origin_certificate ?? selectedQuotation.certificate_of_origin ?? "—"}</strong></div>
                  <div><span>Restricted Cargo</span><strong>{selectedQuotation.customs?.restricted_cargo ?? selectedQuotation.restricted_cargo ?? "—"}</strong></div>
                  <div><span>Missing Documents</span><strong>{selectedQuotation.customs?.missing_documents?.length ? selectedQuotation.customs.missing_documents.join(", ") : "None"}</strong></div>
                  <div><span>Customs Risk / Status</span><strong>{selectedQuotation.customs?.customs_status || selectedQuotation.customs?.status || selectedQuotation.customs_status || "—"}</strong></div>
                  <div><span>Recommendation</span><strong>{selectedQuotation.customs?.recommendation || "—"}</strong></div>
                </div>
              </section>

              <section className="saved-detail-section">
                <div className="saved-detail-heading">
                  <h3>E. Approval Status</h3>
                  <p>Current admin review status for this quotation.</p>
                </div>
                <div className="saved-detail-status-panel">
                  <span className={`saved-quotations-status saved-status-${String(selectedQuotation.status || "saved").toLowerCase()}`}>
                    <span className="saved-status-dot" />
                    {getStatusLabel(selectedQuotation.status)}
                  </span>
                  <p>
                    {String(selectedQuotation.status || "").toLowerCase() === "approved"
                      ? "This quotation has been approved by admin."
                      : String(selectedQuotation.status || "").toLowerCase() === "rejected"
                        ? "This quotation was rejected by admin. A rejection reason will be shown here once the admin-side rejection reason feature is added."
                        : String(selectedQuotation.status || "").toLowerCase() === "pending"
                          ? "This quotation is waiting for admin review."
                          : "This quotation is saved and ready to be submitted for admin approval."}
                  </p>
                </div>
              </section>

              {selectedQuotation.top_routes?.length > 0 && (
                <section className="saved-detail-section">
                  <div className="saved-detail-heading">
                    <h3>C. Top Routes</h3>
                    <p>Routes returned by the route comparison process.</p>
                  </div>
                  <div className="saved-detail-routes">
                    {selectedQuotation.top_routes.map((route) => (
                      <div className={route.route_id === selectedQuotation.route_id ? "saved-detail-route selected" : "saved-detail-route"} key={route.route_id}>
                        <div>
                          <strong>#{route.rank} &nbsp; {route.route_id}</strong>
                          {route.route_id === selectedQuotation.route_id && <span>Selected</span>}
                        </div>
                        <div>
                          <small>Score: {Number(route.route_score || 0).toFixed(2)}</small>
                          <strong>${formatCurrency(route.base_freight_usd)} /container</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {String(selectedQuotation.status || "").toLowerCase() === "approved" && (
                <div className="saved-detail-status saved-detail-approved">
                  <strong>✓ Approved</strong>
                  <span>Your quotation has been approved by admin.</span>
                </div>
              )}

              {String(selectedQuotation.status || "").toLowerCase() === "rejected" && (
                <div className="saved-detail-status saved-detail-rejected">
                  <strong>✕ Rejected</strong>
                  <span>Your quotation was rejected by admin.</span>
                </div>
              )}

              {String(selectedQuotation.status || "").toLowerCase() === "pending" && (
                <div className="saved-detail-status saved-detail-pending">
                  <strong>◷ Pending Approval</strong>
                  <span>Your quotation is waiting for admin review.</span>
                </div>
              )}

              {String(selectedQuotation.status || "").toLowerCase() === "saved" && (
                <div className="saved-detail-actions">
                  <button
                    type="button"
                    className="request-approval-button"
                    disabled={approvalLoading === selectedQuotation.quotation_id}
                    onClick={async () => {
                      await handleRequestApproval(selectedQuotation.quotation_id);
                      const refreshedUser = currentUser || (await fetchCurrentUser());
                      if (refreshedUser) await fetchSavedQuotations(refreshedUser);
                      setSelectedQuotation(null);
                    }}
                  >
                    {approvalLoading === selectedQuotation.quotation_id ? "Submitting..." : "Request Approval"}
                  </button>
                  <button
                    type="button"
                    className="remove-quotation-button"
                    disabled={removingQuotationId === (selectedQuotation.id ?? selectedQuotation.saved_quotation_id)}
                    onClick={async () => {
                      await handleRemoveQuotation(selectedQuotation);
                      setSelectedQuotation(null);
                    }}
                  >
                    {removingQuotationId === (selectedQuotation.id ?? selectedQuotation.saved_quotation_id) ? "Removing..." : "Remove"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SavedQuotations;