const API_BASE_URL = "http://localhost:8000";

// =========================================================
// COMMON API HELPER
// =========================================================

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
        data.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

// =========================================================
// ANALYZE ROUTE
// =========================================================

export async function analyzeRoute(payload) {
  return apiRequest("/api/routes/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =========================================================
// GENERATE QUOTATION
// =========================================================

export async function generateQuotation(payload) {
  return apiRequest("/api/quotations/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =========================================================
// CALCULATE PRICING
// =========================================================

export async function calculatePricing(payload) {
  return apiRequest("/api/pricing/calculate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =========================================================
// SAVE QUOTATION
// =========================================================

export async function saveQuotation(payload) {
  return apiRequest("/api/quotations/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =========================================================
// GET SAVED QUOTATIONS
// =========================================================

export async function getSavedQuotations(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  return apiRequest(
    `/api/quotations/saved/${encodeURIComponent(userId)}`,
    {
      method: "GET",
    }
  );
}

// =========================================================
// REMOVE SAVED QUOTATION
// IMPORTANT: Pass SavedQuotation.id, not quotation_id.
// =========================================================

export async function removeSavedQuotation(savedQuotationId) {
  if (!savedQuotationId) {
    throw new Error("Saved quotation ID is required.");
  }

  return apiRequest(
    `/api/quotations/saved/${encodeURIComponent(savedQuotationId)}`,
    {
      method: "DELETE",
    }
  );
}

// =========================================================
// REQUEST QUOTATION APPROVAL
// IMPORTANT: Pass QuotationRequestDB.id.
// =========================================================

export async function requestQuotationApproval(quotationId) {
  if (!quotationId) {
    throw new Error("Quotation ID is required.");
  }

  return apiRequest(
    `/api/quotations/${encodeURIComponent(quotationId)}/request-approval`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}