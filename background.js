try {
  importScripts(
    "./utils/ai.js",
    "./utils/matcher.js",
    "./utils/storage.js"
  );
} catch (e) {
  console.error("Import failed:", e);
}

console.log("Specz Worker Running");

chrome.runtime.onMessage.addListener(
  (msg, sender, sendResponse) => {
    if (msg?.type !== "PRODUCT_DATA") return;

    handleProduct(msg.payload)
      .then(sendResponse)
      .catch(error => {
        console.error("Worker error:", error);
        sendResponse(fallback(msg.payload));
      });

    return true;
  }
);

async function handleProduct(product) {
  try {
    if (!product?.title) {
      throw new Error("Invalid product");
    }

    const competitors = await fetchCompetitors(product);
    console.log("COMPETITORS:", competitors);

    const allProducts = [
      product,
      ...competitors
    ];

    const validProducts = allProducts.filter(
      item =>
        item &&
        item.title &&
        Number(item.price) > 0
    );

    const cheapest = getCheapest(validProducts) || product;

    const savings = calcSavings(
      product.price,
      cheapest?.price
    );

    return {
      product,
      matches: competitors,
      cheapest,
      savings,
      valueAnalysis: "Comparison completed",
      review: "Price comparison completed successfully"
    };

  } catch (error) {
    console.error(error);
    return fallback(product);
  }
}

async function fetchCompetitors(product) {
  const response = await fetch(
    "http://localhost:3000/api/compare",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        currentProduct: product
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Comparison API failed: ${response.status}`
    );
  }

  const data = await response.json();
  console.log("BACKEND DATA:", data);

  return data.products || [];
}

function getCheapest(products) {
  if (!products || !products.length) return null;

  return products.reduce(
    (cheapest, product) =>
      Number(product.price) < Number(cheapest.price)
        ? product
        : cheapest
  );
}

function calcSavings(original, cheapest) {
  const orig = Number(original);
  const cheap = Number(cheapest);

  if (!orig || !cheap || cheap >= orig) return 0;

  return Math.round(
    ((orig - cheap) / orig) * 100
  );
}

function fallback(product) {
  return {
    product,

    matches: [],

    cheapest: product,

    savings: 0,

    valueAnalysis:
      "No comparison data available",

    review:
      "Could not compare this product"
  };
}