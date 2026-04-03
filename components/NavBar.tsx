'use client'
import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase/client'

export default function NavBar(){
  const [user,setUser]=useState<any>(null)

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>setUser(data.user))
  },[])

  return <div>{user?user.email:'Not logged in'}</div>
}
