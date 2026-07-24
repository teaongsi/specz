const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeDarazProduct(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });
console.log(data.includes("pdp-price"));
console.log(data.substring(0, 500));
  const $ = cheerio.load(data);

//   const title = $(".pdp-mod-product-badge-title")
//     .text()
//     .trim();

//   const priceText = $(".pdp-price_type_normal")
//     .first()
//     .text()
//     .trim();
const priceElements = $(
  '[class*="pdp-price"]'
).map((i, el) => ({
  text: $(el).text().trim(),
  class: $(el).attr("class")
})).get();

console.log("DARAZ PRICE ELEMENTS:", priceElements);

console.log("ITTI PRICE ELEMENTS:", priceElements);

  return {
    title,
    price,
    source: "Daraz",
    url,
  };
}

module.exports = scrapeDarazProduct;