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
              Saved Quotations
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
              Saved Quotations
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
  // MAIN PAGE
  // =========================================================

  return (
    <div className="saved-quotations-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="saved-quotations-header">
        <div>
          <h1>
            Saved Quotations
          </h1>

          <p>
            View and review your previously
            saved freight quotations.
          </p>
        </div>

        {quotations.length > 0 && (
          <button
            type="button"
            className="download-quotation-pdf-button"
            onClick={
              handleDownloadPDF
            }
            disabled={
              pdfLoading
            }
          >
            {pdfLoading
              ? "Generating PDF..."
              : "Download PDF"}
          </button>
        )}
      </div>

      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {approvalMessage && (
        <div className="saved-quotations-message success">
          {approvalMessage}
        </div>
      )}

      {/* =====================================================
          ERROR MESSAGE
      ===================================================== */}

      {approvalError && (
        <div className="saved-quotations-message error">
          {approvalError}
        </div>
      )}

      {/* =====================================================
          EMPTY STATE
      ===================================================== */}

      {quotations.length === 0 ? (
        <div className="saved-quotations-empty">
          <div className="empty-icon">
            📄
          </div>

          <h2>
            No Saved Quotations
          </h2>

          <p>
            You have not saved any
            quotations yet.
          </p>
        </div>
      ) : (
        <div className="saved-quotations-list">

          {quotations.map(
            (quotation) => {

              // =================================================
              // SELECTED ROUTE
              // =================================================

              const selectedRoute =
                quotation.top_routes?.find(
                  (route) =>
                    route.route_id ===
                    quotation.route_id
                );

              // =================================================
              // BASE FREIGHT
              // =================================================

              const baseFreight =
                Number(
                  selectedRoute?.base_freight_usd ??
                    quotation.base_freight_usd ??
                    quotation.freight_per_container_usd ??
                    0
                ) || 0;

              // =================================================
              // PRICING
              // =================================================

              const pricing =
                quotation.pricing ||
                {};

              // =================================================
              // STATUS
              // =================================================

              const status =
                String(
                  quotation.status ||
                    ""
                )
                  .toLowerCase()
                  .trim();

              const statusLabel =
                getStatusLabel(
                  status
                );

              // =================================================
              // APPROVAL BUTTON
              // =================================================

              const canRequestApproval =
                status === "saved";

              const isApprovalLoading =
                approvalLoading ===
                quotation.quotation_id;

              // =================================================
              // REMOVE ID
              // =================================================

              const savedQuotationId =
                quotation.id ??
                quotation.saved_quotation_id;

              const isRemoving =
                removingQuotationId ===
                savedQuotationId;

              return (
                <div
                  className="saved-quotation-card"
                  key={
                    quotation.id ??
                    quotation.quotation_id
                  }
                >

                  {/* =========================================
                      CARD HEADER
                  ========================================= */}

                  <div className="saved-quotation-card-header">

                    <div className="quotation-header-info">

                      <h2>
                        {quotation.origin}
                        {" → "}
                        {quotation.destination}
                      </h2>

                      <p>
                        Quotation #
                        {quotation.quotation_id}
                      </p>

                    </div>

                    {/* =======================================
                        STATUS
                    ======================================= */}

                    <span
                      className={`quotation-status quotation-status-${
                        status ||
                        "saved"
                      }`}
                    >
                      {statusLabel}
                    </span>

                  </div>

                  {/* =========================================
                      REMOVE BUTTON
                  ========================================= */}

                  <div className="saved-quotation-remove-section">

                    <button
                      type="button"
                      className="remove-quotation-button"
                      onClick={() =>
                        handleRemoveQuotation(
                          quotation
                        )
                      }
                      disabled={
                        isRemoving
                      }
                    >
                      {isRemoving
                        ? "Removing..."
                        : "Remove"}
                    </button>

                  </div>

                  {/* =========================================
                      APPROVED MESSAGE
                  ========================================= */}

                  {status ===
                    "approved" && (
                    <div className="quotation-approved-message">
                      <strong>
                        ✓ Approved
                      </strong>

                      <span>
                        Your quotation has been approved
                        and processed for the next level.
                      </span>
                    </div>
                  )}

                  {/* =========================================
                      PENDING MESSAGE
                  ========================================= */}

                  {status ===
                    "pending" && (
                    <div className="quotation-pending-message">
                      <strong>
                        ⏳ Pending Approval
                      </strong>

                      <span>
                        Your quotation is currently
                        waiting for admin approval.
                      </span>
                    </div>
                  )}

                  {/* =========================================
                      REJECTED MESSAGE
                  ========================================= */}

                  {status ===
                    "rejected" && (
                    <div className="quotation-rejected-message">
                      <strong>
                        ✕ Rejected
                      </strong>

                      <span>
                        Your quotation was rejected
                        by admin.
                      </span>
                    </div>
                  )}

                  {/* =========================================
                      SIX KEY QUOTATION DETAILS
                  ========================================= */}

                  <div className="saved-quotation-details six-detail-cards">

                    <div className="quotation-detail">
                      <span>
                        Route ID
                      </span>

                      <strong>
                        {quotation.route_id ||
                          "—"}
                      </strong>
                    </div>

                    <div className="quotation-detail">
                      <span>
                        Cargo Type
                      </span>

                      <strong>
                        {quotation.cargo_type ||
                          "—"}
                      </strong>
                    </div>

                    <div className="quotation-detail">
                      <span>
                        Containers
                      </span>

                      <strong>
                        {quotation.containers ??
                          "—"}
                      </strong>
                    </div>

                    <div className="quotation-detail">
                      <span>
                        Base Cost
                      </span>

                      <strong>
                        {baseFreight > 0
                          ? `$${formatCurrency(
                              baseFreight
                            )}`
                          : "—"}
                      </strong>
                    </div>

                    <div className="quotation-detail">
                      <span>
                        Transit Time
                      </span>

                      <strong>
                        {quotation.transit_days !=
                        null
                          ? `${quotation.transit_days} days`
                          : "—"}
                      </strong>
                    </div>

                    <div className="quotation-detail">
                      <span>
                        Distance
                      </span>

                      <strong>
                        {quotation.distance_nm !=
                        null
                          ? `${Number(
                              quotation.distance_nm
                            ).toLocaleString(
                              "en-US"
                            )} NM`
                          : "—"}
                      </strong>
                    </div>

                  </div>

                  {/* =========================================
                      TOP ROUTES
                  ========================================= */}

                  {quotation.top_routes &&
                    quotation.top_routes.length >
                      0 && (
                    <div className="saved-quotation-section">

                      <h3>
                        Top Routes
                      </h3>

                      <div className="saved-route-list">

                        {quotation.top_routes.map(
                          (route) => {

                            const isSelected =
                              route.route_id ===
                              quotation.route_id;

                            return (
                              <div
                                className={`saved-route-item ${
                                  isSelected
                                    ? "selected-route"
                                    : ""
                                }`}
                                key={
                                  route.route_id
                                }
                              >

                                <div className="saved-route-left">

                                  <span className="route-rank">
                                    #{route.rank}
                                  </span>

                                  <strong>
                                    {route.route_id}
                                  </strong>

                                  {isSelected && (
                                    <span className="selected-label">
                                      Selected
                                    </span>
                                  )}

                                </div>

                                <div className="route-cost">

                                  <span>
                                    Score:{" "}
                                    {Number(
                                      route.route_score ||
                                        0
                                    ).toFixed(
                                      2
                                    )}
                                  </span>

                                  <strong>
                                    $
                                    {formatCurrency(
                                      route.base_freight_usd
                                    )}

                                    <small>
                                      /container
                                    </small>
                                  </strong>

                                </div>

                              </div>
                            );
                          }
                        )}

                      </div>
                    </div>
                  )}

                  {/* =========================================
                      QUOTATION SUMMARY
                  ========================================= */}

                  <div className="saved-quotation-section quotation-summary-section">

                    <h3>
                      Quotation Summary
                    </h3>

                    <div className="saved-summary-grid">

                      {/* =====================================
                          SELLING PRICE
                      ===================================== */}

                      <div className="saved-summary-card">

                        <span>
                          Selling Price
                        </span>

                        <strong className="summary-price">
                          {quotation.final_selling_price_usd !=
                          null
                            ? `$${formatCurrency(
                                quotation.final_selling_price_usd
                              )}`
                            : quotation.selling_price !=
                              null
                            ? `$${formatCurrency(
                                quotation.selling_price
                              )}`
                            : pricing?.final_selling_price_usd !=
                              null
                            ? `$${formatCurrency(
                                pricing.final_selling_price_usd
                              )}`
                            : "—"}
                        </strong>

                      </div>

                      {/* =====================================
                          WEATHER CONDITION
                      ===================================== */}

                      <div className="saved-summary-card">

                        <span>
                          Weather Condition
                        </span>

                        <strong className="summary-weather">
                          {quotation.weather_condition ||
                            "—"}
                        </strong>

                      </div>

                      {/* =====================================
                          CUSTOMS STATUS
                      ===================================== */}

                      <div className="saved-summary-card">

                        <span>
                          Customs Status
                        </span>

                        <strong
                          className={`summary-customs summary-customs-${
                            String(
                              quotation.customs_status ||
                                ""
                            )
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                          }`}
                        >
                          {quotation.customs_status ||
                            "—"}
                        </strong>

                      </div>

                    </div>
                  </div>

                  {/* =========================================
                      REQUEST APPROVAL
                  ========================================= */}

                  {canRequestApproval && (
                    <div className="quotation-approval-section">

                      <button
                        type="button"
                        className="request-approval-button"
                        disabled={
                          isApprovalLoading
                        }
                        onClick={() =>
                          handleRequestApproval(
                            quotation.quotation_id
                          )
                        }
                      >
                        {isApprovalLoading
                          ? "Submitting..."
                          : "Request Approval"}
                      </button>

                      <p className="quotation-approval-note">
                        Submit this quotation to the
                        admin for review and approval.
                      </p>

                    </div>
                  )}

                  {/* =========================================
                      PENDING APPROVAL STATUS
                  ========================================= */}

                  {status ===
                    "pending" && (
                    <div className="quotation-approval-status">

                      <strong>
                        Approval Requested
                      </strong>

                      <span>
                        Waiting for admin review.
                      </span>

                    </div>
                  )}

                  {/* =========================================
                      SAVED DATE
                  ========================================= */}

                  <div className="saved-quotation-footer">

                    <span>
                      Saved on{" "}
                      {quotation.saved_at
                        ? new Date(
                            quotation.saved_at
                          ).toLocaleString()
                        : "—"}
                    </span>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

    </div>
  );
}

export default SavedQuotations;