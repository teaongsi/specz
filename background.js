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
    handleProduct(msg.payload, msg.forceRefresh)
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

async function handleProduct(product, forceRefresh = false) {
  try {
    if (!product?.title) {
      throw new Error("Invalid product input");
    }

    const cacheKey = `specz_v4_${product.title}`;

    // 🔹 CACHE
    if (!forceRefresh) {
      const cached = await getStorage(cacheKey);
      if (cached) return cached;
    }


    // 🔹 AI / REGEX STRUCTURING
    const structured = await normalizeTitleSafe(product.title);
    structured.rawTitle = product.title;

    // 🔹 FETCH DATA
    const competitors = await fetchCompetitors();

    const normalizedCompetitors = (competitors || []).map(item => ({
      title: item.title || "",
      price: Number(item.price) || 0,
      source: item.source || item.store || "Competitor",
      url: item.url || "#"
    }));

    // 🔹 MATCH
    const matches = matchProducts(structured, normalizedCompetitors);

    // 🔹 CHEAPEST
    const cheapest = (matches.length > 0 ? getCheapest(matches) : null) || {
      title: product.title,
      price: product.price,
      source: "Current Page",
      url: product.url || "#"
    };


    // 🔹 SAVINGS
    const originalPrice = Number(product.price) || 0;
    const cheapestPrice = Number(cheapest.price) || originalPrice;
    const savings = calcSavings(originalPrice, cheapestPrice);

    // 🔹 AI ANALYSIS (PARALLEL SAFE)
    const [valueAnalysis, review] = await Promise.allSettled([
      analyzeValueSafe(product, cheapest),
      generateReviewSafe(structured)
    ]);

    const safeValueAnalysis =
      valueAnalysis.status === "fulfilled" && valueAnalysis.value
        ? valueAnalysis.value
        : "Analysis unavailable";

    const safeReview =
      review.status === "fulfilled" && review.value
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

    const items = results
      .filter(r => r.status === "fulfilled" && Array.isArray(r.value))
      .flatMap(r => r.value);

    return items.length > 0 ? items : await fetchMock();

  } catch (e) {
    console.error("❌ fetchCompetitors failed:", e);
    return await fetchMock();
  }
}

async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`http://localhost:3000${endpoint}`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();

  } catch (e) {
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

function getCheapest(list) {
  if (!list || !list.length) return null;

  return list.reduce((min, item) =>
    (Number(item.price) || 0) < (Number(min.price) || 0) ? item : min
  );
}

function calcSavings(original, newPrice) {
  if (!original || !newPrice || original <= newPrice) return 0;

  return Math.round(((original - newPrice) / original) * 100);
}

function fallback(product) {
  const p = product || { title: "Unknown Laptop", price: 0, url: "#" };
  return {
    product: p,
    structured: { brand: "Laptop", model: p.title || "Product" },
    matches: [],
    cheapest: { ...p, source: "Current Page" },
    savings: 0,
    valueAnalysis: "No comparison data available for this product.",
    review: "Open a laptop page on Daraz, ITTI, Hukut, or Oliz to analyze deals."
  };
}