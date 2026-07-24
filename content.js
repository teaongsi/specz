function extractProduct() {
  const title =
    document.querySelector("[data-spm-anchor-id] h1")?.innerText?.trim() ||
    document.querySelector("h1")?.innerText?.trim() ||
    document.title?.trim() ||
    "";

  const priceText =
    document.querySelector(".pdp-price_type_normal")?.innerText ||
    document.querySelector(".product-price")?.innerText ||
    document.body.innerText.match(/Rs\.?\s?[\d,]+/)?.[0] ||
    "0";

  const price = parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0;

  return { title, price };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "EXTRACT_PRODUCT") return;

  sendResponse(extractProduct());
  return true;
});
