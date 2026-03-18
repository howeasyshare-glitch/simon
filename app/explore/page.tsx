"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import NavBar from "../../components/NavBar";
import OutfitCard, { type OutfitItem } from "../../components/OutfitCard";
import { apiGetJson } from "../../lib/apiFetch";

export default function Page() {
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [sort, setSort] = useState('like');
  const [status, setStatus] = useState('');
  const [zoomSrc, setZoomSrc] = useState('');
  useEffect(() => { load(); }, [sort]);
  async function load() { try { const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=explore&limit=60&sort=${sort}&ts=${Date.now()}`); setItems(data?.items || []); } catch { setItems([]); setStatus('載入失敗'); } }
  function isLiked(id: string) { return typeof window !== 'undefined' && localStorage.getItem(`liked_outfit_${id}`) === '1'; }
  async function toggleLike(item: OutfitItem) { let anonId = localStorage.getItem('findoutfit_anon_id'); if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem('findoutfit_anon_id', anonId); } const alreadyLiked = isLiked(item.id); const op = alreadyLiked ? 'outfits.unlike' : 'outfits.like'; const r = await fetch(`/api/data?op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }) }); const j = await r.json(); if (!r.ok || !j?.ok) return; if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, '1'); setItems(prev => prev.map(x => x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x)); setStatus(alreadyLiked ? '已取消最愛' : '已加入最愛 ✅'); }
  async function shareItem(item: OutfitItem) { if (!item.share_slug) return; const key = `shared_outfit_${item.id}`; if (localStorage.getItem(key) !== '1') { const r = await fetch(`/api/data?op=outfits.share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id }) }); const j = await r.json(); if (r.ok && j?.ok) { localStorage.setItem(key, '1'); setItems(prev => prev.map(x => x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x)); } } await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`); setStatus('已複製分享連結 ✅'); }
  function applyPreset(item: OutfitItem) { localStorage.setItem('findoutfit_apply_preset', JSON.stringify({ style: item.style?.style || '', palette: item.style?.palette || '', styleVariant: item.style?.styleVariant || '', id: item.id })); window.location.href = '/'; }
  return <main className={styles.page}><NavBar /><section className={styles.contentWrap}><div className={styles.sectionHead}><div><div className={styles.kicker}>Explore</div><h1 className={styles.sectionTitle}>全部公開穿搭</h1></div><div className={styles.pillRow}>{['like','share','time'].map(s => <button key={s} className={sort === s ? styles.activePill : styles.pill} onClick={() => setSort(s)}>{s === 'like' ? 'Like 排序' : s === 'share' ? '分享排序' : '時間排序'}</button>)}</div></div>{!!status ? <div className={styles.statusBar}>{status}</div> : null}<div className={styles.exploreGrid}>{items.map(item => <OutfitCard key={item.id} item={item} liked={isLiked(item.id)} onOpen={() => item.image_url && setZoomSrc(item.image_url)} onLike={() => toggleLike(item)} onShare={() => shareItem(item)} onApply={() => applyPreset(item)} />)}</div></section>{zoomSrc ? <div className={styles.modalBackdrop} onClick={() => setZoomSrc('')}><img src={zoomSrc} alt='' className={styles.modalImg} /></div> : null}</main>;
}
