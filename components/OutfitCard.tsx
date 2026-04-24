"use client";

type Props = {
  item: any;
  onSelect?: (item: any) => void;
  userProfile?: {
    gender?: string;
    age?: string | number;
    height?: string | number;
    weight?: string | number;
    temperature?: string | number;
    styleSummary?: string;
  };
};

function labelGender(v?: string) {
  const g = String(v || "").toLowerCase();

  if (["male", "man", "men", "男", "男性"].includes(g)) return "男性";
  if (["female", "woman", "women", "女", "女性"].includes(g)) return "女性";
  return "中性";
}

export default function OutfitCard({
  item,
  onSelect,
  userProfile,
}: Props) {
  const products = item?.products || [];
  const image = item?.image || item?.imageUrl || item?.url || "";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* 主圖 */}
      {image ? (
        <img
          src={image}
          alt="outfit"
          className="w-full aspect-[4/5] object-cover"
        />
      ) : null}

      {/* 設定卡 */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100 bg-zinc-50">
        <div className="text-sm font-semibold text-zinc-900 mb-2">
          本次設定
        </div>

        <div className="text-sm text-zinc-700 leading-7">
          <div>
            {labelGender(userProfile?.gender)}・成人
          </div>

          <div>
            年齡 {userProfile?.age || "-"}　
            身高 {userProfile?.height || "-"}　
            體重 {userProfile?.weight || "-"}
          </div>

          <div>
            氣溫 {userProfile?.temperature || "-"}°C
          </div>

          <div className="text-zinc-500">
            {userProfile?.styleSummary || "今日推薦風格"}
          </div>
        </div>
      </div>

      {/* 商品區 */}
      <div className="p-4">
        <div className="text-sm font-semibold text-zinc-900 mb-3">
          查看單品
        </div>

        {/* 單層滾動：取消內層 max-height */}
        <div className="grid gap-3">
          {products.map((p: any, idx: number) => (
            <a
              key={idx}
              href={p.link}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50 transition"
            >
              {p.thumbnail ? (
                <img
                  src={p.thumbnail}
                  alt={p.title}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-900 line-clamp-2">
                  {p.title}
                </div>

                <div className="text-xs text-zinc-500 mt-1">
                  {p.merchant || "推薦商品"}
                </div>

                <div className="text-sm font-semibold text-zinc-900 mt-2">
                  {p.price || ""}
                </div>
              </div>
            </a>
          ))}
        </div>

        {onSelect ? (
          <button
            onClick={() => onSelect(item)}
            className="mt-4 w-full rounded-xl bg-black text-white py-3 text-sm font-medium"
          >
            使用此穿搭
          </button>
        ) : null}
      </div>
    </div>
  );
}
