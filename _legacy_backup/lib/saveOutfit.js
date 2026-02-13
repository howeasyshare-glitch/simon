import { uploadOutfitImage } from "./uploadOutfitImage";

export async function saveOutfit({
  imageBase64,
  spec,
  style,
  summary,
  products,
  accessToken,
  userId,
  isPublic = true,
}) {
  if (!imageBase64) throw new Error("缺少 imageBase64");
  if (!accessToken) throw new Error("缺少 accessToken（未登入？）");
  if (!userId) throw new Error("缺少 userId（未登入？）");

  // 1) 先產生 outfitId（用來命名圖片檔）
  const outfitId = crypto.randomUUID();

  // 2) 上傳圖片到 Storage，拿到 image_path
  const imagePath = await uploadOutfitImage({
    imageBase64,
    userId,
    outfitId,
  });

  // 3) 寫入 DB（呼叫你的 API）
  const res = await fetch("/api/outfits/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spec,
      style,
      summary,
      products,
      image_path: imagePath,
      is_public: isPublic,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "建立 outfit 失敗");
  }

  // 4) 回傳分享 slug
  return {
    id: json.id,
    share_slug: json.share_slug,
    image_path: imagePath,
  };
}
