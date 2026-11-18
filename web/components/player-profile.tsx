"use client";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/collection-art";
import { BackLink } from "@/components/back-button";
import { profileBannerAt, profileBanners, ownedAvatarPath, PROFILE_PHOTO_BUCKET } from "@/lib/profile-media";
import { useProfilePhoto } from "@/lib/use-profile-photo";
import type { PlayerLevel } from "@/lib/levels";

export function PlayerAvatar({user,className=""}:{user:User|null;className?:string}){
 const path=user?.user_metadata.avatar_path;
 const src=user&&ownedAvatarPath(user.id,path)?supabase().storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl:null;
 const [failed,setFailed]=useState<string|null>(null);
 const initials=(user?.user_metadata.name??"Player").split(/\s+/).filter(Boolean).map((s:string)=>s[0]).slice(0,2).join("");
 return <span className={`player-avatar ${className}`}>{src&&failed!==src?<Image unoptimized src={src} width={112} height={112} alt="" onError={()=>setFailed(src)}/>:user?initials:<Icon name="profile" size={26}/>}</span>;
}
export function SharedPlayerBanner(){
 const [banner,setBanner]=useState(profileBanners[0]);
 useEffect(()=>{const update=()=>setBanner(profileBannerAt(Date.now()));const start=setTimeout(update,0),timer=setInterval(update,60000);return()=>{clearTimeout(start);clearInterval(timer)}},[]);
 return <div className="player-cover-art"><Image src={banner.src} alt={banner.alt} fill priority sizes="(max-width: 700px) 100vw, 1000px"/><div className="player-cover-scrim"/></div>;
}
export function PlayerProfile({user,loading,boards,completed,level,progress,tokens,onUser,onLogout}:{user:User|null;loading:boolean;boards:number;completed:number;level:PlayerLevel;progress:number;tokens:number;onUser:(user:User)=>void;onLogout:()=>Promise<void>}){
 const photo=useProfilePhoto(user,onUser);
 const photoInput=useRef<HTMLInputElement>(null);
 const percent=Math.round(progress*100);
 const remaining=level.nextBoards===null?0:Math.max(0,level.nextBoards-completed);
 const levelNote=level.nextBoards===null?`Top level · ${completed} boards completed`:`${remaining} more board${remaining===1?"":"s"} to level ${level.level+1}`;
 return <div className="player-profile-page" aria-busy={loading}>
  <section className="player-cover"><SharedPlayerBanner/><div className="player-cover-controls"><BackLink href="/explore" ariaLabel="Back to explore"/>{user&&<Menu.Root><Menu.Trigger className="player-profile-menu-button" aria-label="Profile options">•••</Menu.Trigger><Menu.Portal><Menu.Positioner className="ryvo-select-positioner" align="end" sideOffset={10}><Menu.Popup className="player-profile-menu"><Menu.Item className="player-profile-menu-item" onClick={()=>void onLogout()}><Icon name="arrow" size={16}/>Log out</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>}</div><span className="player-cover-mark">YOUR NEXT CHAPTER STARTS HERE</span></section>
  <section className="player-identity">
   <div className="player-identity-tools">
    <div className="player-photo-control">
     <PlayerAvatar user={user}/>
     {user&&<><input ref={photoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void photo.upload(file)}}/><button className="player-photo-button" aria-label={photo.uploading?'Uploading profile photo':'Upload profile photo'} disabled={photo.uploading} onClick={()=>photoInput.current?.click()}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg></button></>}
    </div>
    {user&&<Link className="secondary player-edit" href="/profile/edit">Edit profile</Link>}
   </div>
   {loading?<div className="player-identity-placeholder" role="status"><span/><span/><p>Loading your player profile…</p></div>:user?<>
    <h1>{user.user_metadata.name||'Player'}</h1>
    <p className="player-handle">@{user.user_metadata.username||'player'}</p>
    <div className="player-identity-badges"><span><Icon name="spark" size={14}/>Level {level.level} · {level.name}</span></div>
    <div className="player-level-track">
     <div className="player-level-track-head"><span>{levelNote}</span><b>{level.nextBoards===null?percent:Math.min(percent,100)}%</b></div>
     <div className="player-level-bar" role="progressbar" aria-label={`Progress to level ${level.level+1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{width:`${percent}%`}}/></div>
    </div>
    <p className="player-bio">{user.user_metadata.bio||'Playing for the complete picture.'}</p>
    <div className="player-identity-stats"><span><b>{boards}</b> Boards</span><span><b>{completed}</b> Completed</span><span><b>{tokens.toLocaleString()}</b> RYVO tokens</span></div>
   </>:<div className="player-profile-signin"><h1>Your game starts with you.</h1><p>Sign in to build your player profile and add your photo.</p><Link href="/signin?next=/profile" className="primary">Sign in<Icon name="arrow"/></Link></div>}
   <div aria-live="polite">{photo.uploading&&<p className="player-photo-message">Uploading your photo…</p>}{photo.notice&&<p className="player-photo-message">{photo.notice}</p>}</div>{photo.error&&<p className="error" role="alert">{photo.error}</p>}
   {user&&<div className="player-profile-links"><Link href="/boards" className="primary">View my boards<Icon name="arrow"/></Link><Link href="/merchant">Open merchant studio<Icon name="arrow" size={15}/></Link></div>}
  </section>
 </div>;
}
