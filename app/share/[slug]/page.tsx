"use client";

import { useEffect, useState } from "react";
import styles from "../../page.module.css";
import NavBar from "../../../components/NavBar";

type Outfit = { id: string; share_slug?: string; image_url?: string; summary?: string | null; style?: any; like_count?: number; share_count?: number };

export default function Page({ params }: { params: { slug: string } }) {
  const [item, setItem] = useState<Outfit | null>(null);
  const [status, setStatus] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  useEffect(() => { load(); }, [params.slug]);
  async function load() { const r = await fetch(`/api/share?slug=${encodeURIComponent(params.slug)}`, { cache: 'no-store' }); const j = await r.json(); if (r.ok && j?.ok) setItem(j.outfit); }
  function isLiked() { return !!item && typeof window !== 'undefined' && localStorage.getItem(`liked_outfit_${item.id}`) === '1'; }
  async function toggleLike() { if (!item) return; let anonId = localStorage.getItem('findoutfit_anon_id'); if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem('findoutfit_anon_id', anonId); } const alreadyLiked = isLiked(); const op = alreadyLiked ? 'outfits.unlike' : 'outfits.like'; const r = await fetch(`/api/data?op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }) }); const j = await r.json(); if (!r.ok || !j?.ok) return; if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, '1'); setItem(prev => prev ? { ...prev, like_count: j.like_count ?? prev.like_count } : prev); setStatus(alreadyLiked ? '已取消最愛' : '已加入最愛 ✅'); }
  async function shareItem() { if (!item?.share_slug) return; const key = `shared_outfit_${item.id}`; if (localStorage.getItem(key) !== '1') { const r = await fetch(`/api/data?op=outfits.share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id }) }); const j = await r.json(); if (r.ok && j?.ok) { localStorage.setItem(key, '1'); setItem(prev => prev ? { ...prev, share_count: j.share_count ?? prev.share_count } : prev); } } await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`); setStatus('已複製分享連結 ✅'); }
  function applyPreset() { if (!item) return; localStorage.setItem('findoutfit_apply_preset', JSON.stringify({ style: item.style?.style || '', palette: item.style?.palette || '', styleVariant: item.style?.styleVariant || '', id: item.id })); window.location.href = '/'; }
  return <main className={styles.page}><NavBar /><section className={styles.contentWrap}><div className={styles.sectionHead}><div><div className={styles.kicker}>Share</div><h1 className={styles.sectionTitle}>公開穿搭分享</h1></div></div>{item ? <div className={styles.shareStage}><button className={styles.shareImageBtn} onClick={() => setZoomOpen(true)}>{item.image_url ? <img src={item.image_url} alt='' className={styles.shareImage} /> : <div className={styles.heroImageFallback} />}</button><div className={styles.card}><div className={styles.cardTitle}>{item.style?.style || 'Outfit'}</div><div className={styles.cardText}>{item.summary || '分享頁'}</div><div className={styles.cardMeta}><span>♥ {item.like_count || 0}</span><span>↗ {item.share_count || 0}</span></div><div className={styles.cardActions}><button type='button' className={styles.ghostBtn} onClick={toggleLike}>{isLiked() ? '取消讚' : 'Like'}</button><button type='button' className={styles.ghostBtn} onClick={shareItem}>分享</button><button type='button' className={styles.primaryBtn} onClick={applyPreset}>套用</button></div>{!!status ? <div className={styles.statusBar}>{status}</div> : null}</div></div> : null}</section>{zoomOpen && item?.image_url ? <div className={styles.modalBackdrop} onClick={() => setZoomOpen(false)}><img src={item.image_url} alt='' className={styles.modalImg} /></div> : null}</main>;
}
