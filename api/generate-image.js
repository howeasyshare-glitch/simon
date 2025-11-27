// pages/api/generate-image.js

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-1.5-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---- 身材描述（依 BMI 分級）----
function getBodyShapePrompt(height, weight) {
  const h = height / 100;
  const bmi = weight / (h * h);

  if (bmi < 19) {
    return `
very slim body, clearly slender limbs, visible bone outline, small waist,
minimal body fat, lightweight figure,
do NOT draw curves, do NOT draw thick arms or legs, do NOT draw chubby proportions.
    `.trim();
  }

  if (bmi < 25) {
    return `
average realistic body, balanced proportions, medium muscle and fat,
neither skinny nor chubby, natural and healthy body shape,
do NOT draw extremely slim or extremely curvy proportions.
    `.trim();
  }

  if (bmi < 30) {
    return `
slightly chubby body, soft curves, visibly thicker arms and thighs,
rounder waistline, fuller hips, clearly not slim,
do NOT draw skinny limbs, do NOT shrink the body proportion.
    `.trim();
  }

  return `
plus-size figure, full curves, heavier and thicker limbs, larger waist and hips,
round and full body shape, definitely not slim,
do NOT draw a skinny model, do NOT reduce body width.
  `.trim();
}

// ---- Stage 1：只畫身材基底圖 ----
function buildBodyOnlyPrompt(gender, height, weight) {
  const genderTextMapEn = {
    female: "a woman",
    male: "a man",
    neutral: "a person"
  };
  const genderEn = genderTextMapEn[gender] || "a person";

  const bodyShapePrompt = getBodyShapePrompt(height, weight);

  return `
${genderEn}, height around ${height} cm, weight around ${weight} kg.
Body shape: ${bodyShapePrompt}

Full-body view, standing pose, facing forward or slight 3/4 angle.
Wearing very simple, tight neutral clothing (plain top and plain pants),
so the body shape and curves are clearly visible.

White or light neutral studio background, soft even lighting.
No accessories, no outerwear, no brand logos, no text in the image.
  `.trim();
}

// ---- Stage 2：在身材基底圖上套穿搭 ----
function buildOutfitStagePrompt(outfitPrompt, style, temp) {
  const styleTextMapEn = {
    casual: "casual everyday outfit",
    minimal: "minimalist office casual outfit",
    street: "streetwear outfit",
    sporty: "sporty athleisure outfit",
    smart: "smart casual outfit"
  };
  const styleEn = styleTextMapEn[style] || "casual outfit";

  const tempText = isNaN(temp)
    ? ""
    : `The outfit should match weather around ${temp}°C.`;

  return `
Use the person in the reference image as the base.
Keep the same body shape, proportions, and pose exactly.

Now dress this person in a new outfit:
- ${styleEn}
- Inspired by UNIQLO lookbook style: clean, simple, practical clothing.
- Use the following clothing description as guidance:
${outfitPrompt || ""}

Requirements:
- Do NOT change the body shape: keep the same thickness of arms, legs, waist, and hips.
- Do NOT make the body slimmer than in the reference image.
- Replace the original tight neutral clothes with the new outfit.
- Keep a neutral light background and soft lighting.
- No visible brand logos, no text in the image.

${tempText}
  `.trim();
}

// ---- Gemini：純文字 → 圖片 ----
async function callGeminiTextToImage(prompt) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      // 要求回傳 PNG 圖片
      responseMimeType: "image/png"
    }
  };

  const resp = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Gemini text→image 非 JSON 回應：", raw);
    throw new Error("Gemini text→image API returned non-JSON response");
  }

  if (!resp.ok) {
    console.error("Gemini text→image error detail:", json);
    throw new Error("Gemini text→image API error: " + resp.status);
  }

  const imagePart =
    json.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData && p.inlineData.data
    );

  if (!imagePart) {
    console.error("Gemini text→image response unexpected:", JSON.stringify(json, null, 2));
    throw new Error("No image data in Gemini text→image response");
  }

  return imagePart.inlineData.data; // base64（不含 data:image/png;base64, 前綴）
}

// ---- Gemini：圖片 + 文本 → 新圖片 ----
async function callGeminiImageToImage(baseImageBase64, prompt) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: baseImageBase64
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "image/png"
    }
  };

  const resp = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await resp.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Gemini image→image 非 JSON 回應：", raw);
    throw new Error("Gemini image→image API returned non-JSON response");
  }

  if (!resp.ok) {
    console.error("Gemini image→image error detail:", json);
    throw new Error("Gemini image→image API error: " + resp.status);
  }

  const imagePart =
    json.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData && p.inlineData.data
    );

  if (!imagePart) {
    console.error("Gemini image→image response unexpected:", JSON.stringify(json, null, 2));
    throw new Error("No image data in Gemini image→image response");
  }

  return imagePart.inlineData.data;
}

// ---- Next.js API handler ----
export default async function handler(req, res) {
  console.log("generate-image method:", req.method);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY is not set" });
    return;
  }

  try {
    const { gender, age, style, temp, height, weight, outfitPrompt } = req.body || {};

    if (!gender || !height || !weight) {
      res.status(400).json({ error: "Missing required fields: gender/height/weight" });
      return;
    }

    const hNum = Number(height);
    const wNum = Number(weight);
    const tNum = Number(temp) || 22;

    // Stage 1：只畫身材基底圖
    const bodyOnlyPrompt = buildBodyOnlyPrompt(gender, hNum, wNum);
    const baseBodyImageBase64 = await callGeminiTextToImage(bodyOnlyPrompt);

    // Stage 2：在身材基底上套穿搭
    const outfitStagePrompt = buildOutfitStagePrompt(
      outfitPrompt || "",
      style || "casual",
      tNum
    );

    const finalImageBase64 = await callGeminiImageToImage(
      baseBodyImageBase64,
      outfitStagePrompt
    );

    res.status(200).json({
      image: finalImageBase64,
      debug: {
        bodyOnlyPrompt,
        outfitStagePrompt
      }
    });
  } catch (err) {
    console.error("generate-image handler error:", err);
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
