// api/generate-image.js
// 使用 gemini-2.5-flash-image 產生穿搭示意圖

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { gender, age, style, temp } = req.body || {};

    if (!gender || !age || !style || temp === undefined) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    // ===== 組 prompt：描述要畫的穿搭 =====
    const styleTextMap = {
      casual: "casual daily style",
      minimal: "minimalist office casual style",
      street: "streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style"
    };

    const genderTextMap = {
      female: "a woman",
      male: "a man",
      neutral: "a person with a gender-neutral look"
    };

    const styleText = styleTextMap[style] || "casual daily style";
    const genderTextEn = genderTextMap[gender] || "a person";

    const prompt = `
Generate a full-body outfit illustration:

- Person: ${genderTextEn}, around ${age} years old
- Style: ${styleText}
- Weather: about ${temp}°C, comfortable everyday weather
- Brand aesthetic: minimalist Japanese casual wear, similar to UNIQLO

Requirements:
- Clean full-body illustration, soft natural daylight.
- Neutral light background (light grey or off-white).
- Outfit should reflect Japanese minimalist casual style: simple shapes, muted colors.
- No logos or brand names.
- Show the whole outfit clearly (top, bottom, shoes, and optionally a small bag).
- The character must not look like any real person or celebrity.
    `.trim();

    // ===== 呼叫 gemini-2.5-flash-image =====
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
        // 圖片模型本身就只回 image，不需要再指定 responseModalities
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return res
        .status(500)
        .json({ error: "Gemini API error", detail: errText });
    }

    const data = await geminiResponse.json();

    // 從回傳中找到 inlineData（圖片的 base64）
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(
      (p) => p.inlineData && p.inlineData.data
    );

    if (!imagePart) {
      console.error("No image part in Gemini response:", JSON.stringify(data, null, 2));
      return res
        .status(500)
        .json({ error: "No image returned from Gemini", raw: data });
    }

    const base64Image = imagePart.inlineData.data;

    return res.status(200).json({
      image: base64Image,
      mime: imagePart.inlineData.mimeType || "image/png"
    });
  } catch (err) {
    console.error("generate-image error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
