"use client";

import { SceneBanner } from "@/components/scene-banner";
import { MerchantDirectory } from "@/components/merchant-directory";
import { useRouter } from "next/navigation";
import Image from "next/image";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import { emptyWallet, loadLiveData } from "@/lib/live-data";

import { money, credit, type Competition } from "@/lib/demo";

import { Artwork, Icon } from "@/components/collection-art";

import { CollectionOpening } from "@/components/collection-opening";

import { BackLink } from "@/components/back-button";

import { NavigationFeedback } from "@/components/navigation-feedback";

import { ReferralsPage } from "@/components/referrals-page";

import { TokenWalletCard } from "@/components/token-experience";

import { RyvoSelect } from "@/components/ryvo-select";



type View="explore"|"boards"|"wallet"|"referrals"|"p2p"|"notifications"|"profile"|"create";

const navigation=[["explore","Explore"],["boards","Boards"],["create","Create"],["referrals","Invite"],["profile","Profile"]] as const;

export function LiveRyvoApp({initialView="explore",collectionId,boardView=false}:{initialView?:View;collectionId?:string;boardView?:boolean}){

 const router=useRouter();
 const accountOwner=useRef<string|null>(null);
 const [user,setUser]=useState<User|null>(null),[state,setState]=useState(emptyWallet),[catalog,setCatalog]=useState<Competition[]>([]),[tokens,setTokens]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0),[help,setHelp]=useState(false),[menu,setMenu]=useState(false),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[name,setName]=useState(""),[username,setUsername]=useState(""),[bio,setBio]=useState(""),[filter,setFilter]=useState("All collections");

 useEffect(()=>{

  let active=true;

  const read=async()=>{

   setLoading(true);setError("");

   try{const db=supabase();const {data,error:authError}=await db.auth.getUser();if(authError&&authError.name!=="AuthSessionMissingError")throw authError;const current=data.user;if(!active)return;accountOwner.current=current?.id??null;setUser(current);setState(emptyWallet(current));setName(current?.user_metadata.name??"");setUsername(current?.user_metadata.username??"");setBio(current?.user_metadata.bio??"");const result=await loadLiveData(current);if(active){setState(result.state);setCatalog(result.competitions);setTokens(result.tokens)}}catch{if(active)setError("We couldn’t load the latest game data. Please try again shortly.")}finally{if(active)setLoading(false)}

  };

  void read();let unsubscribe:(()=>void)|undefined;

  try{const {data}=supabase().auth.onAuthStateChange((event,session)=>{if(active){setUser(session?.user??null);if(event==="SIGNED_OUT"){accountOwner.current=null;setState(emptyWallet());setTokens(0)}else if(event==="SIGNED_IN"&&accountOwner.current!==session?.user.id){accountOwner.current=session?.user.id??null;setState(emptyWallet(session?.user));setTokens(0);setRetry(v=>v+1)}}});unsubscribe=()=>data.subscription.unsubscribe()}catch{}

  return()=>{active=false;unsubscribe?.()};

 },[retry]);

 const initials=(user?.user_metadata.name??"Player").split(/\s+/).map((s:string)=>s[0]).slice(0,2).join("");

 const detail=catalog.find(c=>c.id===collectionId);

 const shown=catalog.filter(c=>filter==="All collections"||filter===c.category);

 const logout=async()=>{setError("");try{const {error}=await supabase().auth.signOut();if(error)throw error;router.push("/signin")}catch{setError("Unable to sign out. Please try again.")}};

 const accountLink=<Link className="primary" href={`/signup?next=${initialView==="p2p"?"/wallet":`/${initialView}`}`}>Create your account <Icon name="arrow"/></Link>;

 const paymentNote=<p className="live-service-note">P2P funding is available through approved merchants when trading is open. Competition payments, swaps and withdrawals are not available yet.</p>;

 return <div className="app-shell"><a className="skip-to-game" href="#ryvo-content">Skip to game</a><nav className="floating-taskbar" aria-label="App navigation">{navigation.map(([key,label])=><Link key={key} href={`/${key}`} aria-current={initialView===key?"page":undefined} className={initialView===key?"active":""}>{key==="create"?<Image className="taskbar-ryvo-logo" src="/ryvo-logo.png" alt="" width={28} height={28}/>:<Icon name={key}/>}<span>{label}</span><NavigationFeedback active={initialView===key}/></Link>)}</nav><div className="workspace"><header className="topbar"><Link href="/" className="app-brand"><Image src="/ryvo-logo.png" alt="" width={38} height={38}/><b>Ryvo</b></Link><div className="breadcrumb">Your next round awaits <span>↗</span></div><div className="top-actions"><Link className="balance-pill" href="/wallet"><span className="currency-symbol">r/</span>{loading||error?"—":state.balance.toLocaleString()}</Link><Link href="/notifications" className="icon-button notification" aria-label="Open notifications"><Icon name="bell"/></Link><Link href="/profile" className="avatar" aria-label="Open your profile">{user?initials:<Icon name="profile"/>}</Link></div></header><main id="ryvo-content" tabIndex={-1}>

 {collectionId&&<CollectionOpening key={collectionId} board={boardView}/>}

 {error&&<div className="live-status" role="alert"><p>{error}</p><button className="secondary" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}

 {loading?<div className="live-loading" role="status">Getting your game ready…</div>:collectionId?<><BackLink href="/explore" ariaLabel="Back to explore"/>{detail?<section className="live-collection"><div className="live-collection-art"><Artwork theme={detail.theme}/></div><h1>{detail.title}</h1><p>{detail.description}</p><div className="live-facts"><span>Registration<b>{money(detail.fee)}</b></span><span>Players<b>{detail.joined} / {detail.capacity}</b></span><span>Prize pool<b>{money(detail.prize)}</b></span></div><p>{detail.total} pieces · {detail.winners} winner slots</p>{paymentNote}</section>:<Empty title="This competition is unavailable." text="Explore the latest challenges to find your next game." href="/explore" label="Explore challenges"/>}</>:<>

 {initialView==="explore"&&<><div className="play-home-heading"><h1>Let’s play.</h1><button onClick={()=>setHelp(v=>!v)} aria-expanded={help}><Icon name="help"/>How to play</button></div>{help&&<section className="live-help"><h2>Collect. Connect. Complete.</h2><p>Choose a competition and register in naira to receive RYVO Credit. Once registration fills, collect random pieces, trade duplicates and race to finish your board within the available winner slots.</p></section>}<SceneBanner title="Your next move. A whole new picture." text="Find the pieces. Trade your extras. Play for the complete board." href="/how-it-works" label="How to play"/><div className="live-home-grid"><Link className="home-credit" href="/wallet"><span>Your RYVO Credit<Icon name="arrow" size={16}/></span><strong>{error?"—":state.balance.toLocaleString()}<small>r/</small></strong><p>Your next move starts here.</p></Link><section className="home-launch"><div className="home-launch-label"><Image src="/ryvo-logo.png" alt="" width={28} height={28}/><span>Made by you. Played by everyone.</span></div><h2>Turn your art into<br/>the next challenge.</h2><p>Your artwork. Your community. One complete picture.</p><Link href="/create">Create a competition<Icon name="arrow"/></Link></section></div><div className="section-heading"><h2>Find your next challenge<span className="lime-dot"/></h2><RyvoSelect label="Filter challenges" value={filter} onValueChange={setFilter} options={["All collections","3D Art","Abstract","Digital Art"].map(value=>({value,label:value}))}/></div>{shown.length?<div className="collection-grid">{shown.map(c=><Link className="live-game-card" href={`/collection/${c.id}`} key={c.id}><div><Artwork theme={c.theme}/></div><h2>{c.title}</h2><p>{c.joined} / {c.capacity} players · {c.total} pieces</p><b>{money(c.prize)} prize pool</b><span>View challenge <Icon name="arrow"/></span></Link>)}</div>:<Empty title={error?"Challenges are taking a moment.":"The next race starts here."} text={error?"Try again to load the latest competitions.":"New competitions will appear here when creators launch them."}/>}</>}

 {initialView==="boards"&&<><h1>Your boards.</h1><SceneBanner title="Every piece brings you closer." text="Your collection. Your progress. Your race to the finish." theme="bloom"/>{Object.keys(state.boards).length?<div className="collection-grid">{Object.entries(state.boards).map(([id,pieces])=><Link className="live-game-card" href={`/board/${id}`} key={id}><h2>{catalog.find(c=>c.id===id)?.title??"Your competition"}</h2><p>{pieces.length} unique pieces collected</p><span>View board <Icon name="arrow"/></span></Link>)}</div>:<Empty title="Your first board is waiting." text="Join a competition to begin collecting." href="/explore" label="Explore challenges"/>}</>}

 {(initialView==="wallet"||initialView==="p2p")&&<><div className="page-heading"><div><h1>{initialView==="p2p"?"Meet your merchants.":"Your wallet."}</h1><p className="subheading">Your credit. Your earnings. Your next move.</p></div></div>{initialView==="p2p"?<><BackLink href="/wallet" ariaLabel="Back to wallet"/><MerchantDirectory/></>:<><SceneBanner title="More possibilities in every move." text="Your RYVO Credit and earnings, all in one place." theme="chrome"/><div className="live-wallet-grid"><section className="live-credit-card"><span>Your RYVO wallet</span><strong>{error?"—":state.balance.toLocaleString()}<small>r/</small></strong><p>Collect what moves you.</p><div className="live-wallet-actions"><Link href="/wallet/p2p"><Icon name="spark"/>Fund</Link><button disabled><Icon name="wallet"/>Bank account</button><button disabled><Icon name="arrow"/>Swap</button></div></section><section className="live-earnings-card"><span>Available to withdraw</span><strong>{error?"—":money(state.earnings??0)}</strong><p>Your earnings on Ryvo.</p><button className="secondary" disabled>Withdraw earnings <Icon name="arrow"/></button></section></div>{!error&&<TokenWalletCard state={state} earned={tokens}/>}<section className="wallet-activity-section"><h2>Wallet activity<span className="lime-dot"/></h2>{state.ledger.length?<div className="ledger">{state.ledger.map(t=><div key={t.id}><Icon name="wallet"/><p><b>{t.label}</b><small>{new Date(t.date).toLocaleDateString("en-NG")}</small></p><strong>{t.amount<0?"−":"+"}{t.currency==="NGN"?money(Math.abs(t.amount)):credit(Math.abs(t.amount))}</strong></div>)}</div>:<p className="live-empty-copy">Your transactions will appear here.</p>}</section></>}{paymentNote}{!user&&accountLink}</>}

 {initialView==="notifications"&&<><h1>Notifications</h1><p className="subheading">Your game, collection and wallet updates.</p><SceneBanner title="The game keeps moving." text="Your latest updates, together in one place." theme="bloom"/>{state.ledger.length?<section className="ops-panel">{state.ledger.map(t=><article className="ops-order-row" key={t.id}><Icon name="wallet"/><div><b>{t.label}</b><small>{new Date(t.date).toLocaleDateString("en-NG")}</small></div><strong>{t.amount>0?"+":""}{t.currency==="RYVO"?credit(t.amount):money(t.amount)}</strong></article>)}</section>:<Empty title="You’re all caught up." text="New account and competition updates will appear here."/>}</>}

 {initialView==="profile"&&(user?<div className="live-profile"><section className="profile-banner"><Artwork theme="explorer"/><div className="profile-banner-actions"><BackLink href="/explore" ariaLabel="Back to explore"/><div className="live-account-menu"><button className="icon-button" aria-label="Account menu" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>•••</button>{menu&&<button className="live-logout" onClick={logout}>Log out</button>}</div></div><h1>Every board<br/>starts with a player.</h1></section><section className="live-profile-body"><div className="live-profile-top"><span className="avatar">{initials}</span><button className="secondary" onClick={()=>setEditing(v=>!v)} aria-expanded={editing}>Edit profile</button></div><h2>{user.user_metadata.name||"Player"}</h2><p>@{user.user_metadata.username||"player"}</p><div className="live-profile-badges"><span><Icon name="boards" size={14}/>Player</span></div>{editing?<form className="live-profile-form" onSubmit={async e=>{e.preventDefault();setSaving(true);setError("");try{const {data,error}=await supabase().auth.updateUser({data:{name:name.trim(),username:username.trim(),bio:bio.trim()}});if(error)throw error;setUser(data.user);setEditing(false)}catch{setError("Your profile couldn’t be saved. Please try again.")}finally{setSaving(false)}}}><label>Player name<input required minLength={2} maxLength={50} value={name} onChange={e=>setName(e.target.value)}/></label><label>Username<input required pattern="[a-z0-9_.]{3,24}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label><label>About you<textarea maxLength={180} value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="primary" disabled={saving}>{saving?"Saving…":"Save changes"}</button></form>:<p>{user.user_metadata.bio||"Playing for the complete picture."}</p>}<p>{Object.keys(state.boards).length} boards · {tokens} RYVO tokens</p><Link href="/boards" className="primary">View my boards <Icon name="arrow"/></Link><Link href="/merchant" className="ops-back">Open merchant studio <Icon name="arrow" size={14}/></Link></section></div>:<Empty title="Your game starts with you." text="Create your player account or sign in to see your profile." href="/signin" label="Sign in"/>)}

 {initialView==="create"&&<><h1>Launch a competition.</h1><p className="subheading">Upload your artwork. Set the challenge. Bring your community.</p><section className="live-launch-preview"><Artwork theme="explorer"/><div><h2>Make it a board<br/>worth beating.</h2><p>Choose 10–50 pieces and race your community to the complete picture.</p><p>Competition publishing opens when payment verification is available.</p>{user?<button className="primary" disabled>Launching opens soon</button>:accountLink}</div></section>{paymentNote}</>}

 {initialView==="referrals"&&<ReferralsPage username={user?.user_metadata.username??""}/>}

 </>}

 <footer className="page-footer"><span>© 2026 Ryvo. Your next round awaits.</span><Link href="/how-it-works">How to play <Icon name="arrow" size={14}/></Link></footer></main></div></div>

}

function Empty({title,text,href,label}:{title:string;text:string;href?:string;label?:string}){return <section className="empty-state live-empty"><Icon name="boards" size={30}/><h2>{title}</h2><p>{text}</p>{href&&<Link className="primary" href={href}>{label}<Icon name="arrow" size={18}/></Link>}</section>}
