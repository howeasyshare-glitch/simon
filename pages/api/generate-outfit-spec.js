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

  // query existing (✅ credits_left)
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

  // create (✅ credits_left)
  const ins = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      id: userId,
      email,
      credits_left: 3, // 初始點數（你可改成 10）
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

/**
 * ✅ 更穩：用「原子扣點」避免併發/重整造成負數或重複扣
 * 這裡用 PostgREST 的 PATCH + filter：credits_left=gt.0
 * 並要求回傳 updated row；如果回傳空陣列代表點數不足
 */
async function deductOneCreditAtomic({ supabaseUrl, serviceKey, userId }) {
  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=representation"
  };

  const url =
    `${supabaseUrl}/rest/v1/profiles` +
    `?id=eq.${encodeURIComponent(userId)}` +
    `&credits_left=gt.0`;

  // 這裡用 SQL 方式遞減做不到（PostgREST PATCH 是 set）
  // 所以我們採「先讀後扣」也行，但會有 race condition。
  // 最穩的方式是用 RPC (SQL function)；先給你可用版本：讀 -> 扣（保留原結構）
  // ----
  // 下面採「讀 -> 扣」並在 update 時再檢查 credits_left=eq.current，避免併發：
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
      headers,
      body: JSON.stringify({ credits_left: newCredits, updated_at: new Date().toISOString() })
    }
  );

  const updText = await upd.text();
  if (!upd.ok) throw new Error("profiles update failed: " + updText);

  const updatedRows = JSON.parse(updText);
  if (!updatedRows?.[0]) {
    // 代表在你扣點前有人改過 credits_left（併發），保守回「點數不足/請重試」
    return { ok: false, credits_left: current };
  }

  return { ok: true, credits_left: updatedRows[0].credits_left };
}
// TEMP hotfix: prevent crash when deduct is missing
async function deduct() {
  return { ok: true, skipped: true };
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


    // === 2) 扣 1 點（✅ credits_left）===
    // === 2) 扣 1 點（測試者不扣）===
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
} else {
  // 🎯 測試者：不扣點
  // 如果你想 UI 看起來是無限點數，可以改成：
  // creditsLeftAfter = 9999;
}


    // === 3) 你的原本邏輯：讀參數 + Gemini 產生 spec ===
    // ✅ 支援兩種 body：
// A) { gender, age, ... }（直接送）
// B) { payload: { gender, age, ... } }（你現在前端送法）
const body = (req.body && (req.body.payload || req.body)) || {};

// ✅ 兼容欄位命名（前端可能叫 styleId / temperature）
const gender = body.gender;
const age = body.age;
const height = body.height;
const weight = body.weight;

// 後端原本叫 style；前端常會叫 styleId
const style = body.style || body.styleId;

// 後端叫 styleVariant；你可能用 celeb/brand 的 key
const styleVariant = body.styleVariant || body.variant || body.celebrity || body.inspiration;

// temp 必須允許 0（所以用 nullish coalescing）
const temp = body.temp ?? body.temperature;

// accessories
const withBag = !!body.withBag;
const withHat = !!body.withHat;
const withCoat = !!body.withCoat;

if (!gender || !age || !height || !weight || !style || temp === undefined || temp === null) {
  return res.status(400).json({
    error: "Missing parameters",
    // ✅ 回傳扣點後的點數（你前面算好的）
    credits_left: creditsLeftAfter,
    // ✅ 額外附上 server 看到哪些欄位，方便 debug（不影響版面，只有 API response）
    detail: {
      hasPayloadWrapper: !!req.body?.payload,
      receivedKeys: Object.keys(body || {}),
      missing: {
        gender: !gender,
        age: !age,
        height: !height,
        weight: !weight,
        style: !style,
        temp: temp === undefined || temp === null,
      },
    },
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

    const genderText = gender === "female" ? "female" : gender === "male" ? "male" : "gender-neutral";

    const styleMap = {
      casual: "casual daily style",
      minimal: "minimal, clean office-casual style",
      street: "streetwear style",
      sporty: "sporty athleisure style",
      smart: "smart casual style"
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
        contents: [{ role: "user", parts: [{ text: systemInstruction }, { text: userInstruction }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return res.status(500).json({
        error: "Gemini SPEC API error",
        detail: errText,
        credits_left: deduct.credits_left
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
        credits_left: deduct.credits_left
      });
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

    // fallback: top/bottom/shoes
    pushIfMissing("top", {
      slot: "top",
      generic_name: "oversized cotton crew neck t-shirt",
      display_name_zh: "寬版棉質圓領上衣",
      color: "white",
      style: "casual",
      gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
      warmth: "light"
    });

    pushIfMissing("bottom", {
      slot: "bottom",
      generic_name: "straight leg jeans",
      display_name_zh: "直筒牛仔褲",
      color: "light blue",
      style: "casual",
      gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
      warmth: "light"
    });

    pushIfMissing("shoes", {
      slot: "shoes",
      generic_name: "white low-top sneakers",
      display_name_zh: "白色休閒鞋",
      color: "white",
      style: "casual",
      gender: "unisex",
      warmth: "light"
    });

    // 外套 fallback：依 style + 溫度
    if (withCoat || temp <= 20) {
      const isCold = temp <= 10;
      const isCool = temp > 10 && temp <= 18;

      let outerPreset;

      if (style === "minimal") {
        outerPreset = isCold
          ? { generic_name: "long wool coat", display_name_zh: "長版羊毛大衣", color: "camel", style: "minimal", warmth: "warm" }
          : isCool
          ? { generic_name: "long belted trench coat", display_name_zh: "綁帶長版風衣外套", color: "beige", style: "minimal", warmth: "medium" }
          : { generic_name: "lightweight open-front jacket", display_name_zh: "輕薄落肩外套", color: "light beige", style: "minimal", warmth: "light" };
      } else if (style === "street") {
        outerPreset = isCold
          ? { generic_name: "oversized padded bomber jacket", display_name_zh: "寬版鋪棉飛行外套", color: "black", style: "street", warmth: "warm" }
          : isCool
          ? { generic_name: "oversized denim jacket", display_name_zh: "寬版牛仔外套", color: "mid blue", style: "street", warmth: "medium" }
          : { generic_name: "lightweight coach jacket", display_name_zh: "薄款教練外套", color: "navy", style: "street", warmth: "light" };
      } else if (style === "sporty") {
        outerPreset = isCold
          ? { generic_name: "padded hooded parka", display_name_zh: "鋪棉帽T外套", color: "dark gray", style: "sporty", warmth: "warm" }
          : isCool
          ? { generic_name: "zip-up track jacket", display_name_zh: "拉鍊運動外套", color: "black", style: "sporty", warmth: "medium" }
          : { generic_name: "lightweight zip hoodie", display_name_zh: "輕薄連帽外套", color: "light gray", style: "sporty", warmth: "light" };
      } else if (style === "smart") {
        outerPreset = isCold
          ? { generic_name: "tailored wool coat", display_name_zh: "修身羊毛大衣", color: "dark navy", style: "smart", warmth: "warm" }
          : isCool
          ? { generic_name: "short trench coat", display_name_zh: "短版風衣外套", color: "beige", style: "smart", warmth: "medium" }
          : { generic_name: "unstructured blazer", display_name_zh: "輕薄休閒西裝外套", color: "dark gray", style: "smart", warmth: "light" };
      } else {
        // casual
        outerPreset = isCold
          ? { generic_name: "padded jacket", display_name_zh: "保暖外套", color: "beige", style: "casual", warmth: "warm" }
          : isCool
          ? { generic_name: "cotton parka jacket", display_name_zh: "棉質連帽外套", color: "khaki", style: "casual", warmth: "medium" }
          : { generic_name: "lightweight utility jacket", display_name_zh: "輕薄機能外套", color: "olive", style: "casual", warmth: "light" };
      }

      pushIfMissing("outer", {
        slot: "outer",
        generic_name: outerPreset.generic_name,
        display_name_zh: outerPreset.display_name_zh,
        color: outerPreset.color,
        style: outerPreset.style,
        gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
        warmth: outerPreset.warmth
      });
    } else {
      items = items.filter((it) => it.slot !== "outer");
    }

    // 包包
    if (withBag) {
      pushIfMissing("bag", {
        slot: "bag",
        generic_name: "minimalist canvas shoulder bag",
        display_name_zh: "極簡帆布側背包",
        color: "beige",
        style: "minimal",
        gender: "unisex",
        warmth: "light"
      });
    } else {
      items = items.filter((it) => it.slot !== "bag");
    }

    // 帽子
    if (withHat) {
      pushIfMissing("hat", {
        slot: "hat",
        generic_name: "cotton baseball cap",
        display_name_zh: "棉質棒球帽",
        color: "beige",
        style: "casual",
        gender: "unisex",
        warmth: "light"
      });
    } else {
      items = items.filter((it) => it.slot !== "hat");
    }

    items = items.filter((it) => !!it.slot && !!it.generic_name);

    // ✅ 回傳加上 credits_left
   return res.status(200).json({
  credits_left: creditsLeftAfter,
  is_tester: isTester,
  summary: parsed.summary || "",
  items
});

  } catch (err) {
    console.error("generate-outfit-spec error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
