
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Outfit = {
  id: string;
  created_at?: string;
  image_url?: string;
  share_slug?: string;
  is_public?: boolean;
};

export default function Page() {
  const [recent, setRecent] = useState<Outfit[]>([]);

  async function loadRecent() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;

    const r = await fetch("/api/data?op=outfits.recent&limit=10", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    if (!r.ok) return;

    const json = await r.json();
    setRecent(json.items || []);
  }

  useEffect(() => {
    loadRecent();
  }, []);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1 style={{ color: "rgba(255,255,255,0.92)" }}>我的穿搭</h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))",
        gap: 16,
        marginTop: 20
      }}>
        {recent.map((it) => (
          <a key={it.id} href={it.share_slug ? `/share/${it.share_slug}` : "#"}>
            {it.image_url ? (
              <img
                src={it.image_url}
                style={{
                  width: "100%",
                  aspectRatio: "4 / 5",
                  objectFit: "cover" as const,
                  display: "block"
                }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: "4 / 5", background: "#222" }} />
            )}
          </a>
        ))}
      </div>
    </main>
  );
}
