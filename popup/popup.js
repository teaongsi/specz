// popup.js - Specz Extension

let currentData = null;
const STORAGE_KEY = "savedDeals";

// -------------------------
// DOM Elements
// -------------------------
const tabCompare = document.getElementById("tabCompare");
const tabAI = document.getElementById("tabAI");
const tabSaved = document.getElementById("tabSaved");

const compareView = document.getElementById("compareView");
const aiView = document.getElementById("aiView");
const savedView = document.getElementById("savedView");
const savedList = document.getElementById("savedList");

const loading = document.getElementById("loading");
const statusNote = document.getElementById("statusNote");
const errorBox = document.getElementById("error");
const analyzeBtn = document.getElementById("analyzeBtn");

// -------------------------
// Helper Functions
// -------------------------
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text) {
  if (!text) return "";

  let html = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px 0; color: #a78bfa; font-size: 13px; font-weight: 600;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 4px 0; color: #60a5fa; font-size: 14px; font-weight: 700;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="margin: 12px 0 6px 0; color: #f8fafc; font-size: 15px; font-weight: 700;">$1</h2>');

  // Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f8fafc; font-weight: 600;">$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong style="color: #f8fafc; font-weight: 600;">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Bullet Lists
  const lines = html.split('\n');
  let inList = false;
  const resultLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (/^[\-\*\•]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[\-\*\•]\s+/, '');
      if (!inList) {
        resultLines.push('<ul style="margin: 6px 0; padding-left: 18px; list-style-type: disc;">');
        inList = true;
      }
      resultLines.push(`<li style="margin-bottom: 3px; color: #cbd5e1; font-size: 12px;">${content}</li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      resultLines.push(line);
    }
  }
  if (inList) {
    resultLines.push('</ul>');
  }

  let finalHtml = resultLines.join('\n');
  finalHtml = finalHtml.replace(/\n\n/g, '<br style="display: block; margin: 6px 0;">');
  finalHtml = finalHtml.replace(/\n/g, '<br>');
  return finalHtml;
}


function getSaved() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

function saveStorage(data) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
  });
}

// -------------------------
// Navigation Tabs
// -------------------------
function openTab(tab) {
  [tabCompare, tabAI, tabSaved].forEach(btn => btn?.classList.remove("active"));
  [compareView, aiView, savedView].forEach(view => view?.classList.add("hidden"));

  if (tab === "compare") {
    tabCompare?.classList.add("active");
    compareView?.classList.remove("hidden");
  } else if (tab === "ai") {
    tabAI?.classList.add("active");
    aiView?.classList.remove("hidden");
  } else if (tab === "saved") {
    tabSaved?.classList.add("active");
    savedView?.classList.remove("hidden");
    renderSaved();
  }
}

tabCompare?.addEventListener("click", () => openTab("compare"));
tabAI?.addEventListener("click", () => openTab("ai"));
tabSaved?.addEventListener("click", () => openTab("saved"));
analyzeBtn?.addEventListener("click", () => analyzeProduct(true));

// -------------------------
// Extract Product from Tab
// -------------------------
async function extractProductFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id) {
    throw new Error("No active browser tab found.");
  }

  // Attempt messaging content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PRODUCT" });
    if (response && response.title) {
      return { ...response, url: response.url || tab.url };
    }
  } catch (err) {
    // Script not injected yet, attempt scripting injection
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PRODUCT" });
      if (response && response.title) {
        return { ...response, url: response.url || tab.url };
      }
    } catch (injErr) {
      console.warn("Could not inject content script onto page:", injErr);
    }
  }

  // Fallback if tab is not a product page or extraction yielded blank
  if (tab.title && !tab.url?.startsWith("chrome://")) {
    return {
      title: tab.title.replace(/ - Daraz.*| - ITTI.*| - Hukut.*/i, "").trim(),
      price: 0,
      url: tab.url
    };
  }

  throw new Error("Please open a product page on Daraz, ITTI, Hukut, or Oliz.");
}

// -------------------------
// Analyze Product Pipeline
// -------------------------
async function analyzeProduct(forceRefresh = false) {
  try {
    errorBox.classList.add("hidden");
    loading.classList.remove("hidden");
    compareView.classList.add("hidden");
    aiView.classList.add("hidden");
    statusNote.textContent = "Scanning active tab...";

    const product = await extractProductFromTab();

    if (!product || !product.title) {
      throw new Error("No product details detected on this page.");
    }

    statusNote.textContent = "Comparing Nepal stores...";

    const result = await chrome.runtime.sendMessage({
      type: "PRODUCT_DATA",
      payload: product,
      forceRefresh
    });


    currentData = {
      product,
      ...result
    };

    loading.classList.add("hidden");
    statusNote.textContent = "Comparison ready";

    renderCompare();
    renderAI();
    openTab("compare");

  } catch (error) {
    loading.classList.add("hidden");
    statusNote.textContent = "Ready";

    errorBox.classList.remove("hidden");
    errorBox.innerHTML = `
      <strong>Notice:</strong> ${escapeHtml(error.message)}
      <br><small style="opacity:0.8;">Showing market comparison samples below.</small>
    `;

    // Render fallback sample if on empty/unsupported page
    const sampleProduct = {
      title: "Dell Inspiron 15 3520 i5 12th Gen",
      price: 85000,
      url: "https://www.daraz.com.np"
    };

    const result = await chrome.runtime.sendMessage({
      type: "PRODUCT_DATA",
      payload: sampleProduct
    });

    currentData = { product: sampleProduct, ...result };
    renderCompare();
    renderAI();
    compareView.classList.remove("hidden");
  }
}

// -------------------------
// Render Compare Tab
// -------------------------
function renderCompare() {
  if (!currentData) return;

  const { product, matches = [], cheapest = {}, savings = 0 } = currentData;
  const currentPrice = Number(product.price) || 0;
  const cheapestPrice = Number(cheapest.price) || currentPrice;

  let html = `
    <div class="card">
      <div class="card-title">
        <span>${escapeHtml(product.title)}</span>
      </div>
      <div style="margin-top: 6px;">
        <span class="price-badge">Current Price: Rs ${currentPrice > 0 ? currentPrice.toLocaleString() : 'N/A'}</span>
      </div>
    </div>
  `;

  if (cheapestPrice > 0 && cheapestPrice < (currentPrice || Infinity)) {
    html += `
      <div class="card deal-hero">
        <div class="card-title" style="color: #10b981;">
          <span>🏆 Best Deal Available</span>
          <span class="savings-tag">Save ${savings}%</span>
        </div>
        <div style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-top: 4px;">
          Rs ${cheapestPrice.toLocaleString()}
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
          Available at <strong>${escapeHtml(cheapest.source || "Competitor")}</strong>
        </div>
      </div>
    `;
  }

  html += `
    <div class="card">
      <div class="card-title" style="margin-bottom: 8px;">
        <span>Store Comparisons (${matches.length})</span>
      </div>
  `;

  if (matches.length === 0) {
    html += `<div style="color: var(--text-muted); font-size: 12px;">No alternative store listings found for this exact model.</div>`;
  } else {
    html += matches.map(item => `
      <div class="match-item">
        <div style="flex: 1; margin-right: 8px;">
          <div style="font-weight: 600; font-size: 12px;">
            ${item.url && item.url !== "#"
              ? `<a href="#" class="item-link text-link" data-url="${escapeHtml(item.url)}" title="Open Product Page">${escapeHtml(item.title)} 🔗</a>`
              : escapeHtml(item.title)}
          </div>
          <span class="store-tag" style="margin-top: 2px; display: inline-block;">${escapeHtml(item.source || "Store")}</span>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #60a5fa; font-size: 13px;">
            Rs ${Number(item.price).toLocaleString()}
          </div>
        </div>
      </div>
    `).join("");
  }

  html += `
    </div>
    <button id="saveDealBtn" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 10px;">
      ❤️ Save to Wishlist
    </button>
  `;

  compareView.innerHTML = html;
  document.getElementById("saveDealBtn")?.addEventListener("click", saveDeal);

  compareView.querySelectorAll(".item-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetUrl = e.currentTarget.getAttribute("data-url");
      if (targetUrl && targetUrl !== "#") {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  });
}

// -------------------------
// Render AI Tab
// -------------------------
async function renderAI() {
  if (!currentData) return;

  const { structured = {}, valueAnalysis = "", review = "" } = currentData;
  const apiKey = await new Promise(res => {
    chrome.storage.local.get(["groqApiKey", "groq_api_key", "GROQ_API_KEY"], r => {
      res(r.groqApiKey || r.groq_api_key || r.GROQ_API_KEY || "");
    });
  });

  let html = `
    <div class="card">
      <div class="card-title">🤖 AI Spec Breakdown</div>
      <div class="spec-grid">
        <div class="spec-item">
          <div class="spec-label">Brand</div>
          <div class="spec-val">${escapeHtml(structured.brand || "N/A")}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Processor</div>
          <div class="spec-val">${escapeHtml(structured.processor || "N/A")}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Memory</div>
          <div class="spec-val">${escapeHtml(structured.ram || "N/A")}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Storage</div>
          <div class="spec-val">${escapeHtml(structured.storage || "N/A")}</div>
        </div>
        <div class="spec-item" style="grid-column: span 2;">
          <div class="spec-label">Graphics</div>
          <div class="spec-val">${escapeHtml(structured.gpu || "N/A")}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="color: #60a5fa;">💡 Value Verdict</div>
      <div style="font-size: 12px; color: var(--text-main); line-height: 1.5;">${renderMarkdown(valueAnalysis)}</div>
    </div>

    <div class="card">
      <div class="card-title" style="color: #a78bfa;">📝 Specz Review Summary</div>
      <div style="font-size: 12px; color: var(--text-main); line-height: 1.5;">${renderMarkdown(review)}</div>
    </div>


    <div class="api-config">
      <div style="font-weight: 600; font-size: 11px; color: var(--text-muted);">
        ⚡ Groq AI Key: ${apiKey ? '✅ Active (Local Storage)' : '⚠️ Not found in storage'}
      </div>
      ${!apiKey ? '<div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Set via: <code>chrome.storage.local.set({ groqApiKey: "gsk_..." })</code></div>' : ''}
    </div>
  `;

  aiView.innerHTML = html;
}


// -------------------------
// Wishlist Logic
// -------------------------
async function saveDeal() {
  if (!currentData) return;

  const list = await getSaved();
  const deal = {
    id: currentData.product.url || Date.now().toString(),
    title: currentData.product.title,
    price: currentData.product.price,
    url: currentData.product.url || "#",
    savedAt: new Date().toISOString()
  };

  const exists = list.some(item => item.title === deal.title);
  if (exists) {
    alert("Deal is already saved in your wishlist!");
    return;
  }

  list.push(deal);
  await saveStorage(list);
  alert("Saved to wishlist!");
}

async function renderSaved() {
  const list = await getSaved();

  if (list.length === 0) {
    savedList.innerHTML = `
      <div class="empty-state">
        <p>No saved deals yet.</p>
        <small>Click "Save to Wishlist" on any product to bookmark it.</small>
      </div>
    `;
    return;
  }

  savedList.innerHTML = list.map((item, idx) => `
    <div class="saved-row">
      <div style="flex: 1; margin-right: 10px;">
        <div style="font-weight: 600; font-size: 12px; color: var(--text-main);">
          ${item.url && item.url !== "#"
            ? `<a href="#" class="saved-link text-link" data-url="${escapeHtml(item.url)}" title="Open Product Page">${escapeHtml(item.title)} 🔗</a>`
            : escapeHtml(item.title)}
        </div>
        <div style="font-size: 12px; color: #60a5fa; font-weight: 700; margin-top: 2px;">
          Rs ${Number(item.price).toLocaleString()}
        </div>
      </div>
      <button class="btn-delete" data-index="${idx}">🗑️</button>
    </div>
  `).join("");

  savedList.querySelectorAll(".saved-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetUrl = e.currentTarget.getAttribute("data-url");
      if (targetUrl && targetUrl !== "#") {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  });

  savedList.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const idx = parseInt(e.currentTarget.getAttribute("data-index"), 10);
      const currentList = await getSaved();
      currentList.splice(idx, 1);
      await saveStorage(currentList);
      renderSaved();
    });
  });
}


// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  analyzeProduct();
});