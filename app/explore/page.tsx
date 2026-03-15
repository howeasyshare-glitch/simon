
"use client";

import { useEffect, useState } from "react";

function likedKey(id:string){
  return "liked_"+id
}

export default function Page(){

  const [items,setItems]=useState<any[]>([])
  const [sort,setSort]=useState("like")

  useEffect(()=>{
    load()
  },[sort])

  async function load(){
    const r=await fetch(`/api/data?op=explore&sort=${sort}&limit=60&ts=`+Date.now())
    const j=await r.json()
    if(j?.items)setItems(j.items)
  }

  async function toggleLike(it:any){
    let anon=localStorage.getItem("findoutfit_anon_id")
    if(!anon){
      anon=crypto.randomUUID()
      localStorage.setItem("findoutfit_anon_id",anon)
    }

    const liked=localStorage.getItem(likedKey(it.id))==="1"
    const op=liked?"outfits.unlike":"outfits.like"

    const r=await fetch(`/api/data?op=${op}`,{
      method:"POST",
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({outfit_id:it.id,anon_id:anon})
    })

    const j=await r.json()

    if(liked) localStorage.removeItem(likedKey(it.id))
    else localStorage.setItem(likedKey(it.id),"1")

    setItems(prev=>prev.map(x=>x.id===it.id?{...x,like_count:j.like_count}:x))
  }

  function apply(it:any){

    localStorage.setItem("findoutfit_apply_preset",JSON.stringify({
      style:it.style?.style||"casual",
      palette:it.style?.palette||"mono-dark",
      styleVariant:it.style?.styleVariant||"",
      label:it.summary||"explore",
      ts:Date.now()
    }))

    window.location.href="/"
  }

  return(
    <main style={{background:"#0b0d12",minHeight:"100vh",padding:24,color:"white"}}>

      <h1 style={{fontSize:32,fontWeight:800}}>Explore</h1>

      <div style={{marginTop:10,marginBottom:20,color:"rgba(255,255,255,0.8)"}}>
      查看全部公開穿搭
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16}}>

        {items.map(it=>{

          const liked=localStorage.getItem(likedKey(it.id))==="1"

          return(
            <div key={it.id} style={{
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16,
              overflow:"hidden",
              background:"rgba(255,255,255,0.03)"
            }}>

              <img src={it.image_url} style={{width:"100%"}}/>

              <div style={{padding:12}}>

                <div style={{fontWeight:800}}>
                  {it.style?.style||"Outfit"}
                </div>

                <div style={{fontSize:12,opacity:.8}}>
                  {it.summary||""}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:12}}>

                  <button onClick={()=>toggleLike(it)}>
                    {liked?"取消讚":"Like"}
                  </button>

                  <button onClick={()=>navigator.clipboard.writeText(location.origin+"/share/"+it.share_slug)}>
                    分享
                  </button>

                  <button onClick={()=>apply(it)}>
                    套用
                  </button>

                  <a href={"/share/"+it.share_slug}>查看</a>

                </div>

              </div>

            </div>
          )

        })}

      </div>

    </main>
  )
}
