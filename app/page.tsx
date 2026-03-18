"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import NavBar from "../components/NavBar";
import HeroCarousel from "../components/HeroCarousel";
import OutfitCard, { type OutfitItem } from "../components/OutfitCard";
import { apiGetJson, apiPostJson } from "../lib/apiFetch";

type ImgResp = { ok?: boolean; image_url?: string; image_path?: string; storage_path?: string };

const scenes = [
  { id: "date", label: "約會" },
  { id: "commute", label: "通勤" },
  { id: "party", label: "聚會" },
  { id: "outdoor", label: "戶外" },
];
const celebs = [
  { id: "jennie", label: "Jennie" },
  { id: "iu", label: "IU" },
  { id: "gd", label: "G-Dragon" },
  { id: "hailey", label: "Hailey" },
];

export default function Page() {
  const [featured, setFeatured] = useState<OutfitItem[]>([]);
  const [recent, setRecent] = useState<OutfitItem[]>([]);
  const [favorites, setFavorites] = useState<OutfitItem[]>([]);
  const [activeHero, setActiveHero] = useState(0);
  const [stage, setStage] = useState<"featured" | "generated">("featured");
  const [status, setStatus] = useState("");
  const [zoomSrc, setZoomSrc] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [temp, setTemp] = useState("");
  const [gender, setGender] = useState("女性");
  const [audience, setAudience] = useState("成人");
  const [selectedScene, setSelectedScene] = useState("date");
  const [selectedCeleb, setSelectedCeleb] = useState("");
  const [showCelebs, setShowCelebs] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");

  useEffect(() => { loadFeatured(); loadFavorites(); loadRecent(); tryApplyPresetFromStorage(); }, []);

  async function loadFeatured() {
    try { const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=explore&limit=8&sort=like&ts=${Date.now()}`); setFeatured(data?.items || []); } catch { setFeatured([]); }
  }
  async function loadRecent() {
    try { const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=outfits.recent&limit=8&ts=${Date.now()}`); setRecent(data?.items || []); } catch { setRecent([]); }
  }
  async function loadFavorites() {
    try {
      let anonId = localStorage.getItem('findoutfit_anon_id');
      if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem('findoutfit_anon_id', anonId); }
      const data = await apiGetJson<{ ok: boolean; items: OutfitItem[] }>(`/api/data?op=outfits.favorites&limit=8&anon_id=${encodeURIComponent(anonId)}&ts=${Date.now()}`);
      setFavorites(data?.items || []);
    } catch { setFavorites([]); }
  }
  function isLiked(id: string) { return typeof window !== 'undefined' && localStorage.getItem(`liked_outfit_${id}`) === '1'; }
  async function toggleLike(item: OutfitItem) {
    let anonId = localStorage.getItem('findoutfit_anon_id');
    if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem('findoutfit_anon_id', anonId); }
    const alreadyLiked = isLiked(item.id);
    const op = alreadyLiked ? 'outfits.unlike' : 'outfits.like';
    const r = await fetch(`/api/data?op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id, anon_id: anonId }) });
    const j = await r.json(); if (!r.ok || !j?.ok) return;
    if (alreadyLiked) localStorage.removeItem(`liked_outfit_${item.id}`); else localStorage.setItem(`liked_outfit_${item.id}`, '1');
    setFeatured(prev => prev.map(x => x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x));
    setFavorites(prev => prev.map(x => x.id === item.id ? { ...x, like_count: j.like_count ?? x.like_count } : x));
    setStatus(alreadyLiked ? '已取消最愛' : '已加入最愛 ✅');
  }
  async function shareItem(item: OutfitItem) {
    if (!item.share_slug) return;
    const key = `shared_outfit_${item.id}`;
    if (localStorage.getItem(key) !== '1') {
      const r = await fetch(`/api/data?op=outfits.share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outfit_id: item.id }) });
      const j = await r.json();
      if (r.ok && j?.ok) { localStorage.setItem(key, '1'); setFeatured(prev => prev.map(x => x.id === item.id ? { ...x, share_count: j.share_count ?? x.share_count } : x)); }
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${item.share_slug}`);
    setStatus('已複製分享連結 ✅');
  }
  function applyPreset(item: OutfitItem) {
    const label = item.style?.style || '';
    if (label.includes('minimal')) setSelectedScene('date');
    if (label.includes('street')) setSelectedScene('party');
    if (label.includes('casual')) setSelectedScene('commute');
    setSelectedCeleb(''); setShowCelebs(false)
    setStatus('已套用靈感 ✅');
  }
  function tryApplyPresetFromStorage() {
    try { const raw = localStorage.getItem('findoutfit_apply_preset'); if (!raw) return; JSON.parse(raw); setStatus('已套用靈感 ✅'); localStorage.removeItem('findoutfit_apply_preset'); } catch {}
  }
  const activePreset = useMemo(() => { if (selectedCeleb) return celebs.find(c => c.id === selectedCeleb)?.label || ''; return scenes.find(s => s.id === selectedScene)?.label || ''; }, [selectedScene, selectedCeleb]);
  async function handleGenerate() {
    try {
      setStatus('正在生成…');
      const promptContext = selectedCeleb ? `名人靈感：${celebs.find(c => c.id === selectedCeleb)?.label || ''}` : `情境：${scenes.find(s => s.id === selectedScene)?.label || ''}`;
      const specResp = await apiPostJson<any>('/api/generate-outfit-spec', { age, height, weight, temp, gender, audience, promptContext });
      const specObj = specResp?.spec || specResp;
      const imgResp = await apiPostJson<ImgResp>('/api/generate-image', { age, height, weight, temp, gender, audience, outfitSpec: { items: specObj?.items || [], summary: specObj?.summary || promptContext }, aspectRatio: '3:4', imageSize: '1K' });
      const url = imgResp?.image_url || ''; const path = imgResp?.image_path || imgResp?.storage_path || '';
      setGeneratedImageUrl(url); setGeneratedSummary(specObj?.summary || promptContext); setStage('generated');
      try {
        const created = await apiPostJson<any>('/api/data?op=outfits.create', { image_url: url, image_path: path, is_public: true, spec: specObj, style: { style: selectedCeleb ? 'celeb-inspired' : selectedScene, palette: 'auto', styleVariant: selectedCeleb || selectedScene, gender, audience }, summary: specObj?.summary || promptContext, products: null });
        const slug = created?.outfit?.share_slug; if (slug) setGeneratedShareUrl(`${window.location.origin}/share/${slug}`);
      } catch {}
      setStatus('完成 ✅'); loadFeatured(); loadRecent();
    } catch (e: any) { setStatus(e?.message || '生成失敗'); }
  }

  return (
    <main className={styles.page}>
      <NavBar />
      <section className={styles.contentWrap}>
        <HeroCarousel items={featured} active={activeHero} setActive={setActiveHero} stage={stage} setStage={setStage} generatedImageUrl={generatedImageUrl} generatedShareUrl={generatedShareUrl} generatedSummary={generatedSummary} onOpen={(src) => setZoomSrc(src)} onLike={toggleLike} onShare={shareItem} onApply={applyPreset} isLiked={isLiked} />
        {!!status ? <div className={styles.statusBar}>{status}</div> : null}
        <section className={styles.generatorSection}>
          <div className={styles.sectionHead}><div><div className={styles.kicker}>Builder</div><h2 className={styles.sectionTitle}>穿搭生成器</h2></div><div className={styles.badge}>已選：{activePreset || '未選擇'}</div></div>
          <div className={styles.card}><div className={styles.blockTitle}>主要條件</div><div className={styles.mainGrid}><input className={styles.field} placeholder='年齡' value={age} onChange={(e)=>setAge(e.target.value)} /><input className={styles.field} placeholder='身高' value={height} onChange={(e)=>setHeight(e.target.value)} /><input className={styles.field} placeholder='體重' value={weight} onChange={(e)=>setWeight(e.target.value)} /><input className={styles.field} placeholder='氣溫' value={temp} onChange={(e)=>setTemp(e.target.value)} /><select className={styles.field} value={gender} onChange={(e)=>setGender(e.target.value)}><option>女性</option><option>男性</option><option>中性</option></select><select className={styles.field} value={audience} onChange={(e)=>setAudience(e.target.value)}><option>成人</option><option>兒童</option></select></div></div>
          <div className={styles.card}><div className={styles.blockTitle}>快速情境</div><div className={styles.pillRow}>{scenes.map(scene => <button key={scene.id} className={selectedScene === scene.id && !selectedCeleb ? styles.activePill : styles.pill} onClick={() => { setSelectedScene(scene.id); setSelectedCeleb(''); setShowCelebs(false); }}>{scene.label}</button>)}<button className={showCelebs ? styles.activePill : styles.pill} onClick={() => setShowCelebs(v => !v)}>名人靈感</button></div>{showCelebs ? <div className={styles.celebPanel}>{celebs.map(celeb => <button key={celeb.id} className={selectedCeleb === celeb.id ? styles.activePill : styles.pill} onClick={() => setSelectedCeleb(celeb.id)}>{celeb.label}</button>)}</div> : null}</div>
          <div className={styles.generateRow}><button className={styles.primaryBtn} onClick={handleGenerate}>生成穿搭</button>{generatedShareUrl ? <a href={generatedShareUrl} className={styles.secondaryBtn}>查看分享頁</a> : null}</div>
        </section>
        <section className={styles.listSection}><div className={styles.sectionHead}><div><div className={styles.kicker}>History</div><h2 className={styles.sectionTitle}>最近生成</h2></div></div><div className={styles.smallRow}>{recent.map(item => <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div></section>
        <section className={styles.listSection}><div className={styles.sectionHead}><div><div className={styles.kicker}>Favorites</div><h2 className={styles.sectionTitle}>我的最愛</h2></div></div><div className={styles.smallRow}>{favorites.map(item => <OutfitCard key={item.id} item={item} compact onOpen={() => item.image_url && setZoomSrc(item.image_url)} />)}</div></section>
      </section>
      {zoomSrc ? <div className={styles.modalBackdrop} onClick={() => setZoomSrc('')}><img src={zoomSrc} alt='' className={styles.modalImg} /></div> : null}
    </main>
  );
}
