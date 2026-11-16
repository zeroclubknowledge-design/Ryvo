"use client";
import { useCallback, useEffect, useState } from "react";
import { RyvoLoadingScreen } from "@/components/ryvo-loading-screen";

/** Give a prefetched collection/board one readable logo pass without delaying its data. */
export function CollectionOpening({board=false}:{board?:boolean}) {
 const [visible,setVisible]=useState(true),[logoReady,setLogoReady]=useState(false);
 const onReady=useCallback(()=>setLogoReady(true),[]);
 useEffect(()=>{
  if(!logoReady)return;
  const duration=window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:950;
  const timer=window.setTimeout(()=>setVisible(false),duration);
  return()=>window.clearTimeout(timer);
 },[logoReady]);
 return visible?<RyvoLoadingScreen label={board?"Opening your board":"Opening the collection"} onReady={onReady}/>:null;
}
