// pages/api/generate-image.js
// ✅ 生成圖片後上傳 Supabase Storage，只回傳 image_url（避免 base64 超大）
// ✅ 相容兩種 body：
//   A) { payload: {...}, spec: {...} }  (你 page.tsx 目前這種)
//   B) { gender, age, ..., outfitSpec } (你 API 原始這種)

const BUCKET = "outfits"; // 你 Supabase Storage 建的 public bucket

const variantPromptMap = {
  "brand-uniqlo": { desc: "Japanese everyday casual style similar to UNIQLO: simple basics, clean lines, comfortable fits, no visible logos." },
  "brand-muji": { desc: "MUJI-like minimal lifestyle clothing: soft neutral colors, linen and cotton, relaxed fit, very simple design, no logos." },
  "brand-cos": { desc: "COS-like modern minimalism: structured silhouettes, monochrome palette, slightly oversized shapes, design-focused details." },
  "brand-nike-tech": { desc: "Nike techwear inspired athleisure: technical fabrics, fitted joggers, hoodies or track jackets, sporty sneakers." },
  "brand-ader-error": { desc: "Korean streetwear similar to Ader Error: oversized fits, playful proportions, bold color accents, sometimes asymmetry." },

  "celeb-iu-casual": { desc: "Outfit styling inspired by IU's Korean casual looks. Do NOT copy her face or identity." },
  "celeb-jennie-minimal": { desc: "Outfit styling inspired by Jennie's minimal chic outfits. Do NOT copy her face or identity." },
  "celeb-gd-street": { desc: "Outfit styling inspired by G-Dragon's Korean street layering. Do NOT copy his face or identity." },
  "celeb-lisa-sporty": { desc: "Outfit styling inspired by Lisa's dancer athleisure. Do NOT copy her face or identity." }
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

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function uploadToSupabaseStorage({ supabaseUrl, serviceKey, bucket, path, bytes, contentType }) {
  const url = `${supabaseUrl}/storage/v1/object/${encodeURI(bucket)}/${encodeURI(path)}`;

  const up = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType || "image/png",
      "x-upsert": "true"
    },
    body: bytes
  });

  const t = await up.text();
  if (!up.ok) {
    throw new Error(`storage upload failed: ${up.status} ${t}`);
  }

  // public bucket URL
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURI(bucket)}/${encodeURI(path)}`;
  return publicUrl;
}

function base64ToUint8Array(b64) {
  // Node.js Buffer 可用於 Vercel serverless
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Supabase env not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
    }

    // ✅ 相容 payload/spec 包裝
    const body = req.body || {};
    const payload = body.payload || body;

    const gender = payload.gender;
    const age = payload.age;
    const height = payload.height;
    const weight = payload.weight;
    const style = payload.style || payload.styleId; // 兼容 styleId
    const styleVariant = payload.styleVariant || payload.styleVariantId;
    const temp = payload.temp;
    const withBag = !!payload.withBag;
    const withHat = !!payload.withHat;
    const withCoat = !!payload.withCoat;

    const outfitSpec = body.outfitSpec || body.spec || payload.outfitSpec;

    const aspectRatio = normalizeAspectRatio(body.aspectRatio || payload.aspectRatio);
    const imageSize = normalizeImageSize(body.imageSize || payload.imageSize);

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

    // 身形描述
    const h = height / 100;
    const bmi = weight / (h * h);
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
- Portrait orientation (${aspectRatio}).
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
- No brand logos or text on clothing.
- Character must not resemble any real person or celebrity.
`.trim();

    // ✅ 模型：你現在的 key 可用哪個就用哪個（先用你原本的 image 模型字串）
    // 若你已確認可用 Nano Banana 2，可換成：gemini-3.1-flash-image-preview
    const modelName = "gemini-3.1-flash-image-preview";

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["Image"],
          imageConfig: {
            aspectRatio,
            imageSize
          }
        }
      })
    });

    const respText = await geminiResponse.text();
    const data = safeJsonParse(respText) || { raw: respText };

    if (!geminiResponse.ok) {
      // 429/配額不足：直接回 429（前端可提示）
      const code = data?.error?.code;
      const status = data?.error?.status;
      if (code === 429 || status === "RESOURCE_EXHAUSTED") {
        let retryAfterSeconds = 30;
        const retry = data?.error?.details?.find((d) => d?.["@type"]?.includes("RetryInfo"))?.retryDelay;
        if (typeof retry === "string" && retry.endsWith("s")) {
          const n = parseInt(retry.replace("s", ""), 10);
          if (!Number.isNaN(n) && n > 0) retryAfterSeconds = n;
        }
        return res.status(429).json({
          error: "Gemini rate limited",
          retry_after_seconds: retryAfterSeconds,
          detail: data
        });
      }

      return res.status(500).json({
        error: "Gemini API error",
        detail: data
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      return res.status(500).json({ error: "No image returned from Gemini", raw: data });
    }

    const b64 = imagePart.inlineData.data;
    const mime = imagePart.inlineData.mimeType || "image/png";

    // ✅ 上傳到 Storage
    const bytes = base64ToUint8Array(b64);

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 10);

    const ext = mime.includes("jpeg") ? "jpg" : "png";
    const path = `outfits/${yyyy}/${mm}/${dd}/${Date.now()}-${rand}.${ext}`;

    const image_url = await uploadToSupabaseStorage({
      supabaseUrl,
      serviceKey,
      bucket: BUCKET,
      path,
      bytes,
      contentType: mime
    });

    // ✅ 回傳短短的 URL（不再回傳 base64）
    return res.status(200).json({
      ok: true,
      image_url,
      mime,
      aspectRatio,
      imageSize,
      storage_path: path
    });

  } catch (err) {
    console.error("generate-image error:", err);
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
