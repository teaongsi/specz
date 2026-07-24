// function matchProducts(structured, list) {
//   const brand = structured.brand?.toLowerCase() || "";
//   const model = structured.model?.toLowerCase() || "";

//   return list.filter(item => {
//     const t = (item.title || "").toLowerCase();
//     const brandOk = !brand || brand === "unknown" || fuzzyMatch(t, brand);
//     const modelOk = !model || fuzzyMatch(t, model);
//     return brandOk && modelOk;
//   });
// }

// function fuzzyMatch(text, keyword) {
//   if (!keyword) return true;

//   return keyword
//     .split(" ")
//     .every(k => text.includes(k));
// }

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[|()]/g, " ")
    .replace(/[-_]/g, " ")   // "al15-41" -> "al15 41" so hyphen variants align
    .replace(/\s+/g, " ")
    .trim();
}

// Extract a likely model/SKU token, e.g. "al15-41", "x1404", "7430u"
function extractModelTokens(model) {
  const norm = normalize(model);
  return norm.split(" ").filter(tok => /\d/.test(tok)); // tokens containing digits = likely SKU/spec identifiers
}

function matchProducts(structured, list) {
  const brand = normalize(structured.brand);
  const model = normalize(structured.model);
  const modelTokens = extractModelTokens(structured.model);

  return list.filter(item => {
    const t = normalize(item.title);

    const brandOk = !brand || brand === "unknown" || t.includes(brand);

    // Require the SKU-like tokens to be present (most reliable identifier)
    const skuOk = modelTokens.length
      ? modelTokens.every(tok => t.includes(tok))
      : true;

    // Fallback: general word overlap ratio instead of requiring 100%
    const modelWords = model.split(" ").filter(w => w.length > 1);
    const overlap = modelWords.length
      ? modelWords.filter(w => t.includes(w)).length / modelWords.length
      : 1;

    return brandOk && skuOk && overlap >= 0.6; // 60%+ of words match
  });
}

if (typeof module !== "undefined") {
  module.exports = { matchProducts };
}