"use client";

import {useEffect,useState} from "react";
import {getSupabase} from "../../lib/supabase";

// Count the visible review cases, not provider accounts or a truncated client
// list. A provider can be approved while a new service credential needs review.
export function useVerificationQueue(enabled:boolean) {
  const [count,setCount]=useState<number|null>(null);
  useEffect(()=>{
    if(!enabled)return;
    let active=true,running=false;
    const refresh=async()=>{
      if(running || document.visibilityState!=="visible")return;
      const client=getSupabase();if(!client)return;
      running=true;
      try {
        const result=await client.from("verification_cases").select("id",{count:"exact",head:true}).in("status",["pending","needs_information"]);
        if(active)setCount(!result.error&&Number.isInteger(result.count)&&result.count!==null&&result.count>=0?result.count:null);
      } catch {if(active)setCount(null);}
      finally{running=false;}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),10000);
    document.addEventListener("visibilitychange",refresh);
    return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
  },[enabled]);
  return count;
}
