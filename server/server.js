const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

//////////////////////////////////////////////////////
// 🛒 DARAZ SCRAPER
//////////////////////////////////////////////////////

app.get("/api/daraz", async (req, res) => {
  try {
    const url = "https://www.daraz.com.np/catalog/?q=laptop";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(data);

    const products = [];

    $(".Bm3ON").each((i, el) => {
      const text = $(el).text();

      const priceMatch = text.match(/[\d,]+/);

      products.push({
        title: text.trim(),
        price: priceMatch
          ? parseInt(priceMatch[0].replace(/,/g, ""))
          : 0,
        source: "Daraz"
      });
    });

    res.json(products.slice(0, 15));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scraping failed" });
  }
});

//////////////////////////////////////////////////////
// 🛒 ITTI SCRAPER (example)
//////////////////////////////////////////////////////

app.get("/api/itti", async (req, res) => {
  try {
    const { data } = await axios.get("https://itti.com.np/laptops");

    const $ = cheerio.load(data);

    const products = [];

    $(".product-title").each((i, el) => {
      products.push({
        title: $(el).text(),
        price: 0,
        source: "ITTI"
      });
    });

    res.json(products.slice(0, 10));
  } catch {
    res.json([]);
  }
});

//////////////////////////////////////////////////////

app.listen(3000, () => {
  console.log("🚀 Specz API running on http://localhost:3000");
});