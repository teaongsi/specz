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

async function searchIttiProducts(query) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const searchUrl = `https://itti.com.np/search/result?q=${encodeURIComponent(query)}&category_type=search`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);

    const items = await page.$$eval('a[href*="/product/"]', els =>
      els
        .map(a => ({
          title: a.innerText ? a.innerText.trim() : "",
          url: a.href,
          fullText: a.parentElement ? a.parentElement.innerText.trim() : ""
        }))
        .filter(x => x.title && x.url)
    );

    const results = [];
    const seenUrls = new Set();

    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);

      const price = parsePrice(item.fullText);
      if (price > 0) {
        results.push({
          title: item.title,
          price,
          source: "ITTI",
          url: item.url
        });
      }
    }
    return results.slice(0, 3);
  } catch (e) {
    console.error("ITTI search error:", e);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeIttiProduct(url) {
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

    console.log("ITTI TITLE:", title);
    console.log("ITTI PRICE:", price);

    return {
      title: title.trim(),
      price,
      source: "ITTI",
      url
    };
  } catch (error) {
    console.error("ITTI scraper error:", error);
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeIttiProduct,
  searchIttiProducts
};