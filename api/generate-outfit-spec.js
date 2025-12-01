// pages/api/generate-outfit-spec.js
// 用 gemini-2.0-flash 產生結構化的 Outfit Spec（JSON）

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      gender,
      age,
      height,
      weight,
      style,
      temp,
      withBag,
      withHat,
      withCoat
    } = req.body || {};

    if (
      !gender ||
      !age ||
      !height ||
      !weight ||
      !style ||
      temp === undefined
    ) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    // 組一個簡單的身材說明（給模型參考）
    const h = height / 100;
    const bmi = weight / (h * h);
    let bodyShape = "average body shape";
    if (bmi < 19) bodyShape = "slim body shape";
    else if (bmi < 25) bodyShape = "average body shape";
    else if (bmi < 30) bodyShape = "slightly chubby body shape";
    else bodyShape = "plus-size body shape";

    const genderText =
      gender === "female"
        ? "female"
        : gender === "male"
        ? "male"
        : "gender-neutral";

    const styleMap = {
      casual: "casual daily style",
      minimal: "minimal, clean office-casual style",
      street: "streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style"
    };

    const styleText = styleMap[style] || "casual style";

    // 告訴模型要的 JSON 格式
    const systemInstruction = `
You are a stylist that only returns STRICT JSON. 
You design outfits as a list of items.

Your JSON MUST have this shape:

{
  "summary": "short natural language summary of this outfit in 1-2 sentences (in Traditional Chinese)",
  "items": [
    {
      "slot": "top" | "bottom" | "shoes" | "outer" | "bag" | "hat",
      "generic_name": "english generic clothing name, e.g. \"oversized cotton crew neck t-shirt\"",
      "display_name_zh": "短中文名稱，例如「寬版棉質圓領上衣」",
      "color": "simple color in English, e.g. \"white\", \"beige\", \"light blue\"",
      "style": "short style tag in English, e.g. \"casual\", \"minimal\", \"street\"",
      "gender": "female" | "male" | "unisex",
      "warmth": "light" | "medium" | "warm"   // how warm this piece is
    }
  ]
}

Rules:
- Return ONLY valid JSON, no extra text.
- Use 1 top, 1 bottom, 1 pair of shoes as the core.
- Add outer (jacket / coat / cardigan) ONLY if user asked for coat/outer or temperature is <= 20°C.
- Add bag only if user asked for bag.
- Add hat only if user asked for hat.
- Style should match Japanese minimal casual brands similar to UNIQLO: clean, simple, no logos.
- Colors should be realistic and easy to match.
- Use gender-neutral items (gender:"unisex") if they fit both genders.
`;

    const userInstruction = `
User profile:
- Gender: ${genderText}
- Age: ${age}
- Height: ${height} cm
- Weight: ${weight} kg (BMI ~ ${bmi.toFixed(1)}, ${bodyShape})
- Preferred style: ${styleText}
- Temperature: around ${temp} °C

Accessories preference:
- with bag: ${withBag ? "yes" : "no"}
- with hat: ${withHat ? "yes" : "no"}
- with coat/outer: ${withCoat ? "yes" : "no"}

Please design one complete outfit and return JSON only.
`;

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemInstruction },
              { text: userInstruction }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini SPEC API error:", geminiResponse.status, errText);
      return res
        .status(500)
        .json({ error: "Gemini SPEC API error", detail: errText });
    }

    const data = await geminiResponse.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse outfit JSON:", text);
      return res.status(500).json({
        error: "Failed to parse JSON from Gemini",
        raw: text
      });
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return res.status(500).json({
        error: "Invalid outfit spec",
        raw: parsed
      });
    }

    // 成功就回傳 JSON 給前端
    return res.status(200).json({
      summary: parsed.summary || "",
      items: parsed.items
    });
  } catch (err) {
    console.error("generate-outfit-spec error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
