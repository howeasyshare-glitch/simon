// pages/api/generate-outfit-spec.js
// 用 gemini-2.0-flash 產生 Outfit Spec JSON（身材＋風格＋品牌/名人變體）
// ✅ Supabase token 驗證 + profiles(credits_left) 自動建立 + 每次扣 1 點 + 回傳 credits_left

const variantPromptMap = {
  "brand-uniqlo": { desc: "Japanese everyday casual style similar to UNIQLO: simple basics, clean lines, comfortable fits, no visible logos.", baseStyle: "casual" },
  "brand-muji": { desc: "MUJI-like minimal lifestyle clothing: soft neutral colors, linen and cotton, relaxed fit, very simple design, no logos.", baseStyle: "casual" },
  "brand-cos": { desc: "COS-like modern minimalism: structured silhouettes, monochrome palette, slightly oversized shapes, design-focused details.", baseStyle: "minimal" },
  "brand-nike-tech": { desc: "Nike techwear inspired athleisure: technical fabrics, fitted joggers, hoodies or track jackets, sporty sneakers.", baseStyle: "sporty" },
  "brand-ader-error": { desc: "Korean streetwear similar to Ader Error: oversized fits, playful proportions, bold color accents, sometimes asymmetry.", baseStyle: "street" },

  "celeb-iu-casual": { desc: "Outfit styling inspired by IU's Korean casual looks: soft pastel colors, neat knitwear or shirts, straight pants, light outerwear. Do NOT copy her face or identity.", baseStyle: "casual" },
  "celeb-jennie-minimal": { desc: "Outfit styling inspired by Jennie's minimal chic outfits: clean silhouettes, cropped tops or neat knits, high-waisted bottoms, neutral tones. Do NOT copy her face or identity.", baseStyle: "minimal" },
  "celeb-gd-street": { desc: "Outfit styling inspired by G-Dragon's Korean street layering: bold layered pieces, interesting textures, statement shoes and accessories. Do NOT copy his face or identity.", baseStyle: "street" },
  "celeb-lisa-sporty": { desc: "Outfit styling inspired by Lisa's dancer athleisure: sporty crop tops, jogger pants, hoodies or jackets, cap and sneakers. Do NOT copy her face or identity.", baseStyle: "sporty" }
};

// === Supabase helpers (service role) ===
async function getUserFromSupabase({ supabaseUrl, serviceKey, accessToken }) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`,
    },
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
    Authorization: `Bearer ${serviceKey}`,
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
      updated_at: new Date().toISOString(),
    }),
  });

  if (!ins.ok) {
    const t = await ins.text();
    throw new Error("profiles insert failed: " + t);
  }

  const created = await ins.json();
  return created?.[0] || { id: userId, email, credits_left: 3 };
}

async function deductOneCreditAtomic({ supabaseUrl, serviceKey, userId }) {
  const read = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=credits_left,is_tester`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" } }
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
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ credits_left: newCredits, updated_at: new Date().toISOString() }),
    }
  );

  const updText = await upd.text();
  if (!upd.ok) throw new Error("profiles update failed: " + updText);

  const updatedRows = JSON.parse(updText);
  if (!updatedRows?.[0]) return { ok: false, credits_left: current };

  return { ok: true, credits_left: updatedRows[0].credits_left };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // === 0) 驗證登入 token（必須）===
    const auth = req.headers.authorization || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!accessToken) return res.status(401).json({ error: "Missing Bearer token" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: "Supabase env not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" });
    }

    const userRes = await getUserFromSupabase({ supabaseUrl, serviceKey, accessToken });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid token", detail: userRes.detail });

    const user = userRes.user;
    const userId = user.id;
    const userEmail = user.email || "";

    // === 1) 確保 profile 存在 ===
    const profile = await getOrCreateProfile({ supabaseUrl, serviceKey, userId, email: userEmail });

    // === 2) 扣點（測試者不扣）===
    const isTester = !!profile.is_tester;
    let creditsLeftAfter = Number(profile.credits_left ?? 0);

    if (!isTester) {
      const d = await deductOneCreditAtomic({ supabaseUrl, serviceKey, userId });
      if (!d.ok) {
        return res.status(403).json({ error: "No credits left", credits_left: d.credits_left ?? 0 });
      }
      creditsLeftAfter = d.credits_left;
    }

    // === 3) 讀參數（✅ 同時支援 body / body.payload / 欄位別名）===
    const body = (req.body && (req.body.payload || req.body)) || {};

    const gender = body.gender;
    const age = body.age;
    const height = body.height;
    const weight = body.weight;

    // ✅ 前端常用 styleId
    const style = body.style || body.styleId;

    // ✅ styleVariant 別名（你前端可能叫 celebrity/variant）
    const styleVariant = body.styleVariant || body.variant || body.celebrity || body.inspiration || "";

    // ✅ temp 別名（允許 0）
    const temp = body.temp ?? body.temperature;

    const withBag = !!body.withBag;
    const withHat = !!body.withHat;
    const withCoat = !!body.withCoat;

    if (!gender || !age || !height || !weight || !style || temp === undefined || temp === null) {
      return res.status(400).json({
        error: "Missing parameters",
        credits_left: creditsLeftAfter,
        detail: {
          hasPayloadWrapper: !!req.body?.payload,
          receivedKeys: Object.keys(body || {}),
          receivedSample: {
            gender,
            age,
            height,
            weight,
            style,
            styleVariant,
            temp,
            withBag,
            withHat,
            withCoat,
          },
        },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const h = Number(height) / 100;
    const bmi = Number(weight) / (h * h);

    let bodyShape = "average body shape";
    if (bmi < 19) bodyShape = "slim body shape";
    else if (bmi < 25) bodyShape = "average body shape";
    else if (bmi < 30) bodyShape = "slightly chubby body shape";
    else bodyShape = "plus-size body shape";

    const genderText = gender === "female" ? "female" : gender === "male" ? "male" : "gender-neutral";

    const styleMap = {
      casual: "casual daily style",
      minimal: "minimal, clean office-casual style",
      street: "streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style",
    };
    const styleText = styleMap[style] || "casual style";

    let variantHint = "";
    if (styleVariant && variantPromptMap[styleVariant]) variantHint = variantPromptMap[styleVariant].desc;

    const systemInstruction = `
You are a stylist that only returns STRICT JSON.

You design outfits as a list of items.

Your JSON MUST have this exact shape:

{
  "summary": "short natural language summary of this outfit in 1-2 sentences (in Traditional Chinese)",
  "items": [
    {
      "slot": "top" | "bottom" | "shoes" | "outer" | "bag" | "hat",
      "generic_name": "english generic clothing name, e.g. \\"oversized cotton crew neck t-shirt\\"",
      "display_name_zh": "短中文名稱，例如「寬版棉質圓領上衣」",
      "color": "simple color in English, e.g. \\"white\\", \\"beige\\", \\"light blue\\"",
      "style": "short style tag in English, e.g. \\"casual\\", \\"minimal\\", \\"street\\"",
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
- Colors should be realistic and easy to match.
- Use gender-neutral items (gender:"unisex") if they fit both genders.
- Return ONLY valid JSON, with no extra text, comments, or explanations.
`.trim();

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
`.trim();

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemInstruction }, { text: userInstruction }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });

    const errText = !geminiResponse.ok ? await geminiResponse.text() : "";

// ✅ Gemini error handling
if (!geminiResponse.ok) {
  // 嘗試解析出 429 retry 秒數
  let retryAfterSeconds = 30;
  try {
    const ej = JSON.parse(errText);
    const retry = ej?.error?.details?.find((d) => d?.["@type"]?.includes("RetryInfo"))?.retryDelay;
    if (typeof retry === "string" && retry.endsWith("s")) {
      const n = parseInt(retry.replace("s", ""), 10);
      if (!Number.isNaN(n) && n > 0) retryAfterSeconds = n;
    }
    const code = ej?.error?.code;
    const status = ej?.error?.status;

    // ✅ 429：回 429 給前端，不要當 500
    if (code === 429 || status === "RESOURCE_EXHAUSTED") {
      // ✅ Fallback：用規則產生 spec（讓產品可用）
      const genderText = gender === "female" ? "female" : gender === "male" ? "male" : "unisex";
      const baseStyle = (variantPromptMap[styleVariant]?.baseStyle || style) || "casual";

      const fallbackItems = [
        {
          slot: "top",
          generic_name: baseStyle === "minimal" ? "clean crew neck knit top" : "oversized cotton crew neck t-shirt",
          display_name_zh: baseStyle === "minimal" ? "俐落圓領針織上衣" : "寬版棉質圓領上衣",
          color: baseStyle === "minimal" ? "beige" : "white",
          style: baseStyle,
          gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
          warmth: temp <= 12 ? "medium" : "light",
        },
        {
          slot: "bottom",
          generic_name: baseStyle === "sporty" ? "tapered jogger pants" : "straight leg jeans",
          display_name_zh: baseStyle === "sporty" ? "錐形運動束口褲" : "直筒牛仔褲",
          color: baseStyle === "minimal" ? "dark gray" : "mid blue",
          style: baseStyle,
          gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
          warmth: "light",
        },
        {
          slot: "shoes",
          generic_name: "white low-top sneakers",
          display_name_zh: "白色休閒鞋",
          color: "white",
          style: baseStyle,
          gender: "unisex",
          warmth: "light",
        },
      ];

      // outer/bag/hat rules
      if (withCoat || temp <= 20) {
        fallbackItems.push({
          slot: "outer",
          generic_name: baseStyle === "street" ? "oversized denim jacket" : "lightweight jacket",
          display_name_zh: baseStyle === "street" ? "寬版牛仔外套" : "輕薄外套",
          color: baseStyle === "minimal" ? "camel" : "black",
          style: baseStyle,
          gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
          warmth: temp <= 12 ? "warm" : "medium",
        });
      }
      if (withBag) {
        fallbackItems.push({
          slot: "bag",
          generic_name: "minimalist shoulder bag",
          display_name_zh: "極簡側背包",
          color: "black",
          style: baseStyle,
          gender: "unisex",
          warmth: "light",
        });
      }
      if (withHat) {
        fallbackItems.push({
          slot: "hat",
          generic_name: "cotton baseball cap",
          display_name_zh: "棉質棒球帽",
          color: "black",
          style: baseStyle,
          gender: "unisex",
          warmth: "light",
        });
      }

      // ✅ 重點：429 時不要扣點（避免「點數被扣但沒拿到」）
      return res.status(200).json({
        credits_left: creditsLeftAfter, // 你目前已經先扣了點：如果你想完全不扣，要把扣點移到 gemini 成功後
        is_tester: isTester,
        summary: "（暫時使用快速生成）依條件搭配的基礎穿搭。",
        items: fallbackItems,
        _fallback: true,
        _gemini_rate_limited: true,
        retry_after_seconds: retryAfterSeconds,
      });
    }
  } catch {
    // ignore JSON parse
  }

  // 非 429 的錯誤：維持 500
  return res.status(500).json({
    error: "Gemini SPEC API error",
    detail: errText,
    credits_left: creditsLeftAfter,
  });
}

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "Failed to parse JSON from Gemini", raw: text, credits_left: creditsLeftAfter });
    }

    let items = Array.isArray(parsed.items) ? parsed.items : [];

    const normalizeSlot = (slot) => {
      if (!slot) return null;
      const s = String(slot).toLowerCase();
      if (["top", "bottom", "shoes", "outer", "bag", "hat"].includes(s)) return s;
      return null;
    };

    items = items.map((it) => ({ ...it, slot: normalizeSlot(it.slot) })).filter((it) => it.slot && it.generic_name);

    const hasSlot = (slotName) => items.some((it) => it.slot === slotName);
    const pushIfMissing = (slotName, fallback) => { if (!hasSlot(slotName)) items.push(fallback); };

    // fallback
    pushIfMissing("top", {
      slot: "top",
      generic_name: "oversized cotton crew neck t-shirt",
      display_name_zh: "寬版棉質圓領上衣",
      color: "white",
      style: "casual",
      gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
      warmth: "light",
    });

    pushIfMissing("bottom", {
      slot: "bottom",
      generic_name: "straight leg jeans",
      display_name_zh: "直筒牛仔褲",
      color: "light blue",
      style: "casual",
      gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
      warmth: "light",
    });

    pushIfMissing("shoes", {
      slot: "shoes",
      generic_name: "white low-top sneakers",
      display_name_zh: "白色休閒鞋",
      color: "white",
      style: "casual",
      gender: "unisex",
      warmth: "light",
    });

    // ✅ 回傳（含 credits_left）
    return res.status(200).json({
      credits_left: creditsLeftAfter,
      is_tester: isTester,
      summary: parsed.summary || "",
      items,
      // ✅ 回傳一點點 debug：避免你再次對不到欄位（不影響畫面）
      _echo: { gender, age, height, weight, style, styleVariant, temp, withBag, withHat, withCoat },
    });
  } catch (err) {
    console.error("generate-outfit-spec error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
