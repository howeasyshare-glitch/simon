// pages/api/generate-outfit-spec.js
// V2.2
// 重點：
// 1. 保留原本 Supabase 驗證 / 扣點流程
// 2. item schema 升級成「可購物描述」
// 3. fallback item 也補齊 category / fit / material / sleeve_length / neckline / silhouette / style_keywords
// 4. 不需要修改資料庫 schema

const variantPromptMap = {
  "brand-uniqlo": {
    desc: "Japanese everyday casual style similar to UNIQLO: simple basics, clean lines, comfortable fits, no visible logos.",
    baseStyle: "casual"
  },
  "brand-muji": {
    desc: "MUJI-like minimal lifestyle clothing: soft neutral colors, linen and cotton, relaxed fit, very simple design, no logos.",
    baseStyle: "casual"
  },
  "brand-cos": {
    desc: "COS-like modern minimalism: structured silhouettes, monochrome palette, slightly oversized shapes, design-focused details.",
    baseStyle: "minimal"
  },
  "brand-nike-tech": {
    desc: "Nike techwear inspired athleisure: technical fabrics, fitted joggers, hoodies or track jackets, sporty sneakers.",
    baseStyle: "sporty"
  },
  "brand-ader-error": {
    desc: "Korean streetwear similar to Ader Error: oversized fits, playful proportions, bold color accents, sometimes asymmetry.",
    baseStyle: "street"
  },

  "celeb-iu-casual": {
    desc: "Outfit styling inspired by IU's Korean casual looks: soft pastel colors, neat knitwear or shirts, straight pants, light outerwear. Do NOT copy her face or identity.",
    baseStyle: "casual"
  },
  "celeb-jennie-minimal": {
    desc: "Outfit styling inspired by Jennie's minimal chic outfits: clean silhouettes, cropped tops or neat knits, high-waisted bottoms, neutral tones. Do NOT copy her face or identity.",
    baseStyle: "minimal"
  },
  "celeb-gd-street": {
    desc: "Outfit styling inspired by G-Dragon's Korean street layering: bold layered pieces, interesting textures, statement shoes and accessories. Do NOT copy his face or identity.",
    baseStyle: "street"
  },
  "celeb-lisa-sporty": {
    desc: "Outfit styling inspired by Lisa's dancer athleisure: sporty crop tops, jogger pants, hoodies or jackets, cap and sneakers. Do NOT copy her face or identity.",
    baseStyle: "sporty"
  }
};

// ===== Supabase helpers =====
async function getUserFromSupabase({ supabaseUrl, serviceKey, accessToken }) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!resp.ok) {
    const t = await resp.text();
    return { ok: false, detail: t };
  }

  const user = await resp.json();
  return { ok: true, user };
}

async function getOrCreateProfile({ supabaseUrl, serviceKey, userId, email }) {
  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };

  const q = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,credits_left,is_tester`,
    { headers }
  );

  if (!q.ok) {
    const t = await q.text();
    throw new Error("profiles query failed: " + t);
  }

  const arr = await q.json();
  if (arr && arr[0]) return arr[0];

  const ins = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      id: userId,
      email,
      credits_left: 3,
      updated_at: new Date().toISOString()
    })
  });

  if (!ins.ok) {
    const t = await ins.text();
    throw new Error("profiles insert failed: " + t);
  }

  const created = await ins.json();
  return created?.[0] || { id: userId, email, credits_left: 3 };
}

async function deductOneCreditAtomic({ supabaseUrl, serviceKey, userId }) {
  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=representation"
  };

  const read = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=credits_left,is_tester`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json"
      }
    }
  );

  const readText = await read.text();
  if (!read.ok) throw new Error("profiles read failed: " + readText);

  const rows = JSON.parse(readText);
  const current = Number(rows?.[0]?.credits_left ?? 0);
  if (current <= 0) return { ok: false, credits_left: 0 };

  const newCredits = current - 1;

  const upd = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&credits_left=eq.${current}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        credits_left: newCredits,
        updated_at: new Date().toISOString()
      })
    }
  );

  const updText = await upd.text();
  if (!upd.ok) throw new Error("profiles update failed: " + updText);

  const updatedRows = JSON.parse(updText);
  if (!updatedRows?.[0]) {
    return { ok: false, credits_left: current };
  }

  return { ok: true, credits_left: updatedRows[0].credits_left };
}

// ===== item helpers =====
function normalizeSlot(slot) {
  if (!slot) return null;
  const s = String(slot).toLowerCase();
  if (["top", "bottom", "shoes", "outer", "bag", "hat"].includes(s)) return s;
  return null;
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => cleanText(x)).filter(Boolean).slice(0, 4);
}

function enrichItemShape(item, fallback = {}) {
  return {
    slot: normalizeSlot(item?.slot || fallback.slot),
    generic_name: cleanText(item?.generic_name || fallback.generic_name),
    display_name_zh: cleanText(item?.display_name_zh || fallback.display_name_zh),
    category: cleanText(item?.category || fallback.category),
    color: cleanText(item?.color || fallback.color),
    fit: cleanText(item?.fit || fallback.fit),
    material: cleanText(item?.material || fallback.material),
    sleeve_length: cleanText(item?.sleeve_length || fallback.sleeve_length),
    length: cleanText(item?.length || fallback.length),
    neckline: cleanText(item?.neckline || fallback.neckline),
    silhouette: cleanText(item?.silhouette || fallback.silhouette),
    style: cleanText(item?.style || fallback.style),
    style_keywords: cleanArray(item?.style_keywords?.length ? item.style_keywords : fallback.style_keywords),
    gender: cleanText(item?.gender || fallback.gender),
    warmth: cleanText(item?.warmth || fallback.warmth),
  };
}

function baseGenderText(genderText) {
  return genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex";
}

function fallbackTop(genderText) {
  return enrichItemShape({}, {
    slot: "top",
    generic_name: "oversized cotton crew neck t-shirt",
    display_name_zh: "寬版棉質圓領上衣",
    category: "crew neck t-shirt",
    color: "white",
    fit: "oversized",
    material: "cotton",
    sleeve_length: "short sleeve",
    length: "regular",
    neckline: "crew neck",
    silhouette: "boxy",
    style: "casual",
    style_keywords: ["casual daily", "clean basic"],
    gender: baseGenderText(genderText),
    warmth: "light"
  });
}

function fallbackBottom(genderText) {
  return enrichItemShape({}, {
    slot: "bottom",
    generic_name: "straight leg jeans",
    display_name_zh: "直筒牛仔褲",
    category: "straight leg jeans",
    color: "light blue",
    fit: "regular",
    material: "denim",
    sleeve_length: "none",
    length: "full-length",
    neckline: "none",
    silhouette: "straight",
    style: "casual",
    style_keywords: ["daily casual", "clean silhouette"],
    gender: baseGenderText(genderText),
    warmth: "light"
  });
}

function fallbackShoes() {
  return enrichItemShape({}, {
    slot: "shoes",
    generic_name: "white low-top sneakers",
    display_name_zh: "白色低筒休閒球鞋",
    category: "low-top sneakers",
    color: "white",
    fit: "regular",
    material: "leather",
    sleeve_length: "none",
    length: "regular",
    neckline: "none",
    silhouette: "minimal",
    style: "casual",
    style_keywords: ["minimal sneakers", "clean everyday"],
    gender: "unisex",
    warmth: "light"
  });
}

function fallbackBag() {
  return enrichItemShape({}, {
    slot: "bag",
    generic_name: "minimalist canvas shoulder bag",
    display_name_zh: "極簡帆布側背包",
    category: "shoulder bag",
    color: "beige",
    fit: "regular",
    material: "canvas",
    sleeve_length: "none",
    length: "regular",
    neckline: "none",
    silhouette: "clean",
    style: "minimal",
    style_keywords: ["daily bag", "minimal accessory"],
    gender: "unisex",
    warmth: "light"
  });
}

function fallbackHat() {
  return enrichItemShape({}, {
    slot: "hat",
    generic_name: "cotton baseball cap",
    display_name_zh: "棉質棒球帽",
    category: "baseball cap",
    color: "beige",
    fit: "regular",
    material: "cotton",
    sleeve_length: "none",
    length: "regular",
    neckline: "none",
    silhouette: "clean",
    style: "casual",
    style_keywords: ["daily cap", "clean casual"],
    gender: "unisex",
    warmth: "light"
  });
}

function fallbackOuter(style, temp, genderText) {
  const isCold = temp <= 10;
  const isCool = temp > 10 && temp <= 18;
  let base;

  if (style === "minimal") {
    base = isCold
      ? {
          generic_name: "long wool coat",
          display_name_zh: "長版羊毛大衣",
          category: "wool coat",
          color: "camel",
          fit: "relaxed",
          material: "wool",
          sleeve_length: "long sleeve",
          length: "long",
          neckline: "lapel collar",
          silhouette: "structured",
          style: "minimal",
          style_keywords: ["clean tailoring", "minimal outerwear"],
          warmth: "warm"
        }
      : isCool
      ? {
          generic_name: "long belted trench coat",
          display_name_zh: "綁帶長版風衣外套",
          category: "trench coat",
          color: "beige",
          fit: "regular",
          material: "cotton blend",
          sleeve_length: "long sleeve",
          length: "long",
          neckline: "lapel collar",
          silhouette: "structured",
          style: "minimal",
          style_keywords: ["clean silhouette", "smart casual"],
          warmth: "medium"
        }
      : {
          generic_name: "lightweight open-front jacket",
          display_name_zh: "輕薄落肩外套",
          category: "lightweight jacket",
          color: "light beige",
          fit: "relaxed",
          material: "cotton blend",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "open front",
          silhouette: "clean",
          style: "minimal",
          style_keywords: ["light layering", "minimal casual"],
          warmth: "light"
        };
  } else if (style === "street") {
    base = isCold
      ? {
          generic_name: "oversized padded bomber jacket",
          display_name_zh: "寬版鋪棉飛行外套",
          category: "bomber jacket",
          color: "black",
          fit: "oversized",
          material: "technical nylon",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "zip collar",
          silhouette: "boxy",
          style: "street",
          style_keywords: ["korean streetwear", "oversized layering"],
          warmth: "warm"
        }
      : isCool
      ? {
          generic_name: "oversized denim jacket",
          display_name_zh: "寬版牛仔外套",
          category: "denim jacket",
          color: "mid blue",
          fit: "oversized",
          material: "denim",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "shirt collar",
          silhouette: "boxy",
          style: "street",
          style_keywords: ["street layering", "casual denim"],
          warmth: "medium"
        }
      : {
          generic_name: "lightweight coach jacket",
          display_name_zh: "薄款教練外套",
          category: "coach jacket",
          color: "navy",
          fit: "relaxed",
          material: "nylon",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "shirt collar",
          silhouette: "clean",
          style: "street",
          style_keywords: ["light streetwear", "clean sporty"],
          warmth: "light"
        };
  } else if (style === "sporty") {
    base = isCold
      ? {
          generic_name: "padded hooded parka",
          display_name_zh: "鋪棉連帽外套",
          category: "hooded parka",
          color: "dark gray",
          fit: "regular",
          material: "technical fabric",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "hooded",
          silhouette: "functional",
          style: "sporty",
          style_keywords: ["athleisure", "functional outerwear"],
          warmth: "warm"
        }
      : isCool
      ? {
          generic_name: "zip-up track jacket",
          display_name_zh: "拉鍊運動外套",
          category: "track jacket",
          color: "black",
          fit: "regular",
          material: "technical jersey",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "stand collar",
          silhouette: "clean",
          style: "sporty",
          style_keywords: ["athleisure", "sport casual"],
          warmth: "medium"
        }
      : {
          generic_name: "lightweight zip hoodie",
          display_name_zh: "輕薄連帽外套",
          category: "zip hoodie",
          color: "light gray",
          fit: "regular",
          material: "cotton blend",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "hooded",
          silhouette: "relaxed",
          style: "sporty",
          style_keywords: ["light athleisure", "daily sporty"],
          warmth: "light"
        };
  } else if (style === "smart") {
    base = isCold
      ? {
          generic_name: "tailored wool coat",
          display_name_zh: "修身羊毛大衣",
          category: "wool coat",
          color: "dark navy",
          fit: "regular",
          material: "wool",
          sleeve_length: "long sleeve",
          length: "long",
          neckline: "lapel collar",
          silhouette: "tailored",
          style: "smart",
          style_keywords: ["smart casual", "tailored outerwear"],
          warmth: "warm"
        }
      : isCool
      ? {
          generic_name: "short trench coat",
          display_name_zh: "短版風衣外套",
          category: "trench coat",
          color: "beige",
          fit: "regular",
          material: "cotton blend",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "lapel collar",
          silhouette: "structured",
          style: "smart",
          style_keywords: ["commute style", "smart casual"],
          warmth: "medium"
        }
      : {
          generic_name: "unstructured blazer",
          display_name_zh: "輕薄休閒西裝外套",
          category: "blazer",
          color: "dark gray",
          fit: "regular",
          material: "lightweight wool blend",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "lapel collar",
          silhouette: "clean",
          style: "smart",
          style_keywords: ["commute style", "smart layer"],
          warmth: "light"
        };
  } else {
    base = isCold
      ? {
          generic_name: "padded jacket",
          display_name_zh: "保暖鋪棉外套",
          category: "padded jacket",
          color: "beige",
          fit: "regular",
          material: "technical fabric",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "zip collar",
          silhouette: "relaxed",
          style: "casual",
          style_keywords: ["daily outerwear", "comfortable layer"],
          warmth: "warm"
        }
      : isCool
      ? {
          generic_name: "cotton parka jacket",
          display_name_zh: "棉質連帽外套",
          category: "parka jacket",
          color: "khaki",
          fit: "regular",
          material: "cotton",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "hooded",
          silhouette: "relaxed",
          style: "casual",
          style_keywords: ["daily casual", "easy layering"],
          warmth: "medium"
        }
      : {
          generic_name: "lightweight utility jacket",
          display_name_zh: "輕薄機能外套",
          category: "utility jacket",
          color: "olive",
          fit: "regular",
          material: "cotton blend",
          sleeve_length: "long sleeve",
          length: "regular",
          neckline: "shirt collar",
          silhouette: "clean",
          style: "casual",
          style_keywords: ["daily jacket", "light layer"],
          warmth: "light"
        };
  }

  return enrichItemShape({}, {
    slot: "outer",
    ...base,
    gender: baseGenderText(genderText)
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = req.headers.authorization || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!accessToken) return res.status(401).json({ error: "Missing Bearer token" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: "Supabase env not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
      });
    }

    const userRes = await getUserFromSupabase({ supabaseUrl, serviceKey, accessToken });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid token", detail: userRes.detail });

    const user = userRes.user;
    const userId = user.id;
    const userEmail = user.email || "";

    const profile = await getOrCreateProfile({
      supabaseUrl,
      serviceKey,
      userId,
      email: userEmail
    });

    const isTester = !!profile.is_tester;
    let creditsLeftAfter = Number(profile.credits_left ?? 0);

    if (!isTester) {
      const deduct = await deductOneCreditAtomic({ supabaseUrl, serviceKey, userId });

      if (!deduct.ok) {
        return res.status(403).json({
          error: "No credits left",
          credits_left: deduct.credits_left ?? 0
        });
      }

      creditsLeftAfter = deduct.credits_left;
    }

    const {
      gender,
      age,
      height,
      weight,
      style,
      styleVariant,
      temp,
      withBag,
      withHat,
      withCoat
    } = req.body || {};

    if (!gender || !age || !height || !weight || !style || temp === undefined) {
      return res.status(400).json({
        error: "Missing parameters",
        credits_left: creditsLeftAfter
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const h = height / 100;
    const bmi = weight / (h * h);

    let bodyShape = "average body shape";
    if (bmi < 19) bodyShape = "slim body shape";
    else if (bmi < 25) bodyShape = "average body shape";
    else if (bmi < 30) bodyShape = "slightly chubby body shape";
    else bodyShape = "plus-size body shape";

    const genderText =
      gender === "female" ? "female" :
      gender === "male" ? "male" :
      "gender-neutral";

    const styleMap = {
      casual: "casual daily style",
      minimal: "minimal, clean office-casual style",
      street: "streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style"
    };
    const styleText = styleMap[style] || "casual style";

    let variantHint = "";
    if (styleVariant && variantPromptMap[styleVariant]) {
      variantHint = variantPromptMap[styleVariant].desc;
    }

    const systemInstruction = `
You are a stylist that only returns STRICT JSON.

You design outfits as a list of shopping-friendly fashion items.

Your JSON MUST have this exact shape:

{
  "summary": "short natural language summary of this outfit in 1-2 sentences (in Traditional Chinese)",
  "items": [
    {
      "slot": "top" | "bottom" | "shoes" | "outer" | "bag" | "hat",
      "generic_name": "english shopping-friendly item name",
      "display_name_zh": "中文短名稱，例如「海軍藍短袖針織Polo衫」",
      "category": "specific searchable product category, e.g. \\"polo shirt\\", \\"wide leg trousers\\", \\"low-top leather sneakers\\"",
      "color": "simple color in English",
      "fit": "slim | regular | relaxed | oversized",
      "material": "specific material if visually important, e.g. cotton, knit cotton, denim, leather, linen",
      "sleeve_length": "short sleeve | long sleeve | sleeveless | none",
      "length": "cropped | regular | long | ankle-length | full-length",
      "neckline": "crew neck | polo collar | v-neck | shirt collar | hooded | lapel collar | none",
      "silhouette": "clean | straight | tapered | boxy | structured | relaxed | flowy | minimal",
      "style": "casual | minimal | street | sporty | smart",
      "style_keywords": ["2 to 4 short shopping-friendly phrases"],
      "gender": "female" | "male" | "unisex",
      "warmth": "light" | "medium" | "warm"
    }
  ]
}

HARD rules (VERY IMPORTANT):
- Always include EXACTLY ONE item with slot = "top".
- Always include EXACTLY ONE item with slot = "bottom".
- Always include EXACTLY ONE item with slot = "shoes".
- If user asked for coat/outer (withCoat = true) OR temperature <= 20°C,
  you MUST include EXACTLY ONE item with slot = "outer".
- If user asked for bag (withBag = true), you MUST include EXACTLY ONE item with slot = "bag".
- If user asked for hat (withHat = true), you MUST include EXACTLY ONE item with slot = "hat".
- If user did NOT ask for bag/hat/outer, you should NOT include those slots.
- slot MUST be one of: "top", "bottom", "shoes", "outer", "bag", "hat". No other values.
- category must be SPECIFIC and searchable. Bad: "top". Good: "short-sleeve knit polo shirt".
- fit is required for top, bottom, outer.
- material is required whenever visually important.
- sleeve_length is required for top and outer.
- silhouette is required for clothing items.
- style_keywords must contain 2-4 short shopping-friendly phrases.
- Keep wording concrete, realistic, and searchable.
- Return ONLY valid JSON, with no extra text, comments, or explanations.
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
- with bag: ${withBag ? "true" : "false"}
- with hat: ${withHat ? "true" : "false"}
- with coat/outer: ${withCoat ? "true" : "false"}

Style variant:
- ${styleVariant || "none"}
- Additional styling hints: ${variantHint || "none"}

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
      return res.status(500).json({
        error: "Gemini SPEC API error",
        detail: errText,
        credits_left: creditsLeftAfter
      });
    }

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "Failed to parse JSON from Gemini",
        raw: text,
        credits_left: creditsLeftAfter
      });
    }

    let items = Array.isArray(parsed.items) ? parsed.items : [];
    items = items
      .map((it) => enrichItemShape(it))
      .filter((it) => it.slot && it.generic_name);

    const hasSlot = (slotName) => items.some((it) => it.slot === slotName);

    const pushIfMissing = (slotName, fallbackFactory) => {
      if (!hasSlot(slotName)) items.push(fallbackFactory());
    };

    pushIfMissing("top", () => fallbackTop(genderText));
    pushIfMissing("bottom", () => fallbackBottom(genderText));
    pushIfMissing("shoes", () => fallbackShoes());

    if (withCoat || temp <= 20) {
      pushIfMissing("outer", () => fallbackOuter(style, temp, genderText));
    } else {
      items = items.filter((it) => it.slot !== "outer");
    }

    if (withBag) {
      pushIfMissing("bag", () => fallbackBag());
    } else {
      items = items.filter((it) => it.slot !== "bag");
    }

    if (withHat) {
      pushIfMissing("hat", () => fallbackHat());
    } else {
      items = items.filter((it) => it.slot !== "hat");
    }

    items = items
      .map((it) => enrichItemShape(it))
      .filter((it) => !!it.slot && !!it.generic_name);

    return res.status(200).json({
      credits_left: creditsLeftAfter,
      is_tester: isTester,
      summary: parsed.summary || "",
      items
    });
  } catch (err) {
    console.error("generate-outfit-spec error:", err);
    return res.status(500).json({
      error: err.message || "Unknown error"
    });
  }
}
