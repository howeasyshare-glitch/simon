// pages/api/generate-outfit-spec.js
// 用 gemini-2.0-flash 產生結構化的 Outfit Spec（JSON），並確保必備部位存在

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

    // ===== 身材描述 =====
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

    // ===== System 指令：強制 JSON 格式 + 指定 slot 名稱 =====
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
- Style should match Japanese minimal casual brands similar to UNIQLO: clean, simple, no logos.
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
            parts: [{ text: systemInstruction }, { text: userInstruction }]
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

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

    let items = Array.isArray(parsed.items) ? parsed.items : [];

    // ===== 後處理：確保必要 slot 存在，並與前端勾選同步 =====
    // 1. 正規化 slot
    const normalizeSlot = (slot) => {
      if (!slot) return null;
      const s = String(slot).toLowerCase();
      if (["top", "bottom", "shoes", "outer", "bag", "hat"].includes(s)) {
        return s;
      }
      return null;
    };

    items = items
      .map((it) => ({
        ...it,
        slot: normalizeSlot(it.slot)
      }))
      .filter((it) => it.slot && it.generic_name); // 沒 slot 或沒名字就丟掉

    // 快速查詢 function
    const hasSlot = (slotName) => items.some((it) => it.slot === slotName);

    const pushIfMissing = (slotName, fallback) => {
      if (!hasSlot(slotName)) {
        items.push(fallback);
      }
    };

    // 2. 必備：top / bottom / shoes
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

    // 3. 外套：只有當 withCoat=true 或 氣溫 <=20 度時才要有
    if (withCoat || temp <= 20) {
      pushIfMissing("outer", {
        slot: "outer",
        generic_name: temp <= 15 ? "padded jacket" : "lightweight jacket",
        display_name_zh: temp <= 15 ? "保暖外套" : "輕薄外套",
        color: "beige",
        style: "casual",
        gender: genderText === "female" ? "female" : genderText === "male" ? "male" : "unisex",
        warmth: temp <= 15 ? "warm" : "medium"
      });
    } else {
      // 沒勾外套就把 outer 刪掉
      items = items.filter((it) => it.slot !== "outer");
    }

    // 4. 包包：只有 withBag=true 才要有
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

    // 5. 帽子：只有 withHat=true 才要有
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

    // 最後再保險檢查一次
    items = items.filter((it) => !!it.slot && !!it.generic_name);

    return res.status(200).json({
      summary: parsed.summary || "",
      items
    });
  } catch (err) {
    console.error("generate-outfit-spec error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
