const API_BASE_URL = "http://localhost:8000";

/* =========================================================
   ANALYZE ROUTE
========================================================= */

export async function analyzeRoute({
  origin,
  destination,
  cargo_type,
  containers,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/routes/analyze`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        origin,
        destination,
        cargo_type,
        containers: Number(containers),
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Route analysis failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   GENERATE QUOTATION
========================================================= */

export async function generateQuotation({
  origin,
  destination,
  cargo_type,
  containers,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        origin,
        destination,
        cargo_type,
        containers: Number(containers),
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Quotation generation failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   CALCULATE PRICING
========================================================= */

export async function calculatePricing({
  route_id,
  origin,
  destination,
  cargo_type,
  containers,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/pricing/calculate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        route_id,
        origin,
        destination,
        cargo_type,
        containers: Number(containers),
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Pricing calculation failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   SAVE QUOTATION
========================================================= */

export async function saveQuotation(
  quotationData
) {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(
        quotationData
      ),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Save quotation failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   GET SAVED QUOTATIONS
========================================================= */

export async function getSavedQuotations() {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/saved`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Failed to fetch saved quotations: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   REMOVE SAVED QUOTATION
========================================================= */

export async function removeSavedQuotation(
  quotationId
) {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/saved/${quotationId}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Remove saved quotation failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}


/* =========================================================
   REQUEST QUOTATION APPROVAL
========================================================= */

export async function requestQuotationApproval(
  quotationId
) {
  const response = await fetch(
    `${API_BASE_URL}/api/quotations/${quotationId}/request-approval`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Request Approval API failed: ${response.status}`;

    try {
      const errorData =
        await response.json();

      if (errorData?.detail) {
        errorMessage =
          Array.isArray(errorData.detail)
            ? errorData.detail
                .map((item) => item.msg)
                .join(", ")
            : errorData.detail;
      } else if (errorData?.message) {
        errorMessage =
          errorData.message;
      }
    } catch {}

    throw new Error(errorMessage);
  }

  return await response.json();
}