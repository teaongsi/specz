const { chromium } = require("playwright");

function parsePrice(text) {
  if (!text) return 0;
  const matches = text.match(/(?:Rs\.?|NRs\.?|NPR|रु\.?)\s*([\d,]+)/gi) || [];
  const valid = [];
  for (const m of matches) {
    const p = parseInt(m.replace(/[^\d]/g, ""), 10);
    if (!isNaN(p) && p > 5000) valid.push(p);
  }
  return valid.length ? Math.min(...valid) : 0;
}

function cleanTitle(rawTitle) {
  if (!rawTitle) return "";
  const lines = rawTitle
    .split("\n")
    .map(l => l.trim())
    .filter(
      l =>
        l &&
        !l.includes("OFF") &&
        !l.includes("Delivery") &&
        !l.includes("Rs ") &&
        !l.includes("Get it")
    );
  return lines.join(" ") || rawTitle;
}

async function searchHukutProducts(query) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const searchUrl = `https://hukut.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const items = await page.$$eval("a[href]", els =>
      els
        .map(a => ({
          rawText: a.innerText ? a.innerText.trim() : "",
          url: a.href
        }))
        .filter(
          x =>
            x.url &&
            x.url.includes("hukut.com/") &&
            !x.url.includes("/search") &&
            !x.url.includes("/cart") &&
            !x.url.includes("pickup") &&
            x.rawText
        )
    );

    const results = [];
    const seenUrls = new Set();

    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);

      const price = parsePrice(item.rawText);
      const title = cleanTitle(item.rawText);

      if (title && price > 0) {
        results.push({
          title,
          price,
          source: "Hukut",
          url: item.url
        });
      }
    }
    return results.slice(0, 3);
  } catch (e) {
    console.error("Hukut search error:", e);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeHukutProduct(url) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page
      .locator("h1")
      .first()
      .innerText()
      .catch(() => "");

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const price = parsePrice(bodyText);

    console.log("HUKUT TITLE:", title);
    console.log("HUKUT PRICE:", price);

    return {
      title: title.trim(),
      price,
      source: "Hukut",
      url
    };
  } catch (error) {
    console.error("Hukut scraper error:", error);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeHukutProduct,
  searchHukutProducts
};