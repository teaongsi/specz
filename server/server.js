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

function extractSearchQuery(title) {
  if (!title) return "laptop";
  let clean = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*/g, "");
  clean = clean.replace(
    /\b(ram|ssd|hdd|fhd|wuxga|oled|display|laptop|intel|core|ryzen|amd|gen|gb|tb|14"|15\.6"|16")\b/gi,
    ""
  );
  const words = clean
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1);
  return words.slice(0, 3).join(" ") || title.split(" ").slice(0, 3).join(" ");
}

const app = express();

app.use(cors());
app.use(express.json());

// app.post("/api/compare", async (req, res) => {
//   try {
//     console.log("BODY RECEIVED:", req.body);

//     const {
//       currentProduct,
//       ittiUrl,
//       hukutUrl
//     } = req.body;

//     const products = [];

//     if (ittiUrl) {
//       const ittiProduct = await scrapeIttiProduct(ittiUrl);
//       if (ittiProduct) products.push(ittiProduct);
//     }

//     if (hukutUrl) {
//       const hukutProduct = await scrapeHukutProduct(hukutUrl);
//       if (hukutProduct) products.push(hukutProduct);
//     }

//     if (!ittiUrl && !hukutUrl && currentProduct?.title) {
//       const query = extractSearchQuery(currentProduct.title);
//       console.log("DYNAMIC SEARCH QUERY:", query);

//       const [ittiResults, hukutResults] = await Promise.all([
//         searchIttiProducts(query).catch(err => {
//           console.error("ITTI Search err:", err.message);
//           return [];
//         }),
//         searchHukutProducts(query).catch(err => {
//           console.error("Hukut Search err:", err.message);
//           return [];
//         })
//       ]);

//       if (ittiResults.length) products.push(...ittiResults);
//       if (hukutResults.length) products.push(...hukutResults);
//     }

//     console.log("SCRAPED & MATCHED PRODUCTS:", products);

//     res.json({
//       products
//     });

//   } catch (error) {
//     console.error("BACKEND ERROR:", error);

//     res.status(500).json({
//       error: error.message
//     });
//   }
// });
app.post("/api/compare", async (req, res) => {
  try {
    console.log("BODY RECEIVED:", req.body);

    const { currentProduct, ittiUrl, hukutUrl } = req.body;

    const products = [];

    // Scrape the exact current page if URLs are given (for accurate current price/title)
    if (ittiUrl) {
      const ittiProduct = await scrapeIttiProduct(ittiUrl);
      if (ittiProduct) products.push(ittiProduct);
    }

    if (hukutUrl) {
      const hukutProduct = await scrapeHukutProduct(hukutUrl);
      if (hukutProduct) products.push(hukutProduct);
    }

    // ALWAYS also search other sites for matches, using the title we have
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

      const results = await Promise.all(searches);
      results.forEach(r => { if (r.length) products.push(...r); });
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