const express = require("express");
const cors = require("cors");

const {
  scrapeIttiProduct,
  searchIttiProducts
} = require("./scrappers/itti");

const {
  scrapeHukutProduct,
  searchHukutProducts
} = require("./scrappers/hukut");

const {
  scrapeEvoProduct,
  searchEvoProducts
} = require("./scrappers/evo");

function extractSearchQuery(title) {
  if (!title) return "laptop";

  let clean = title
    .replace(/\[.*?\]/g, " ")
    .replace(/\|.*/g, " ");

  // Pull out anything inside parens BEFORE stripping the parens themselves —
  // model numbers/SKUs often live in there (e.g. "(AL15-41)")
  const parenContents = [...title.matchAll(/\(([^)]*)\)/g)].map(m => m[1]);
  clean = clean.replace(/\(.*?\)/g, " ");

  clean = clean.replace(
    /\b(ram|ssd|hdd|fhd|wuxga|oled|display|laptop|intel|core|ryzen|amd|gen|gb|tb|inch|warranty|year|graphics|integrated)\b/gi,
    " "
  );

  // Grab likely model/SKU tokens (contain digits) from anywhere in title or parens
  const allText = `${clean} ${parenContents.join(" ")}`;
  const tokens = allText
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 1);

  const modelTokens = tokens.filter(t => /\d/.test(t));
  const wordTokens = tokens.filter(t => !/\d/.test(t));

  // Build query: brand/series words first, then the model/SKU number if found
  const query = [...wordTokens.slice(0, 2), ...modelTokens.slice(0, 1)]
    .filter(Boolean)
    .join(" ");

  return query || title.split(" ").slice(0, 3).join(" ");
}

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/compare", async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body);

    const {
      currentProduct,
      ittiUrl,
      hukutUrl,
      evoUrl
    } = req.body;

    const products = [];

    // Scrape exact current page if a direct URL was given (accurate current price)
    if (ittiUrl) {
      const ittiProduct = await scrapeIttiProduct(ittiUrl);
      if (ittiProduct) products.push(ittiProduct);
    }

    if (hukutUrl) {
      const hukutProduct = await scrapeHukutProduct(hukutUrl);
      if (hukutProduct) products.push(hukutProduct);
    }

    if (evoUrl) {
      const evoProduct = await scrapeEvoProduct(evoUrl);
      if (evoProduct) products.push(evoProduct);
    }

    // ALWAYS search the other sites too, regardless of which site the user is on
    if (currentProduct?.title) {
      const query = extractSearchQuery(currentProduct.title);
      console.log("DYNAMIC SEARCH QUERY:", query);

      const searches = [];

      if (!ittiUrl) searches.push(
        searchIttiProducts(query).catch(err => {
          console.error("ITTI Search err:", err.message);
          return [];
        })
      );

      if (!hukutUrl) searches.push(
        searchHukutProducts(query).catch(err => {
          console.error("Hukut Search err:", err.message);
          return [];
        })
      );

      if (!evoUrl) searches.push(
        searchEvoProducts(query).catch(err => {
          console.error("Evo Store Search err:", err.message);
          return [];
        })
      );

      const results = await Promise.all(searches);
      results.forEach(r => {
        if (r.length) products.push(...r);
      });
    }

    console.log("SCRAPED & MATCHED PRODUCTS:", products);

    res.json({ products });

  } catch (error) {
    console.error("BACKEND ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Specz API running on port 3000");
});