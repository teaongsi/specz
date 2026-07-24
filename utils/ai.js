async function getGroqApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get(["groqApiKey", "groq_api_key", "GROQ_API_KEY"], res => {
      resolve(res.groqApiKey || res.groq_api_key || res.GROQ_API_KEY || "");
    });
  });
}

function cleanJSON(text) {
  if (!text) return "";
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

async function callGroq(prompt) {
  const apiKey = await getGroqApiKey();
  if (!apiKey) {
    console.warn("Groq API key not set in storage. Set via chrome.storage.local.set({ groqApiKey: 'gsk_...' })");
    return "";
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      console.error("Groq HTTP error:", res.status, await res.text());
      return "";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("Groq API call failed", e);
    return "";
  }
}

function regexExtractSpecs(title) {
  const t = title || "";

  const brandMatch = t.match(/(apple|macbook|dell|hp|lenovo|asus|acer|msi|samsung|razer|gigabyte|microsoft|surface|lg)/i);
  const brand = brandMatch ? brandMatch[0].toUpperCase() : (t.split(" ")[0] || "Unknown");

  const cpuMatch = t.match(/(i3|i5|i7|i9|ryzen\s?[3579]|m1\s?(pro|max|ultra)?|m2\s?(pro|max|ultra)?|m3\s?(pro|max|ultra)?|celeron|pentium)/i);
  const processor = cpuMatch ? cpuMatch[0].toUpperCase() : "Standard CPU";

  const ramMatch = t.match(/(\d+\s?gb)\s?(ram|ddr4|ddr5)?/i);
  const ram = ramMatch ? ramMatch[1].toUpperCase() : "8GB RAM";

  const storageMatch = t.match(/(\d+\s?(gb|tb))\s?(ssd|hdd|nvme)?/i);
  const storage = storageMatch ? storageMatch[0].toUpperCase() : "512GB SSD";

  const gpuMatch = t.match(/(rtx\s?\d{4}|gtx\s?\d{4}|radeon|iris\s?xe|uhd\s?graphics|apple\s?gpu)/i);
  const gpu = gpuMatch ? gpuMatch[0].toUpperCase() : "Integrated Graphics";

  return {
    brand,
    model: t.length > 50 ? t.slice(0, 50) + "..." : t,
    processor,
    ram,
    storage,
    gpu
  };
}

async function normalizeTitleSafe(title) {
  const baseSpecs = regexExtractSpecs(title);

  const prompt = `
Return STRICT JSON only without Markdown formatting.
Extract technical specs from this product title: "${title}"

JSON structure:
{
  "brand": "Brand Name",
  "model": "Model Name/Number",
  "processor": "CPU Model",
  "ram": "RAM Amount",
  "storage": "Storage capacity",
  "gpu": "Graphics Card"
}
`;

  const responseText = await callGroq(prompt);
  if (!responseText) {
    return baseSpecs;
  }

  try {
    const parsed = JSON.parse(cleanJSON(responseText));
    return {
      brand: parsed.brand || baseSpecs.brand,
      model: parsed.model || baseSpecs.model,
      processor: parsed.processor || baseSpecs.processor,
      ram: parsed.ram || baseSpecs.ram,
      storage: parsed.storage || baseSpecs.storage,
      gpu: parsed.gpu || baseSpecs.gpu
    };
  } catch {
    return baseSpecs;
  }
}

async function analyzeValueSafe(a, b) {
  try {
    const result = await callGroq(`
You are a smart laptop buyer advisor in Nepal.
Compare these two product options:
Current Product: ${JSON.stringify(a)}
Competitor Product: ${JSON.stringify(b)}

Provide a concise 2-sentence value verdict for the buyer.
`);
    if (result) return result;

    const diff = Number(a.price) - Number(b.price);
    if (diff > 0) {
      return `Found a lower price on ${b.source || 'another store'} for Rs ${Number(b.price).toLocaleString()}! You can save Rs ${diff.toLocaleString()}.`;
    } else {
      return "Current offer is competitively priced compared to market alternatives in Nepal.";
    }
  } catch (e) {
    console.error("analyzeValueSafe failed", e);
    return "Value analysis available once Groq API key is set in storage.";
  }
}

async function generateReviewSafe(specs) {
  try {
    const result = await callGroq(`
Based on these specs: ${JSON.stringify(specs)}
Provide a brief product review summary with bullet points:
- Key Strengths
- Potential Drawbacks
- Target Audience Verdict
`);
    if (result) return result;

    return `✨ Spec Summary:
• Brand: ${specs.brand || 'Unknown'}
• CPU: ${specs.processor || 'N/A'}
• Memory: ${specs.ram || 'N/A'}
• Storage: ${specs.storage || 'N/A'}
• Graphics: ${specs.gpu || 'N/A'}

Verdict: Good entry/mid-range configuration for daily work, study, and multitasking.`;
  } catch (e) {
    console.error("generateReviewSafe failed", e);
    return "Review summary available once Groq API key is set in storage.";
  }
}


