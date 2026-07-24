const { chromium } = require("playwright");

function parsePrice(text) {
  if (!text) return 0;
  const matches = text.match(/(?:Rs\.?|NRs\.?|NPR)\s*([\d,]+)/gi) || [];
  const valid = [];
  for (const m of matches) {
    const p = parseInt(m.replace(/[^\d]/g, ""), 10);
    if (!isNaN(p) && p > 500) valid.push(p);
  }
  return valid.length ? Math.min(...valid) : 0;
}

async function searchEvoProducts(query) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Standard OpenCart search route
    const searchUrl = `https://evostore.com.np/index.php?route=product/search&search=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    // OpenCart product grid is typically ".product-thumb" or ".product-layout"
    // VERIFY these selectors in DevTools before relying on this
    const items = await page.$$eval(".product-thumb, .product-layout", els =>
      els.map(el => ({
        title: el.querySelector("h4 a, .caption a, .name a")?.innerText?.trim() || "",
        url: el.querySelector("h4 a, .caption a, .name a")?.href || "",
        priceText: el.querySelector(".price-view-setion")?.innerText || ""
      })).filter(x => x.title && x.url)
    );

    const results = [];
    const seenUrls = new Set();

    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);

      const price = parsePrice(item.priceText);
      if (price > 0) {
        results.push({
          title: item.title,
          price,
          source: "Evo Store",
          url: item.url
        });
      }
    }
    return results.slice(0, 3);
  } catch (e) {
    console.error("Evo Store search error:", e);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeEvoProduct(url) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.locator("h1").first().innerText().catch(() => "");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const price = parsePrice(bodyText);

    return { title: title.trim(), price, source: "Evo Store", url };
  } catch (error) {
    console.error("Evo Store scraper error:", error);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeEvoProduct, searchEvoProducts };