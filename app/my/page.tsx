"use client";

import { useEffect, useState } from "react";

type OutfitRow = {
  id: string;
  created_at?: string;
  share_slug?: string | null;
  image_url?: string;
  summary?: string | null;
  style?: any;
  is_public?: boolean;
};

function fmtDate(ts?: string) {
  if (!ts) return "剛剛";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "剛剛";
  return d.toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
  });
}

export default function Page() {
  const [recent, setRecent] = useState<OutfitRow[]>([]);
  const [favorites, setFavorites] = useState<OutfitRow[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      try {
        const r = await fetch(`/api/data?op=outfits.recent&limit=20`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const data = await r.json();
        setRecent(data?.items || []);
      } catch {
        setRecent([]);
      } finally {
        setLoadingRecent(false);
      }
    }

    async function loadFavorites() {
      try {
        let anonId = localStorage.getItem("findoutfit_anon_id");
        if (!anonId) {
          anonId = crypto.randomUUID();
          localStorage.setItem("findoutfit_anon_id", anonId);
        }

        const r = await fetch(
          `/api/data?op=outfits.favorites&limit=20&anon_id=${encodeURIComponent(anonId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );
        const data = await r.json();
        setFavorites(data?.items || []);
      } catch {
        setFavorites([]);
      } finally {
        setLoadingFavorites(false);
      }
    }

    loadRecent();
    loadFavorites();
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>我的穿搭</h1>

      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>最近生成</h2>
        </div>

        {loadingRecent ? (
          <div>載入中…</div>
        ) : recent.length === 0 ? (
          <div>目前沒有最近生成資料</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {recent.map((it) => (
              <a
                key={it.id}
                href={it.is_public && it.share_slug ? `/share/${it.share_slug}` : "/my"}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 5",
                      objectFit: "cover" as const,
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 5",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                )}

                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{it.style?.style || "Outfit"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {fmtDate(it.created_at)} · {it.is_public ? "已公開" : "未公開"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>我的最愛</h2>
        </div>

        {loadingFavorites ? (
          <div>載入中…</div>
        ) : favorites.length === 0 ? (
          <div>目前沒有收藏資料</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            {favorites.map((it) => (
              <a
                key={it.id}
                href={it.share_slug ? `/share/${it.share_slug}` : "/my"}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 5",
                      objectFit: "cover" as const,
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 5",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                )}

                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{it.style?.style || "Outfit"}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{it.summary || "已收藏"}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
