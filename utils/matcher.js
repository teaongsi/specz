const KNOWN_BRANDS = [
  "apple", "macbook", "dell", "hp", "lenovo", "asus", "acer", "msi", "samsung", "razer", "gigabyte", "microsoft", "lg"
];

const LAPTOP_SERIES = [
  "vivobook", "zenbook", "tuf", "rog", "strix",
  "ideapad", "thinkpad", "legion", "loq", "thinkbook",
  "inspiron", "vostro", "xps", "alienware",
  "victus", "pavilion", "omen", "spectre", "envy",
  "nitro", "predator", "swift", "aspire"
];

function extractBrand(title) {
  if (!title) return "";
  const t = title.toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (t.includes(b)) return b === "macbook" ? "apple" : b;
  }
  return "";
}

function extractSeries(title) {
  if (!title) return "";
  const t = title.toLowerCase();
  for (const s of LAPTOP_SERIES) {
    if (t.includes(s)) return s;
  }
  return "";
}

function matchProducts(structured, list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const rawTitle = (structured.rawTitle || structured.title || structured.model || "").toLowerCase().trim();
  const searchBrand = extractBrand(structured.brand) || extractBrand(rawTitle);
  const searchSeries = extractSeries(rawTitle);

  // Extract specific model numbers (e.g. 3520, m1607, g615jmr, slim3, etc.)
  const modelTokens = rawTitle
    .replace(/[^\w\s]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && (/\d/.test(w) || LAPTOP_SERIES.includes(w)));

  const matched = list.filter(item => {
    const itemTitle = (item.title || "").toLowerCase();
    const itemBrand = extractBrand(itemTitle);
    const itemSeries = extractSeries(itemTitle);

    // 1. Strict Brand Check: If both brands are known and differ, reject!
    if (searchBrand && itemBrand && searchBrand !== itemBrand) {
      return false;
    }

    // 2. Strict Series/Family Check: If both series are known and differ (e.g. VivoBook vs TUF), reject!
    if (searchSeries && itemSeries && searchSeries !== itemSeries) {
      return false;
    }

    // 3. Model Code Check (e.g. "3520", "1607", "g615")
    const numericTokens = modelTokens.filter(t => /\d{3,4}/.test(t) || /^m[123]$/i.test(t));
    if (numericTokens.length > 0) {
      const hasModelNumberMatch = numericTokens.some(num => itemTitle.includes(num));
      if (!hasModelNumberMatch) return false;
    }

    // 4. Token Overlap Check
    let matchingTokensCount = 0;
    for (const token of modelTokens) {
      if (itemTitle.includes(token)) {
        matchingTokensCount++;
      }
    }

    return (searchBrand && searchBrand === itemBrand && matchingTokensCount >= 1) || matchingTokensCount >= 2;
  });

  return matched;
}

function fuzzyMatch(text, keyword) {
  if (!keyword || !text) return true;
  const kw = keyword.toLowerCase().trim();
  const txt = text.toLowerCase().trim();
  return txt.includes(kw) || kw.includes(txt);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { matchProducts, fuzzyMatch };
}