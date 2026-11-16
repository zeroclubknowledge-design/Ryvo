"use client";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/collection-art";
import { BackLink } from "@/components/back-button";
import { MAX_PROFILE_PHOTO_BYTES, ownedAvatarPath, PROFILE_PHOTO_BUCKET, profileBannerAt, profileBanners, validateProfilePhoto } from "@/lib/profile-media";

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
export function PlayerProfile({user,loading,boards,tokens,onUser,onLogout}:{user:User|null;loading:boolean;boards:number;tokens:number;onUser:(user:User)=>void;onLogout:()=>Promise<void>}){
 const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [name,setName]=useState(''),[username,setUsername]=useState(''),[bio,setBio]=useState('');
 const input=useRef<HTMLInputElement>(null),uploadLock=useRef(false);
 const edit=()=>{setName(user?.user_metadata.name??'');setUsername(user?.user_metadata.username??'');setBio(user?.user_metadata.bio??'');setError('');setEditing(v=>!v)};
 async function upload(file:File){
  if(!user||uploadLock.current)return;
  uploadLock.current=true;setUploading(true);setError('');setNotice('');let newPath='';let committed=false;
  try{
   validateProfilePhoto(file);
   const image=await createImageBitmap(file);
   try{
    if(image.width<64||image.height<64||image.width*image.height>40000000)throw Error('Choose a photo between 64 pixels and 40 megapixels.');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const context=canvas.getContext('2d');if(!context)throw Error('This browser couldn’t prepare the photo. Please try another browser.');
    const side=Math.min(image.width,image.height);context.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,640,640);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(Error('Unable to prepare this photo.')),'image/jpeg',.88));
    if(blob.size>MAX_PROFILE_PHOTO_BYTES)throw Error('The photo is too large. Choose a smaller picture.');
    const db=supabase();newPath=`${user.id}/avatar-${crypto.randomUUID()}.jpg`;
    const {error:uploadError}=await db.storage.from(PROFILE_PHOTO_BUCKET).upload(newPath,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
    if(uploadError)throw Error('Your photo couldn’t be uploaded. Check your connection or contact Ryvo if photo storage is not yet enabled.');
    const {data,error:saveError}=await db.auth.updateUser({data:{avatar_path:newPath}});if(saveError||!data.user)throw Error('Your photo was uploaded but couldn’t be saved to your profile. Please try again.');
    committed=true;onUser(data.user);setNotice('Profile photo updated.');
    const old=user.user_metadata.avatar_path;if(ownedAvatarPath(user.id,old))void db.storage.from(PROFILE_PHOTO_BUCKET).remove([old]).catch(()=>{});
   }finally{image.close()}
  }catch(e){if(newPath&&!committed)void supabase().storage.from(PROFILE_PHOTO_BUCKET).remove([newPath]).catch(()=>{});setError(e instanceof Error?e.message:'Unable to update your photo.')}finally{uploadLock.current=false;setUploading(false);if(input.current)input.current.value=''}
 }
 return <div className="player-profile-page" aria-busy={loading}>
  <section className="player-cover"><SharedPlayerBanner/><div className="player-cover-controls"><BackLink href="/explore" ariaLabel="Back to explore"/>{user&&<Menu.Root><Menu.Trigger className="player-profile-menu-button" aria-label="Profile options">•••</Menu.Trigger><Menu.Portal><Menu.Positioner className="ryvo-select-positioner" align="end" sideOffset={10}><Menu.Popup className="player-profile-menu"><Menu.Item className="player-profile-menu-item" onClick={()=>void onLogout()}><Icon name="arrow" size={16}/>Log out</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>}</div><span className="player-cover-mark">YOUR NEXT CHAPTER STARTS HERE</span></section>
  <section className="player-identity"><div className="player-identity-tools"><div className="player-photo-control"><PlayerAvatar user={user}/>{user&&<><input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/><button className="player-photo-button" aria-label={uploading?'Uploading profile photo':'Upload profile photo'} disabled={uploading||saving} onClick={()=>input.current?.click()}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg></button></>}</div>{user&&<button className="secondary player-edit" onClick={edit} disabled={uploading||saving} aria-expanded={editing}>{editing?'Close editor':'Edit profile'}<Icon name="arrow" size={16}/></button>}</div>
  {loading?<div className="player-identity-placeholder" role="status"><span/><span/><p>Loading your player profile…</p></div>:user?<><h1>{user.user_metadata.name||'Player'}</h1><p className="player-handle">@{user.user_metadata.username||'player'}</p><div className="player-identity-badges"><span><Icon name="boards" size={14}/>Player</span></div><p className="player-bio">{user.user_metadata.bio||'Playing for the complete picture.'}</p><div className="player-identity-stats"><span><b>{boards}</b> Boards</span><span><b>{tokens.toLocaleString()}</b> RYVO tokens</span></div></>:<div className="player-profile-signin"><h1>Your game starts with you.</h1><p>Sign in to build your player profile and add your photo.</p><Link href="/signin?next=/profile" className="primary">Sign in<Icon name="arrow"/></Link></div>}
  <div aria-live="polite">{uploading&&<p className="player-photo-message">Uploading your photo…</p>}{notice&&<p className="player-photo-message">{notice}</p>}</div>{error&&<p className="error" role="alert">{error}</p>}
  {editing&&user&&<form className="player-profile-editor" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');try{const {data,error}=await supabase().auth.updateUser({data:{name:name.trim(),username:username.trim(),bio:bio.trim()}});if(error||!data.user)throw Error('Your profile couldn’t be saved. Please try again.');onUser(data.user);setEditing(false);setNotice('Profile updated.')}catch(e){setError(e instanceof Error?e.message:'Unable to save your profile.')}finally{setSaving(false)}}}><label>Player name<input required minLength={2} maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label><label>Username<input required pattern="[a-z0-9_.]{3,24}" maxLength={24} value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label><label>About you<textarea maxLength={180} value={bio} onChange={e=>setBio(e.target.value)}/></label><p>Your photo is cropped to a square. JPG, PNG or WebP, up to 5 MB.</p><button className="primary" disabled={saving||uploading}>{saving?'Saving…':'Save changes'}<Icon name="arrow"/></button></form>}
  {user&&<div className="player-profile-links"><Link href="/boards" className="primary">View my boards<Icon name="arrow"/></Link><Link href="/merchant">Open merchant studio<Icon name="arrow" size={15}/></Link></div>}
  </section>
 </div>;
}
