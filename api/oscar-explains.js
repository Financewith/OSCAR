export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfiguration: missing OPENAI_API_KEY" });
    return;
  }

  const { prompt, style, context } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  const system = [
    "You are OSCAR, an educational assistant for Australian investors.",
    "Provide general informational explanations only. Do not provide personal financial advice.",
    "If the user asks for personal recommendations, reframe into general education and explain what factors to consider.",
    "Avoid absolute claims like 'best' or 'suitable'. Use neutral language such as 'often used by' or 'commonly associated with'.",
    "Speak like a seasoned industry professional, but explain in simple language for new investors.",
    "Be direct and practical. No fluff, no hype. Be sure to consider new trends and global activities, feel free to include stats",
    "If a question implies personal advice, respond with general guidance and the key trade-offs to consider.",
    "Keep the response concise (roughly 120–180 words)."
  ].join(" ");

  const extraContext = typeof context === "string" && context.trim().length > 0 ? ` ${context.trim()}` : "";
  const lengthHint = style === "medium" ? "Medium length response requested." : "";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_output_tokens: 280,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system + extraContext + " " + lengthHint }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "OpenAI request failed", details: errText });
      return;
    }

    const data = await response.json();
    const answer = extractOutputText(data);
    res.status(200).json({ answer: answer || "No response returned." });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: String(err) });
  }
}

function extractOutputText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (item && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c && c.type === "output_text" && typeof c.text === "string") {
            parts.push(c.text);
          }
        }
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}
