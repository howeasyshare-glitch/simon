'use client'
import { supabase } from '../../lib/supabase/client'

export default function Page(){
  async function login(){
    await supabase.auth.signInWithOAuth({ provider:'google' })
  }
  return <button onClick={login}>Login with Google</button>
}
