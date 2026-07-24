// ✅ SAFE IMPORTS
try {
  importScripts(
    "./utils/ai.js",
    "./utils/matcher.js",
    "./utils/storage.js"
  );
} catch (e) {
  console.error("❌ importScripts failed:", e);
}

console.log("✅ Specz Worker Running");

// ✅ MESSAGE LISTENER
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PRODUCT_DATA") {
    handleProduct(msg.payload)
      .then(sendResponse)
      .catch(err => {
        console.error("❌ handleProduct crash:", err);
        sendResponse(fallback(msg.payload));
      });

    return true;
  }
});

//////////////////////////////////////////////////////////
// 🚀 MAIN PIPELINE
//////////////////////////////////////////////////////////

async function handleProduct(product) {
  try {
    if (!product?.title) {
      throw new Error("Invalid product input");
    }

    const cacheKey = `specz_${product.title}`;

    // 🔹 CACHE
    const cached = await getStorage(cacheKey);
    if (cached) return cached;

    // 🔹 AI STRUCTURING
    const structured = await normalizeTitleSafe(product.title);

    // 🔹 FETCH DATA
    const competitors = await fetchCompetitors();

    if (!Array.isArray(competitors)) {
      throw new Error("Invalid competitors data");
    }

    // 🔹 MATCH
    const matches = matchProducts(structured, competitors);

    if (!matches.length) {
      return fallback(product);
    }

    // 🔹 CHEAPEST
    const cheapest = getCheapest(matches);
    if (!cheapest) {
      return fallback(product);
    }

    // 🔹 SAVINGS
    const originalPrice = Number(product.price) || 0;
    const cheapestPrice = Number(cheapest.price) || 0;
    const savings = calcSavings(originalPrice, cheapestPrice);

    // 🔹 AI ANALYSIS (PARALLEL SAFE)
    const [valueAnalysis, review] = await Promise.allSettled([
      analyzeValueSafe(product, cheapest),
      generateReviewSafe(structured)
    ]);

    const safeValueAnalysis =
      valueAnalysis.status === "fulfilled"
        ? valueAnalysis.value
        : "Analysis unavailable";

    const safeReview =
      review.status === "fulfilled"
        ? review.value
        : "Review unavailable";

    const result = {
      product,
      structured,
      matches,
      cheapest,
      savings,
      valueAnalysis: safeValueAnalysis,
      review: safeReview
    };

    // 🔹 CACHE STORE (non-blocking)
    setStorage(cacheKey, result).catch(() => {});

    return result;

  } catch (err) {
    console.error("❌ Worker Error:", err);
    return fallback(product);
  }
}

//////////////////////////////////////////////////////////
// 🌐 DATA LAYER
//////////////////////////////////////////////////////////

async function fetchCompetitors() {
  try {
    const results = await Promise.allSettled([
      fetchAPI("/api/daraz"),
      fetchAPI("/api/itti"),
      fetchMock()
    ]);

    return results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value);

  } catch (e) {
    console.error("❌ fetchCompetitors failed:", e);
    return fetchMock();
  }
}

async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`http://localhost:3000${endpoint}`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();

  } catch (e) {
    console.error("❌ API error:", endpoint, e);
    return [];
  }
}

async function fetchMock() {
  try {
    const res = await fetch(chrome.runtime.getURL("data/mockData.json"));
    return await res.json();
  } catch (e) {
    console.error("❌ Mock fetch failed:", e);
    return [];
  }
}

//////////////////////////////////////////////////////////
// 🧰 HELPERS
//////////////////////////////////////////////////////////

function extractPrice(text) {
  if (!text) return 0;

  const match = text.toString().match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, "")) : 0;
}

function getCheapest(list) {
  if (!list.length) return null;

  return list.reduce((min, item) =>
    (Number(item.price) || 0) < (Number(min.price) || 0) ? item : min
  );
}

function calcSavings(original, newPrice) {
  if (!original || !newPrice) return 0;

  return Math.round(((original - newPrice) / original) * 100);
}

function fallback(product) {
  return {
    product,
    structured: { brand: "Unknown", model: product?.title || "" },
    matches: [],
    cheapest: product,
    savings: 0,
    valueAnalysis: "No comparison data available",
    review: "Try another product or source"
  };
}