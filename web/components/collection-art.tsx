"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { readArtwork } from "@/lib/demo-assets";
const ArtworkScene=dynamic(()=>import("@/components/artwork-scene"),{ssr:false,loading:()=>null});
const sceneThemes=["explorer","bloom","chrome","orbit"];
export function Icon({name,size=20}:{name:string;size?:number}) { const paths:Record<string,React.ReactNode>={ profile:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,explore:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,boards:<><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M10 10v11"/></>,marketplace:<><path d="M4 9h16l-2-6H6L4 9Zm1 0v12h14V9M9 21v-7h6v7"/><path d="M4 9c0 4 4 4 4 0 0 4 4 4 4 0 0 4 4 4 4 0 0 4 4 4 4 0"/></>,wallet:<><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5l14-3v3M16 11h5v5h-5z"/></>,referrals:<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14c3 0 4 2 4 5"/></>,search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,bell:<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9M10 21h4"/></>,spark:<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,check:<path d="m5 12 4 4L19 6"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,time:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,heart:<path d="M20 5c-3-3-7-1-8 1C9 0 1 3 3 9c1 4 9 11 9 11s8-7 9-11c.5-1.5 0-3-1-4Z"/>,help:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/></>};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]||paths.spark}</svg> }
export function Artwork({theme,className="",scene=false}:{theme:string;className?:string;scene?:boolean}) {

 const live=scene&&sceneThemes.includes(theme);

 const [ready,setReady]=useState(false);

 const poster=theme.startsWith("art:")?<StoredArtwork path={theme.slice(4)}/>:theme.startsWith("upload:")?<UploadedArtwork assetKey={theme.slice(7)}/>:theme==="explorer"?<div className="explorer-image"/>:theme==="bloom"?<div className="bloom-sculpture">{Array.from({length:8},(_,i)=><i key={i} style={{transform:`rotate(${i*45}deg) rotateY(25deg)`}}/>)}<b/></div>:theme==="chrome"?<div className="chrome-sculpture"><i/><b/><span/></div>:<div className="orbit-sculpture"><i/><b/><span/></div>;

 return <div className={`artwork art-${theme} ${live?ready?"has-scene scene-ready":"has-scene":""} ${className}`} aria-label={theme.startsWith("upload:")||theme.startsWith("art:")?"Competition artwork":`${theme} collectible artwork`} role="img">{live?<div className="artwork-poster">{poster}</div>:poster}{live&&<ArtworkScene theme={theme as "explorer"|"bloom"|"chrome"|"orbit"} onReady={()=>setReady(true)}/>}</div>

}

function UploadedArtwork({assetKey}:{assetKey:string}){const [url,setUrl]=useState("");useEffect(()=>{let active=true,objectURL="";readArtwork(assetKey).then(blob=>{if(blob&&active){objectURL=URL.createObjectURL(blob);setUrl(objectURL)}}).catch(()=>{});return()=>{active=false;if(objectURL)URL.revokeObjectURL(objectURL)}},[assetKey]);return url?<img src={url} alt="Uploaded competition artwork" className="uploaded-artwork"/>:<div className="uploaded-art-placeholder">Artwork preview</div>}

/** Creator artwork in the public competition-art bucket. */
export const storedArtworkUrl=(path:string)=>`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/competition-art/${path.split("/").map(encodeURIComponent).join("/")}`;
function StoredArtwork({path}:{path:string}){
 // eslint-disable-next-line @next/next/no-img-element
 return /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path)?<img src={storedArtworkUrl(path)} alt="Competition artwork" className="uploaded-artwork" loading="lazy" decoding="async"/>:<div className="uploaded-art-placeholder">Artwork preview</div>
}
