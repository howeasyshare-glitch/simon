// pages/api/generate-image.js
// 使用 gemini-2.5-flash-image：依 Outfit Spec + styleVariant 畫完整穿搭圖

const variantPromptMap = {
  "brand-uniqlo": { desc: "Japanese everyday casual style similar to UNIQLO: simple basics, clean lines, comfortable fits, no visible logos." },
  "brand-muji": { desc: "MUJI-like minimal lifestyle clothing: soft neutral colors, linen and cotton, relaxed fit, very simple design, no logos." },
  "brand-cos": { desc: "COS-like modern minimalism: structured silhouettes, monochrome palette, slightly oversized shapes, design-focused details." },
  "brand-nike-tech": { desc: "Nike techwear inspired athleisure: technical fabrics, fitted joggers, hoodies or track jackets, sporty sneakers." },
  "brand-ader-error": { desc: "Korean streetwear similar to Ader Error: oversized fits, playful proportions, bold color accents, sometimes asymmetry." },

  "celeb-iu-casual": { desc: "Outfit styling inspired by IU's Korean casual looks: soft pastel colors, neat knitwear or shirts, straight pants, light outerwear. Do NOT copy her face or identity." },
  "celeb-jennie-minimal": { desc: "Outfit styling inspired by Jennie's minimal chic outfits: clean silhouettes, cropped tops or neat knits, high-waisted bottoms, neutral tones. Do NOT copy her face or identity." },
  "celeb-gd-street": { desc: "Outfit styling inspired by G-Dragon's Korean street layering: bold layered pieces, interesting textures, statement shoes and accessories. Do NOT copy his face or identity." },
  "celeb-lisa-sporty": { desc: "Outfit styling inspired by Lisa's dancer athleisure: sporty crop tops, jogger pants, hoodies or jackets, cap and sneakers. Do NOT copy her face or identity." }
};

function normalizeAspectRatio(input) {
  if (!input) return "9:16";
  const s = String(input).trim();
  if (s === "9:14") return "9:16";
  const allowed = new Set(["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2", "4:5", "5:4", "21:9"]);
  if (allowed.has(s)) return s;
  if (s.toLowerCase() === "portrait") return "9:16";
  if (s.toLowerCase() === "landscape") return "16:9";
  return "9:16";
}

function normalizeImageSize(input) {
  if (!input) return "1K";
  const s = String(input).trim().toUpperCase();
  if (["1K", "2K", "4K"].includes(s)) return s;
  return "1K";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const raw = req.body || {};
    const payload = raw.payload || raw;

    // ✅ spec 兼容：你前端可能送 spec，也可能送 outfitSpec
    const outfitSpec = raw.outfitSpec || raw.spec || payload.outfitSpec || payload.spec || null;

    const gender = payload.gender;
    const age = payload.age;
    const height = payload.height;
    const weight = payload.weight;

    // ✅ style 兼容
    const style = payload.style || payload.styleId;

    const styleVariant = payload.styleVariant || payload.variant || payload.celebrity || payload.inspiration || "";
    const temp = payload.temp ?? payload.temperature;

    const withBag = !!payload.withBag;
    const withHat = !!payload.withHat;
    const withCoat = !!payload.withCoat;

    const aspectRatio = raw.aspectRatio || payload.aspectRatio;
    const imageSize = raw.imageSize || payload.imageSize;

    if (
      !gender ||
      !age ||
      !height ||
      !weight ||
      !style ||
      temp === undefined ||
      temp === null ||
      !outfitSpec ||
      !Array.isArray(outfitSpec.items) ||
      outfitSpec.items.length === 0
    ) {
      return res.status(400).json({
        error: "Missing parameters or outfitSpec",
        detail: {
          hasPayloadWrapper: !!raw.payload,
          payloadKeys: Object.keys(payload || {}),
          hasOutfitSpec: !!outfitSpec,
          outfitSpecKeys: outfitSpec ? Object.keys(outfitSpec) : null,
        },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const ar = normalizeAspectRatio(aspectRatio);
    const size = normalizeImageSize(imageSize);

    const h = Number(height) / 100;
    const bmi = Number(weight) / (h * h);

    let bodyShape = "average body shape";
    if (bmi < 19) bodyShape = "slim body shape";
    else if (bmi < 25) bodyShape = "average body shape";
    else if (bmi < 30) bodyShape = "slightly chubby body shape";
    else bodyShape = "plus-size body shape";

    const genderText =
      gender === "female" ? "a woman" :
      gender === "male" ? "a man" :
      "a person with a gender-neutral look";

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

    const variant = styleVariant && variantPromptMap[styleVariant];
    const variantHint = variant ? variant.desc : "";

    const prompt = `
Generate a full-body outfit illustration of ${genderText}, around ${age} years old,
with a ${bodyShape}, height about ${height} cm, weight about ${weight} kg.

IMPORTANT composition:
- Portrait orientation (${ar}).
- Full body head-to-toe visible, centered.
- Leave a small margin above head and below shoes so nothing is cropped.

Outfit specification (must follow closely):
${outfitDescription}

Styling direction:
- Base style: ${styleText}
- Variant styling hints: ${variantHint || "none"}
- Temperature: about ${temp}°C, dress appropriately for this weather.
- Accessories preference:
  - bag: ${withBag ? "include a bag if present in the outfitSpec" : "no bag"}
  - hat: ${withHat ? "include a hat if present in the outfitSpec" : "no hat"}
  - outer/coat: ${withCoat ? "include an outer layer if present in the outfitSpec" : "no extra outer layer unless absolutely needed"}

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
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          imageConfig: {
            aspectRatio: ar,
            // 你目前沒有真正用到 size（模型支援度不一），先回傳即可
          },
        },
      }),
    });

    const respText = await geminiResponse.text();
    let data;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!geminiResponse.ok) {
      console.error("Gemini IMAGE API error:", geminiResponse.status, respText);
      return res.status(500).json({ error: "Gemini API error", detail: respText });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      console.error("No image part in Gemini IMAGE response:", JSON.stringify(data, null, 2));
      return res.status(500).json({ error: "No image returned from Gemini", raw: data });
    }

    const base64 = imagePart.inlineData.data;

    return res.status(200).json({
      image: base64,
      image_base64: base64, // ✅ 前端常用這個
      mime: imagePart.inlineData.mimeType || "image/png",
      aspectRatio: ar,
      imageSize: size,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
