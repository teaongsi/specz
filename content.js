// function extractProduct() {
//   const title =
//     document.querySelector("[data-spm-anchor-id] h1")?.innerText?.trim() ||
//     document.querySelector("h1")?.innerText?.trim() ||
//     document.title?.trim() ||
//     "";

//   const priceText =
//     document.querySelector(".pdp-price_type_normal")?.innerText ||
//     document.querySelector(".product-price")?.innerText ||
//     document.body.innerText.match(/Rs\.?\s?[\d,]+/)?.[0] ||
//     "0";

//   const price =
//     parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0;

//   return {
//     title,
//     price,
//     url: window.location.href,
//     source: "Daraz"
//   };
// }
// function extractProduct() {
//   const title =
//     document.querySelector("[data-spm-anchor-id] h1")?.innerText?.trim() ||
//     document.querySelector("h1")?.innerText?.trim() ||
//     document.title?.trim() ||
//     "";

//   const priceElement =
//     document.querySelector(".pdp-price_type_normal") ||
//     document.querySelector(".product-price");

//   const priceText = priceElement?.innerText?.trim() || "";

//   const price = parseInt(
//     priceText.replace(/[^\d]/g, ""),
//     10
//   ) || 0;

//   return {
//     title,
//     price,
//     url: window.location.href,
//     source: "Daraz"
//   };
// }
function extractProduct() {
  const title =
    document.querySelector("[data-spm-anchor-id] h1")?.innerText?.trim() ||
    document.querySelector(".pdp-mod-product-badge-title")?.innerText?.trim() ||
    document.querySelector("h1")?.innerText?.trim() ||
    document.title?.trim() ||
    "";

  let priceText = "";
  const host = window.location.hostname.toLowerCase();

  if (host.includes("hukut.com")) {
    priceText =
      document.querySelector('span[class*="text-2xl"][class*="font-tertiary"][class*="text-gray-900"]')?.innerText ||
      document.querySelector('span[class*="text-2xl"]')?.innerText ||
      "";
  } else if (host.includes("daraz")) {
    priceText =
      document.querySelector(".pdp-price_type_normal")?.innerText ||
      document.querySelector(".product-price")?.innerText ||
      document.querySelector(".pdp-price")?.innerText ||
      document.querySelector('[class*="pdp-price"]')?.innerText ||
      "";
  } else if (host.includes("itti")) {
    priceText =
      document.querySelector(".price-box .price")?.innerText ||
      document.querySelector('[data-price-type="finalPrice"] .price')?.innerText ||
      document.querySelector(".price")?.innerText ||
      "";
  } else if (host.includes("oliz")) {
    priceText =
      document.querySelector(".price-box .price")?.innerText ||
      document.querySelector(".price")?.innerText ||
      "";
  }else if (host.includes("evostore")){
        priceText =
      document.querySelector(".price-box .price")?.innerText ||
      document.querySelector(".price")?.innerText ||
      "";
  }

  if (!priceText) {
    const priceEl = document.querySelector('[class*="price"], [id*="price"]');
    if (priceEl && priceEl.innerText) {
      priceText = priceEl.innerText;
    } else {
      const match = document.body.innerText.match(/(?:Rs\.?|NRs\.?|NPR|रु\.?)\s*([\d,]+)/i);
      if (match) priceText = match[0];
    }
  }

  const price = parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0;

  let source = "Unknown";
  if (host.includes("hukut")) source = "Hukut";
  else if (host.includes("daraz")) source = "Daraz";
  else if (host.includes("itti")) source = "ITTI";
  else if (host.includes("oliz")) source = "Oliz Store";
  else source = host;

  return {
    title,
    price,
    url: window.location.href,
    source
  };
}

chrome.runtime.onMessage.addListener(
  (msg, _sender, sendResponse) => {
    if (msg?.type !== "EXTRACT_PRODUCT") return;

    sendResponse(extractProduct());

    return true;
  }
);