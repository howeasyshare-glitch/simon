// lib/uploadOutfitImage.js
import { dataUrlToFile } from "./imageUtils";
import { supabase } from "./supabaseClient";

export async function uploadOutfitImage({
  imageBase64,
  userId,
  outfitId,
}) {
  const file = dataUrlToFile(imageBase64, "outfit.png");
  const filePath = `${userId}/${outfitId}.png`;

  const { error } = await supabase.storage
    .from("outfits")
    .upload(filePath, file, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error("圖片上傳失敗：" + error.message);
  }

  return filePath;
}
