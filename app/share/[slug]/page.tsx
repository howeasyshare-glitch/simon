
"use client"

import {useEffect,useState} from "react"

export default function Page({params}:{params:{slug:string}}){

  const [data,setData]=useState<any>(null)

  useEffect(()=>{
    load()
  },[])

  async function load(){
    const r=await fetch("/api/share?slug="+params.slug)
    const j=await r.json()
    setData(j.outfit)
  }

  function apply(){

    localStorage.setItem("findoutfit_apply_preset",JSON.stringify({
      style:data.style?.style,
      palette:data.style?.palette,
      styleVariant:data.style?.styleVariant,
      label:data.summary
    }))

    window.location.href="/"
  }

  if(!data) return <main style={{background:"#0b0d12",minHeight:"100vh",padding:40,color:"white"}}>loading...</main>

  return(
    <main style={{background:"#0b0d12",minHeight:"100vh",padding:40,color:"white"}}>

      <h1 style={{fontWeight:800,fontSize:30}}>公開穿搭分享</h1>

      <img src={data.image_url} style={{maxWidth:400,marginTop:20}}/>

      <div style={{marginTop:20}}>
        {data.summary}
      </div>

      <div style={{display:"flex",gap:12,marginTop:20}}>

        <button onClick={()=>navigator.clipboard.writeText(location.href)}>
          分享
        </button>

        <button onClick={apply}>
          套用
        </button>

      </div>

    </main>
  )
}
