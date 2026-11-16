"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NotificationsPage, ProfilePage, getNotifications, useDemoAccount } from "@/components/account-pages";
import { GameDiscovery } from "@/components/game-discovery";
import { CreateCompetition } from "@/components/create-competition";
import { currentDemoSession, signOutDemo, accountWalletKey, persistAccountWallet } from "@/lib/demo-auth";
import { atomicBrowserWrite, MARKET_KEY, mergeMarket, readMarket } from "@/lib/demo-market";
import { hydrateWorld, WORLD_KEY, worldSnapshot } from "@/lib/demo-world";
import { ReferralsPage } from "@/components/referrals-page";
import { RyvoLoadingScreen } from "@/components/ryvo-loading-screen";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { useRouter } from "next/navigation";
import { Icon, Artwork } from "@/components/collection-art";
import { WalletPage, P2PPage } from "@/components/wallet-experience";
import { BoardPage } from "@/components/board-page";
import { CollectionDetails } from "@/components/collection-details";
import { allCompetitions, type PieceListing, initialState, money, credit, DEMO_STORAGE_KEY, isDemoState, settleDemoWithdrawals, type Competition, type DemoState } from "@/lib/demo";
type View = "explore"|"boards"|"wallet"|"referrals"|"p2p"|"notifications"|"profile"|"create";
export function RyvoApp({initialView="explore",collectionId,boardView=false}:{initialView?:View;collectionId?:string;boardView?:boolean}){
 const view=initialView;
 const [state,setState]=useState<DemoState>(initialState),[ready,setReady]=useState(false),[error,setError]=useState("");
 const [category,setCategory]=useState("All collections"),[query,setQuery]=useState(""),[selected,setSelected]=useState<number|null>(null),[busy,setBusy]=useState(false),[toast,setToast]=useState(""),[help,setHelp]=useState(false),[saved,setSaved]=useState<string[]>([]),[sort,setSort]=useState("Trending");
 const dialog=useRef<HTMLDialogElement>(null);
 const paymentPending=useRef(false);
 const router=useRouter();
 const [clock,setClock]=useState(0),[market,setMarket]=useState<PieceListing[]>([]),[session,setSession]=useState<ReturnType<typeof currentDemoSession>>(null);
 const competitions=allCompetitions(state,clock);
 const detail=competitions.find(c=>c.id===collectionId);
 const account=useDemoAccount();
 const notices=getNotifications(state);
 const unread=notices.filter(n=>!account.read.includes(n.id)).length;
 useEffect(()=>{
  if(process.env.NODE_ENV!=="production")return;
  const warm=()=>{for(const href of ["/explore","/boards","/wallet","/referrals","/notifications","/profile","/create"])router.prefetch(href)};
  if("requestIdleCallback" in window){const task=window.requestIdleCallback(warm);return()=>window.cancelIdleCallback(task)}
  const timer=setTimeout(warm,200);return()=>clearTimeout(timer);
 },[router]);
 useEffect(()=>{if(collectionId){const p=new URLSearchParams(location.search).get("piece");if(p!==null&&/^\d+$/.test(p))setSelected(Number(p))}},[collectionId]);
 useEffect(()=>{
  try {
   const cached=localStorage.getItem(DEMO_STORAGE_KEY);
   let wallet:unknown=null;
   try { if(cached)wallet=JSON.parse(cached); } catch {}
   const restored=settleDemoWithdrawals(hydrateWorld(isDemoState(wallet)?wallet:initialState));
   localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(restored));
   persistAccountWallet(restored);setMarket(mergeMarket(restored));localStorage.setItem(WORLD_KEY,worldSnapshot(restored));setSession(currentDemoSession());setClock(Date.now());
   setState(restored);setReady(true);
   const favorites=localStorage.getItem("ryvo-saved");
   if(favorites)try{setSaved(JSON.parse(favorites))}catch{}
  } catch { setError("Please allow browser storage to save your demo wallet and payments."); }
  const sync=(event:StorageEvent)=>{
   if(event.key===MARKET_KEY)setMarket(readMarket());
   if(event.key==="ryvo-demo-session-v1")setSession(currentDemoSession());
   if(event.key!==DEMO_STORAGE_KEY&&event.key!==WORLD_KEY)return;
   try{const wallet=JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)||"null");if(isDemoState(wallet))setState(settleDemoWithdrawals(hydrateWorld(wallet)))}catch{}
  };
  window.addEventListener("storage",sync);
  return()=>window.removeEventListener("storage",sync);
 },[]);
 useEffect(()=>{
  const timer=setInterval(()=>{
   setClock(Date.now());
   const settle=async()=>{
    try{
     const raw=localStorage.getItem(DEMO_STORAGE_KEY);if(!raw)return;
     const wallet=JSON.parse(raw);if(!isDemoState(wallet))return;
     const updated=settleDemoWithdrawals(hydrateWorld(wallet));if(JSON.stringify(updated)!==raw){localStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(updated));persistAccountWallet(updated);localStorage.setItem(WORLD_KEY,worldSnapshot(updated));setState(updated)}

    }catch{}
   };
   if(navigator.locks)void navigator.locks.request("ryvo-demo-payment",settle);else void settle();
  },1000);
  return()=>clearInterval(timer);
 },[]);
 useEffect(()=>{if(help)dialog.current?.showModal();else dialog.current?.close()},[help]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),4500);return()=>clearTimeout(t)},[toast]);
 async function act(action:string,id?:string,index?:number,payload?:unknown){
  if(!ready||paymentPending.current)return false;
  paymentPending.current=true;setBusy(true);setError("");
  let successMessage="";
  try{
   const pay=async()=>{
    const cached=localStorage.getItem(DEMO_STORAGE_KEY);const raw:unknown=cached?JSON.parse(cached):state;
    if(!isDemoState(raw))throw Error("Please reload to initialize your demo wallet.");
    const latest=settleDemoWithdrawals(hydrateWorld(raw));latest.playerName=account.profile.name;
    const post=async(wallet:DemoState,action:string,id?:string,index?:number,payload?:unknown)=>{const r=await fetch("/api/demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id,index,state:wallet,payload})});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to complete this demo action.");if(!isDemoState(data))throw Error("Unable to update the demo wallet.");return data};
    let data:DemoState;let catalog=readMarket();const extra:[string,string][]=[];
    if(action==="buy-listing"){
     const listing=catalog.find(l=>l.id===(payload as {listingId:string})?.listingId&&l.status==="active");if(!listing)throw Error("This listing has already sold or was cancelled.");
     const sellerRaw=localStorage.getItem(accountWalletKey(listing.ownerId));const seller:unknown=sellerRaw?JSON.parse(sellerRaw):null;if(!isDemoState(seller))throw Error("This seller’s demo wallet is unavailable in this browser.");
     const sellerReady=settleDemoWithdrawals({...hydrateWorld(seller),pieceSupply:latest.pieceSupply});latest.pieceSupply=sellerReady.pieceSupply;
     data=await post(latest,"buy-listing",undefined,undefined,listing);
     const sellerUpdate=await post({...sellerReady,pieceSupply:data.pieceSupply,finishers:data.finishers,players:data.players,rounds:data.rounds},"settle-sale",undefined,undefined,{listingId:listing.id,buyerId:latest.ownerId??"guest"});data.players=sellerUpdate.players;
     extra.push([accountWalletKey(listing.ownerId),JSON.stringify(sellerUpdate)]);catalog=catalog.map(l=>l.id===listing.id?{...l,status:"sold",buyerId:latest.ownerId}:l);
    }else{data=await post(latest,action,id,index,payload)}
    if((action==="redeem-universal"||action==="buy-draw")&&id){const revealed=data.inventory?.[id]?.findIndex((count,index)=>count>(latest.inventory?.[id]?.[index]??0));if(revealed!==undefined&&revealed>=0)successMessage=`Piece #${String(revealed+1).padStart(2,"0")} revealed. ${latest.boards[id]?.includes(revealed)?"Duplicate added to your inventory—keep it or list it.":"A new slot is filled on your board."}`}
    const ids=new Set((data.listings??[]).map(l=>l.id));catalog=[...data.listings??[],...catalog.filter(l=>!ids.has(l.id))];
    atomicBrowserWrite([...extra,[DEMO_STORAGE_KEY,JSON.stringify(data)],[accountWalletKey(data.ownerId??"guest"),JSON.stringify(data)],[MARKET_KEY,JSON.stringify(catalog)],[WORLD_KEY,worldSnapshot(data)]]);
    setState(data);setClock(Date.now());setMarket(catalog);setSelected(null);
   };
   if(navigator.locks)await navigator.locks.request("ryvo-demo-payment",pay);else await pay();
   const messages:Record<string,string>={join:"Registration paid in naira. Equivalent RYVO credits added to your wallet.","redeem-universal":"Universal Piece redeemed. A random copy has been added to your inventory.",swap:"Swap complete. Naira added to your withdrawable balance.",sell:"Credits sold. Naira added to your withdrawable balance.",fund:"Your RYVO wallet has been funded.","save-bank":"Test bank account saved.",withdraw:"Demo withdrawal requested. Your payout is processing.","list-piece":"One copy listed. Any other copies stay in your inventory.","cancel-listing":"Listing cancelled. One copy returned to your inventory.",launch:"Launch fee paid. Your competition is in the registration queue.","fill-demo-registration":"Demo registration filled. The next game is open and the one-month clock has started."};
   setToast(successMessage||messages[action]||"Demo purchase complete. The piece is on your board.");return true;
  }catch(e){setError(e instanceof Error?e.message:"Unable to complete this demo action.");return false}
  finally{paymentPending.current=false;setBusy(false)}
 }

 const navigate=(v:View)=>{router.push(v==="explore"?"/explore":`/${v}`)};
 const open=(c:Competition,piece?:number)=>{router.push(piece!==undefined?`/board/${c.id}?tab=marketplace&piece=${piece}`:`/collection/${c.id}`)};
 const close=()=>{setHelp(false);setError("")};
 const favorite=(id:string)=>{const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);localStorage.setItem("ryvo-saved",JSON.stringify(next))};
 let filtered=competitions.filter(c=>(category==="All collections"||c.category===category||category==="Saved"&&saved.includes(c.id))&&`${c.title} ${c.artist}`.toLowerCase().includes(query.toLowerCase()));if(sort==="Entry: low to high")filtered=[...filtered].sort((a,b)=>a.fee-b.fee);if(sort==="Most collected")filtered=[...filtered].sort((a,b)=>b.joined-a.joined);
 const playerCompetitions=competitions.filter(c=>state.boards[c.id]);
 return <div className="app-shell"><a className="skip-to-game" href="#ryvo-content">Skip to game</a>
 <nav className="floating-taskbar" aria-label="App navigation">{([["explore","Explore"],["boards","Boards"],["create","Create"],["referrals","Invite"],["profile","Profile"]] as [View,string][]).map(([key,label])=><Link key={key} href={key==="explore"?"/explore":`/${key}`} prefetch aria-current={(view===key||key==="wallet"&&view==="p2p")?"page":undefined} className={(view===key||key==="wallet"&&view==="p2p")?"active":""}>{key==="create"?<Image className="taskbar-ryvo-logo" src="/ryvo-logo.png" alt="" width={28} height={28}/>:<Icon name={key}/>}<span>{label}</span><NavigationFeedback active={view===key}/></Link>)}</nav>
 <div className="workspace"><header className="topbar"><Link href="/" className="app-brand" aria-label="Ryvo landing page"><Image src="/ryvo-logo.png" alt="" width={38} height={38}/><b>Ryvo</b></Link><div className="breadcrumb">Choose your next challenge <span>↗</span></div><div className="top-actions"><Link className="balance-pill" href="/wallet" prefetch><span className="currency-symbol">r/</span>{state.balance.toLocaleString()} <small>RYVO</small></Link><Link className="icon-button notification" aria-label="Open notifications" href="/notifications" prefetch><Icon name="bell"/>{unread>0&&<i/>}</Link><Link className="avatar" aria-label="Open your profile" href="/profile" prefetch>{account.initials}</Link></div></header>
 <main id="ryvo-content" tabIndex={-1}>
 {collectionId&&!detail?ready?<div className="empty-state"><h2>Competition not found in this browser.</h2><Link className="primary" href="/explore">Find a competition</Link></div>:<RyvoLoadingScreen label={boardView?"Opening your board":"Opening the collection"}/>:detail?(boardView?<BoardPage competition={detail} state={state} ready={ready} busy={busy} error={error} selected={selected} onSelect={setSelected} marketListings={market} onList={(index,price)=>act("list-piece",detail.id,index,{price,requestId:crypto.randomUUID(),ownerName:account.profile.name})} onCancelListing={listingId=>act("cancel-listing",undefined,undefined,{listingId})} onBuyListing={listingId=>act("buy-listing",undefined,undefined,{listingId})} onRedeem={()=>act("redeem-universal",detail.id,undefined,{requestId:crypto.randomUUID()})} onDraw={()=>act("buy-draw",detail.id,undefined,{requestId:crypto.randomUUID()})}/>:<CollectionDetails competition={detail} state={state} ready={ready} busy={busy} error={error} saved={saved.includes(detail.id)} onFavorite={()=>favorite(detail.id)} onJoin={()=>act("join",detail.id)}/>):<>
 {view==="explore"&&<><GameDiscovery competitions={competitions} state={state} onHelp={()=>setHelp(true)}/>
 <section className="collections"><div className="section-heading"><h2>Find your next challenge<span className="lime-dot"/></h2><label className="sort-label"><span>Sort by:</span><select aria-label="Sort challenges" value={sort} onChange={e=>setSort(e.target.value)}><option>Trending</option><option>Entry: low to high</option><option>Most collected</option></select></label></div><div className="collection-tools"><div className="tabs" role="group" aria-label="Filter challenges">{["All collections","3D Art","Abstract","Digital Art","Saved"].map(t=><button key={t} className={category===t?"selected":""} aria-pressed={category===t} onClick={()=>setCategory(t)}>{t=== "All collections"&&<span>✳ </span>}{t}{t==="Saved"&&saved.length>0?` (${saved.length})`:""}</button>)}</div><label className="search"><Icon name="search" size={17}/><input aria-label="Search collections or creators" placeholder="Search collections or creators" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌕</kbd></label></div><p className="challenge-results" role="status">{filtered.length} {filtered.length===1?"challenge":"challenges"}{category==="Saved"?" saved":" to explore"}</p><div className="collection-grid">{filtered.map(c=><CollectionCard key={c.id} c={c} favorite={saved.includes(c.id)} onFavorite={()=>favorite(c.id)} onOpen={()=>open(c)}/>)}</div>{filtered.length===0&&<div className="empty-state"><Icon name="search" size={32}/><h3>No collections found</h3><p>Try another search or explore a different category.</p><button className="secondary" onClick={()=>{setQuery("");setCategory("All collections")}}>Reset filters</button></div>}</section></>}
 {view==="boards"&&<><PageTitle eyebrow="PIECE BY PIECE" title="Your boards. Your next moves." subtitle="The round is still on. Pick a board and keep playing."/>{playerCompetitions.length===0&&<section className="empty-board-start"><Icon name="boards" size={36}/><h2>Your first board starts with a challenge.</h2><p>Register in naira, receive RYVO credit, and start collecting when the round fills.</p><Link className="primary" href="/explore">Find a challenge <Icon name="arrow" size={18}/></Link></section>}<div className="collection-grid board-cards">{playerCompetitions.map(c=><button className="board-card" key={c.id} onClick={()=>router.push(`/board/${c.id}`)}><Artwork theme={c.theme}/><div className="card-content"><span className="eyebrow">{c.remaining} WINNER SLOTS LEFT</span><h3>{c.title}</h3><p>{state.boards[c.id].length} of {c.total} pieces collected</p><div className="progress"><i style={{width:`${state.boards[c.id].length/c.total*100}%`}}/></div><span className="board-link">Keep playing <Icon name="arrow" size={16}/></span></div></button>)}</div></>}
 {view==="wallet"&&<WalletPage state={state} ready={ready} busy={busy} error={error} onAction={(action,payload)=>act(action,undefined,undefined,payload)}/>}
 {view==="p2p"&&<P2PPage state={state} ready={ready} busy={busy} error={error} onAction={(action,payload)=>act(action,undefined,undefined,payload)}/>}
 {view==="notifications"&&<NotificationsPage notices={notices} read={account.read} onRead={account.markRead}/>}
 {view==="profile"&&<><ProfilePage state={state} profile={account.profile} initials={account.initials} onSave={account.saveProfile}/><section className="session-actions">{session?<><p>Signed in to this browser’s demo as {session.email}</p><button className="secondary" onClick={()=>{signOutDemo();window.location.assign("/signin")}}>Sign out</button></>:<><p>Save your progress to a demo account in this browser.</p><Link className="primary" href="/signup">Sign up</Link><Link className="secondary" href="/signin">Sign in</Link></>}</section></>}
 {view==="create"&&(session?<CreateCompetition state={state} ready={ready} busy={busy} error={error} playerName={account.profile.name} onAction={(action,payload)=>act(action,undefined,undefined,payload)}/>:<section className="creator-signin"><p className="eyebrow">YOUR ART. YOUR NEXT CHALLENGE.</p><h1>Create your creator profile.</h1><p>Sign up or sign in to launch a competition with your demo account.</p><Link className="primary" href="/signup?next=/create">Sign up & create <Icon name="arrow"/></Link><Link className="secondary" href="/signin?next=/create">Sign in</Link></section>)}
 {view==="referrals"&&<ReferralsPage username={account.profile.username}/>}
 </>}
 <footer className="page-footer"><span>© 2026 Ryvo. Your next round awaits.</span><button onClick={()=>setHelp(true)}>The little details <span>↗</span></button><span className="demo-label"><i/> Development preview · demo balances</span></footer>
 </main></div>
 <dialog aria-label="How Ryvo works" ref={dialog} onCancel={close} onClick={e=>{if(e.target===dialog.current)close()}}><button className="dialog-close icon-button" aria-label="Close details" onClick={close}><Icon name="close"/></button>{help&&<div className="help-content"><p className="eyebrow">WELCOME TO RYVO</p><h2>Your board.<br/>Your next challenge.</h2>{[["01","Choose your competition","Explore artwork and review the competition's entry fee, piece count and winner slots."],["02","Start your board","Register in naira to receive equivalent RYVO credit. When registration fills, use it for random piece draws."],["03","Connect the pieces","Collect the missing pieces. Valid completed boards qualify within the competition's winner limit."]].map(([n,t,d])=><div className="help-step" key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>)}<p className="notice">Each browser has its own demo wallet starting with ₦100,000. Registration uses demo naira and issues RYVO credits. Piece draws and new player listings use RYVO. No real funds are charged or withdrawn.</p></div>}</dialog>
 {error&&!detail&&view!=="wallet"&&view!=="p2p"&&view!=="create"&&<div className="toast error" role="alert">{error}</div>}{toast&&<div className="toast" role="status"><Icon name="check" size={18}/>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast("")}>×</button></div>}
 </div>
}
function PageTitle({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}){return <div className="page-heading standalone"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{subtitle}</p></div></div>}
function CollectionCard({c,favorite,onFavorite,onOpen}:{c:Competition;favorite:boolean;onFavorite:()=>void;onOpen:()=>void}){
 const registration=Math.min(100,Math.round(c.joined/c.capacity*100));
 const statusLabel=c.status==="open"?"Open to join":c.status==="ended"?"Round ended":c.status==="upcoming"?"In the queue":"In progress";
 return <article className="collection-card">
  <div className="card-art"><button className="art-open" onClick={onOpen} aria-label={`Explore ${c.title}`}><Artwork theme={c.coverKey?`upload:${c.coverKey}`:c.theme}/></button><span className={`status-badge ${c.status}`}><i/>{statusLabel}</span><button className={`favorite ${favorite?"is-saved":""}`} aria-label={`${favorite?"Unsave":"Save"} ${c.title}`} aria-pressed={favorite} onClick={onFavorite}><Icon name="heart" size={18}/></button><span className="piece-count"><Icon name="boards" size={14}/>{c.total} pieces</span><div className="challenge-art-caption"><span>{c.category}</span><h3>{c.title}</h3></div></div>
  <div className="card-content"><h3 className="challenge-row-title"><button onClick={onOpen}>{c.title}</button></h3><p className="artist"><span className={`mini-avatar ${c.theme}`}>{c.artist.split(" ").map(s=>s[0]).join("")}</span>{c.artist}<span className="verified" aria-label="Verified creator"><Icon name="check" size={12}/></span></p>
   <div className="challenge-round-state">{c.status!=="open"&&<p><Icon name="time" size={14}/>{c.status==="active"?`${c.days} ${c.days===1?"day":"days"} left to complete your board`:c.status==="upcoming"?"Waiting for its registration turn":"This competition has finished"}</p>}<div className="challenge-player-count"><span>Players registered</span><b>{c.joined.toLocaleString()} / {c.capacity.toLocaleString()}</b></div><meter min={0} max={c.capacity} value={c.joined} aria-label={`${c.title} registration: ${registration}% full`}/><small>{c.status==="open"?`${Math.max(0,c.capacity-c.joined).toLocaleString()} places left · Next game opens when full`:c.status==="upcoming"?`${c.capacity.toLocaleString()} players needed to start`:"Registration complete"}</small></div>
   <div className="card-meta"><div><span>Registration</span><b>{money(c.fee)}</b><small>+ {credit(c.fee*10)} credit</small></div><div><span>Winner slots</span><b>{c.remaining}<small> / {c.winners}</small></b></div></div>
   <button className="challenge-card-action" onClick={onOpen} aria-label={`View challenge: ${c.title}`}><span>View challenge</span><Icon name="arrow" size={17}/></button>
  </div>
 </article>
}
