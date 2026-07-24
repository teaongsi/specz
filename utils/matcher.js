function matchProducts(structured, list) {
  const brand = structured.brand?.toLowerCase() || "";
  const model = structured.model?.toLowerCase() || "";

  return list.filter(item => {
    const t = (item.title || "").toLowerCase();
    const brandOk = !brand || brand === "unknown" || fuzzyMatch(t, brand);
    const modelOk = !model || fuzzyMatch(t, model);
    return brandOk && modelOk;
  });
}

function fuzzyMatch(text, keyword) {
  if (!keyword) return true;

  return keyword
    .split(" ")
    .every(k => text.includes(k));
}