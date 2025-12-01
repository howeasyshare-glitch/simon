// pages/api/generate-image.js
// 使用 gemini-2.5-flash-image：先根據 outfitSpec 畫出完整穿搭圖

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
      withCoat,
      outfitSpec // 👈 新增：前端丟進來的 { summary, items }
    } = req.body || {};

    if (
      !gender ||
      !age ||
      !height ||
      !weight ||
      !style ||
      temp === undefined ||
      !outfitSpec ||
      !Array.isArray(outfitSpec.items) ||
      outfitSpec.items.length === 0
    ) {
      return res.status(400).json({ error: "Missing parameters or outfitSpec" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    // ===== 身材說明 =====
    const h = height / 100;
    const bmi = weight / (h * h);
    let bodyShape = "average body shape";
    if (bmi < 19) bodyShape = "slim body shape";
    else if (bmi < 25) bodyShape = "average body shape";
    else if (bmi < 30) bodyShape = "slightly chubby body shape";
    else bodyShape = "plus-size body shape";

    const genderText =
      gender === "female"
        ? "a woman"
        : gender === "male"
        ? "a man"
        : "a person with a gender-neutral look";

    // ===== 把 outfitSpec 轉成英文描述（給圖片模型看） =====
    const lines = outfitSpec.items.map((item) => {
      const slot = item.slot || "item";
      const color = item.color || "";
      const name = item.generic_name || "";
      return `- ${slot}: ${color} ${name}`.trim();
    });

    const outfitDescription = lines.join("\n");

    const styleMap = {
      casual: "casual daily style",
      minimal: "minimal Japanese office-casual style",
      street: "Japanese streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style"
    };
    const styleText = styleMap[style] || "casual daily style";

    const prompt = `
Generate a full-body outfit illustration of ${genderText}, around ${age} years old,
with a ${bodyShape}, height about ${height} cm, weight about ${weight} kg.

Outfit specification (must follow closely):
${outfitDescription}

Context:
- Overall style: ${styleText}, minimalist Japanese casual brands similar to UNIQLO.
- Temperature: about ${temp}°C, dress appropriately for this weather.
- Accessories preference:
  - bag: ${withBag ? "include a bag if present in the outfitSpec" : "no bag"}
  - hat: ${withHat ? "include a hat if present in the outfitSpec" : "no hat"}
  - outer/coat: ${
        withCoat
          ? "include an outer layer if present in the outfitSpec"
          : "no outer layer unless absolutely needed"
      }

Rendering requirements:
- Clean, full-body illustration, standing pose, neutral background (light gray or off-white).
- Show the entire outfit clearly (top, bottom, shoes, and any accessories listed).
- No brand logos or text on clothing.
- Character must not resemble any real person or celebrity.
    `.trim();

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
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini IMAGE API error:", geminiResponse.status, errText);
      return res
        .status(500)
        .json({ error: "Gemini API error", detail: errText });
    }

    const data = await geminiResponse.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      console.error(
        "No image part in Gemini IMAGE response:",
        JSON.stringify(data, null, 2)
      );
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
