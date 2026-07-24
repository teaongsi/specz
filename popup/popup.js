let currentData = null;

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");

function showTab(tab) {
  ["compare", "ai", "saved"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );

  document.querySelectorAll("nav button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  document.getElementById(tab).classList.remove("hidden");

  if (tab === "saved") renderSaved();
}

function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  if (isLoading) errorEl.classList.add("hidden");
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
  ["compare", "ai", "saved"].forEach(id =>
    document.getElementById(id).classList.add("hidden")
  );
}

function renderCompare() {
  if (!currentData) return;

  const { product, cheapest, savings, matches } = currentData;

  const matchRows = matches && matches.length
    ? matches
        .map(
          m => `
      <div class="match-row">
        <span>${escapeHtml(m.title)}</span>
        <span>Rs ${Number(m.price || 0).toLocaleString()}</span>
      </div>
      <div class="match-source">${escapeHtml(m.source || m.store || "")}</div>`
        )
        .join("")
    : "<p>No matching listings found.</p>";

  const cheapObj = cheapest || product;
  const isCurrentCheapest = Number(cheapObj.price) === Number(product.price);

  document.getElementById("compare").innerHTML = `
    <p><b>${escapeHtml(product.title)}</b></p>
    <p>Rs ${Number(product.price || 0).toLocaleString()}</p>
    <hr/>
    <p class="text-green">
      Cheapest: Rs ${Number(cheapObj.price || 0).toLocaleString()}
      ${cheapObj.source || cheapObj.store ? ` (${escapeHtml(cheapObj.source || cheapObj.store)})` : ""}
    </p>
    <p>${isCurrentCheapest ? "Best Price Available!" : `Save ${savings}%`}</p>
    <hr/>
    <p><b>Matches (${matches ? matches.length : 0})</b></p>
    ${matchRows}
    <button id="saveBtn">Save to wishlist</button>
  `;

  document.getElementById("saveBtn")?.addEventListener("click", saveItem);
}

function renderAI() {
  if (!currentData) return;

  document.getElementById("ai").innerHTML = `
    <p class="text-blue">Value Analysis</p>
    <p>${escapeHtml(currentData.valueAnalysis)}</p>
    <hr/>
    <p class="text-purple">AI Review</p>
    <pre>${escapeHtml(currentData.review)}</pre>
  `;
}

function renderAll() {
  renderCompare();
  renderAI();
  showTab("compare");
}

function saveItem() {
  if (!currentData?.product) return;

  chrome.storage.local.get(["wishlist"], res => {
    const list = res.wishlist || [];
    list.push(currentData.product);
    chrome.storage.local.set({ wishlist: list });
  });
}

function renderSaved() {
  chrome.storage.local.get(["wishlist"], res => {
    const list = res.wishlist || [];

    document.getElementById("saved").innerHTML = list.length
      ? list.map(i => `<p>${escapeHtml(i.title)} — Rs ${Number(i.price).toLocaleString()}</p>`).join("")
      : "<p>No saved items yet.</p>";
  });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// async function extractFromActiveTab() {
//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//   if (!tab?.id) throw new Error("No active tab found.");

//   const extract = () =>
//     chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PRODUCT" });

//   try {
//     return await extract();
//   } catch {
//     try {
//       await chrome.scripting.executeScript({
//         target: { tabId: tab.id },
//         files: ["content.js"]
//       });
//       return await extract();
//     } catch {
//       throw new Error("Could not read this page. Open a product page on a supported store and try again.");
//     }
//   }
// }
async function extractFromActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  const extract = () =>
    chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_PRODUCT"
    });

  try {
    const product = await extract();

    console.log("EXTRACTED PRODUCT FROM CONTENT:", product);

    return product;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const product = await extract();

      console.log(
        "EXTRACTED PRODUCT AFTER INJECTION:",
        product
      );

      return product;
    } catch {
      throw new Error(
        "Could not read this page. Open a product page on a supported store and try again."
      );
    }
  }
}

async function analyzeProduct() {
  const analyzeBtn = document.getElementById("analyzeBtn");
  analyzeBtn.disabled = true;
  setLoading(true);

  try {
    const product = await extractFromActiveTab();
console.log("PRODUCT BEFORE BACKEND:", product);
    if (!product?.title) {
      throw new Error("No product title found on this page.");
    }

    const result = await chrome.runtime.sendMessage({
      type: "PRODUCT_DATA",
      payload: product
    });

    if (!result) {
      throw new Error("No response from background worker.");
    }

    currentData = result;
    setLoading(false);
    renderAll();
  } catch (err) {
    setLoading(false);
    showError(err.message || "Analysis failed.");
  } finally {
    analyzeBtn.disabled = false;
  }
}

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

document.getElementById("analyzeBtn").addEventListener("click", analyzeProduct);

// document.addEventListener("DOMContentLoaded", analyzeProduct);
