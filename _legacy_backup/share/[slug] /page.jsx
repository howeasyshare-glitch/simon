"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [state, setState] = useState({
    loading: true,
    error: "",
    outfit: null,
  });

  useEffect(() => {
    if (!slug) return;

    let alive = true;

    async function load() {
      try {
        // 👉 呼叫你已經有的 API
        const res = await fetch(`/api/share/${slug}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "載入失敗");
        }

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          outfit: json.outfit,
        });
      } catch (err) {
        if (!alive) return;
        setState({
          loading: false,
          error: String(err),
          outfit: null,
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (state.loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>載入穿搭中…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ padding: 24 }}>
        <p>❌ 發生錯誤</p>
        <pre>{state.error}</pre>
      </div>
    );
  }

  const { outfit } = state;
  const imageUrl = outfit?.image_url;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {/* 圖片 */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="AI 穿搭"
          style={{
            width: "100%",
            borderRadius: 16,
            marginBottom: 16,
          }}
        />
      ) : (
        <div>找不到圖片</div>
      )}

      {/* 基本資訊 */}
      <h1>這套穿搭怎麼樣？</h1>

      <pre
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          borderRadius: 8,
          whiteSpace: "pre-wrap",
        }}
      >
{JSON.stringify(
  {
    created_at: outfit.created_at,
    style: outfit.style,
    spec: outfit.spec,
  },
  null,
  2
)}
      </pre>

      {/* 行動按鈕 */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => router.push("/")}
          style={{ padding: "10px 16px", cursor: "pointer" }}
        >
          製作屬於自己的穿搭
        </button>
      </div>
    </div>
  );
}
