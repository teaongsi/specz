async function getGeminiApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get(["geminiApiKey"], res => {
      resolve(res.geminiApiKey || "");
    });
  });
}

function cleanJSON(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

async function callGemini(prompt) {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    console.warn("Gemini API key not set. Add it via chrome.storage.local.set({ geminiApiKey: 'YOUR_KEY' })");
    return "";
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!res.ok) {
      console.error("Gemini HTTP error:", res.status, await res.text());
      return "";
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.error("Gemini failed", e);
    return "";
  }
}

async function normalizeTitleSafe(title) {
  const prompt = `
Return STRICT JSON only.

{
  "brand": "",
  "model": "",
  "processor": "",
  "ram": "",
  "storage": "",
  "gpu": ""
}

Title: ${title}
`;

  const text = cleanJSON(await callGemini(prompt));

  try {
    return JSON.parse(text);
  } catch {
    return { brand: "Unknown", model: title };
  }
}

async function analyzeValueSafe(a, b) {
  try {
    const result = await callGemini(`
Compare value difference:

A: ${JSON.stringify(a)}
B: ${JSON.stringify(b)}

Return short verdict + % value.
`);
    return result || "Analysis unavailable — set your Gemini API key in extension storage.";
  } catch (e) {
    console.error("analyzeValueSafe failed", e);
    return "";
  }
}

async function generateReviewSafe(specs) {
  try {
    const result = await callGemini(`
Pros, cons, verdict (SHORT):

${JSON.stringify(specs)}
`);
    return result || "Review unavailable — set your Gemini API key in extension storage.";
  } catch (e) {
    console.error("generateReviewSafe failed", e);
    return "";
  }
}
