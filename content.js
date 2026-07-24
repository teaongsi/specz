function extractProduct() {
  const title =
    document.querySelector(".pdp-mod-product-badge-title")?.innerText?.trim() ||
    document.querySelector("[data-spm-anchor-id] h1")?.innerText?.trim() ||
    document.querySelector(".product-title")?.innerText?.trim() ||
    document.querySelector("h1")?.innerText?.trim() ||
    document.title?.trim() ||
    "";

  const priceText =
    document.querySelector(".pdp-price_type_normal")?.innerText ||
    document.querySelector(".pdp-product-price")?.innerText ||
    document.querySelector(".product-price")?.innerText ||
    document.querySelector(".price")?.innerText ||
    document.body.innerText.match(/Rs\.?\s?[\d,]+/)?.[0] ||
    "0";

  const price = parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0;
  const url = window.location.href;

  return { title, price, url };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXTRACT_PRODUCT") {
    sendResponse(extractProduct());
  }
  return true;
});

