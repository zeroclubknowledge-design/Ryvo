"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-button";
import { useState } from "react";
import { CollectionViewSwitch } from "@/components/collection-view-switch";
import { Artwork, Icon } from "@/components/collection-art";
import { type Competition, type DemoState } from "@/lib/demo";

type Props = {
 competition:Competition; state:DemoState; ready:boolean; busy:boolean; error:string;
 saved:boolean; onFavorite:()=>void;
 onJoin:()=>void;
};
const stories:Record<string,string>={
 "harbour-lights":"Somewhere between the familiar and the unknown, a new world takes shape. The Other Side is an exploration of identity through sculptural silhouettes, reflective surfaces and a flash of unexpected light.",
 "night-bloom":"A quiet celebration of things that come alive after dark. Soft violet forms unfold around a golden centre, bringing a little wonder to the space between light and shadow.",
 "salt-flats":"Fluid forms. Unexpected reflections. Chrome Dreams turns a familiar material into something almost impossible, inviting you to look again with every piece you collect.",
 "paper-lanterns":"A small universe of warm colour and gentle movement. Soft Orbit finds beauty in the way separate things can belong together, even from a distance."
};
export function CollectionDetails({competition:c,state,ready,busy,error,saved,onFavorite,onJoin}:Props){
 const [tab,setTab]=useState("Overview");
 const owned=state.boards[c.id];
 const progress=owned?.length??0;
 const round=state.rounds?.[c.id];
 const showDate=(date:string)=>new Date(date).toLocaleString("en-NG",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Lagos"});
 const status=c.status==="open"?"Open to join":c.status==="upcoming"?"Up next":c.status==="ended"?"Round ended":"In progress";
 return <div className="collection-page">
  <nav className="collection-breadcrumb" aria-label="Breadcrumb"><BackLink href="/explore" ariaLabel="Back to explore"/><span>/</span><span>Collections</span><span>/</span><b>{c.title}</b></nav>
  <div className="collection-page-heading"><div className="collection-series"><span className="live-dot"/> THE RYVO COLLECTIONS <span>VOL. {String(c.total).padStart(2,"0")}</span></div><CollectionViewSwitch id={c.id} view="collectible"/></div>
  <div className="collection-intro-grid">
   <section className="collection-gallery" aria-label="Collection artwork">
    <div className="collection-main-art"><Artwork theme={c.coverKey?`upload:${c.coverKey}`:c.theme}/><span className="gallery-category">{c.category} <span>↗</span></span><button className={`gallery-favorite ${saved?"is-saved":""}`} onClick={onFavorite} aria-label={`${saved?"Unsave":"Save"} ${c.title}`} aria-pressed={saved}><Icon name="heart" size={20}/></button><div className="artwork-signature"><span>THE COMPLETE PICTURE</span><b>{c.title}</b><small>{c.total} pieces. One board to beat.</small></div><span className="gallery-edition">01 / 01</span></div>
    <div className="gallery-caption"><span><Icon name="explore" size={15}/> Original collection artwork</span><span>{c.total} collectible pieces <span>↗</span></span></div>
   </section>
   <section className="collection-summary">
    <div className="summary-topline"><span className={`collection-status ${c.status}`}><i/>{status}</span><span className="collection-category">{c.category}</span></div>
    <h1>{c.title}<span>.</span></h1>
    <div className="collection-creator"><span className="creator-avatar">{c.artist.split(" ").map(s=>s[0]).join("")}</span><div><small>Created by</small><span>{c.artist} <b className="verified">✳</b></span></div></div>
    <p className="collection-description">{c.description||stories[c.id]}</p>
    <div className="collection-numbers"><div><Icon name="boards" size={16}/><b>{c.total}</b><span>Unique pieces</span></div><div><Icon name="spark" size={16}/><b>{c.remaining}<small> / {c.winners}</small></b><span>Winner slots left</span></div><div><Icon name="time" size={16}/><b>{c.status==="active"?<>{c.days}<small> days</small></>:c.status==="ended"?"Ended":"1 month"}</b><span>{c.status==="active"?"Remaining":"Starts when full"}</span></div></div>
    <div className="collection-entry-card">
     {owned?<>
      <div className="entry-card-heading"><span>YOUR GAME PROGRESS</span><span className="positive">{Math.round(progress/c.total*100)}% complete</span></div>
      <h2>{progress}<small> / {c.total} pieces collected</small></h2><div className="progress"><i style={{width:`${progress/c.total*100}%`}}/></div>
      <p className="entry-card-description">{progress===c.total?"All pieces collected. Winner qualification is not enabled in this demo.":`${c.total-progress} more pieces to complete the picture. Keep playing.`}</p>
      <Link className="primary collection-cta" href={`/board/${c.id}`}>Explore your board <Icon name="arrow" size={18}/></Link>
     </>:<>
      <div className="entry-card-heading"><span>ENTER THE COMPETITION</span><span>{c.capacity-c.joined} places available</span></div>
      <h2>{(c.fee*10).toLocaleString()} r/<small> entry fee</small></h2>
      <p className="entry-card-description">Pay your entry. Get your first piece. Start the race.</p>
      <div className="collection-benefits"><span><Icon name="check" size={15}/> 1 unique collectible piece</span><span><Icon name="check" size={15}/> Paid with RYVO credits</span></div>
      <button className="primary collection-cta" disabled={!ready||busy||c.status!=="open"} onClick={onJoin}>{busy?"Starting your board…":c.status==="open"?`Join for ${(c.fee*10).toLocaleString()} r/`:c.status==="upcoming"?"Next in the registration queue":"Registration closed"}<Icon name="arrow" size={18}/></button>
      <p className="collection-demo-note">Entry is paid from your RYVO credit balance. No real money is charged.</p>
     </>}
    </div>
    <div className="collection-assurance"><Icon name="help" size={16}/><p>Collect the full artwork to qualify within the winner limit.<br/><span>Explore the competition rules below before joining.</span></p></div>
    {error&&<p className="error" role="alert">{error}</p>}
   </section>
  </div>
  <section className="collection-content" id="collection-content">
   <div className="collection-detail-tabs" role="tablist" aria-label="Collection information">{["Overview","Competition rules"].map(t=><button role="tab" aria-selected={tab===t} aria-controls="collection-tab-panel" id={`tab-${t.replaceAll(" ","-")}`} className={tab===t?"active":""} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div>
   <div role="tabpanel" id="collection-tab-panel" aria-labelledby={`tab-${tab.replaceAll(" ","-")}`}>
    {tab==="Overview"&&<div className="collection-overview"><div><p className="eyebrow">YOUR BOARD. YOUR CHALLENGE.</p><h2>Every piece brings you<br/>closer to the finish.</h2><p>{c.description||stories[c.id]}</p><p>Each piece has a place on your board. Start with one, hunt for the missing pieces and complete the board before the round closes.</p></div><div className="collection-facts"><h3>Collection details</h3>{[["Creator",c.artist],["Art category",c.category],["Artwork fragments",`${c.total} pieces`],["Registration",`${c.joined} / ${c.capacity} places filled`],["Entry fee",`${(c.fee*10).toLocaleString()} r/`],...(round?.startedAt?[["Went live",showDate(round.startedAt)]]:[]),...(round?.endsAt?[["Round ends",showDate(round.endsAt)]]:[]),["Duration","One month after registration fills"]].map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}<p>Swap RYVO to naira or sell to a P2P merchant from your wallet.</p></div></div>}
    {tab==="Competition rules"&&<div className="collection-rules">{[["01","Build your own board",`Entry costs ${(c.fee*10).toLocaleString()} r/ and gives you one unique piece. Collect the ${c.total} required artwork fragments to complete your personal board.`],["02","Watch the winner limit",`This competition has ${c.winners} winner slots. It closes early when the configured winner count is reached through valid completed boards.`],["03","Know the timeline","Every competition runs for one month starting when its registration capacity is filled. There is no grace period."],["04","Understand refunds","If no participant completes a board by the end of the one-month round, participant entry payments and the creator launch fee are refunded. With at least one completed board, that no-winner refund rule does not apply."]].map(([n,title,text])=><article key={n}><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}<p className="notice">Development preview: competition figures are sample data. Payment processing, winner validation and refunds are not live.</p></div>}
   </div>
  </section>
  <div className="collection-next"><span>THERE’S ALWAYS ANOTHER ROUND</span><Link href="/explore">Find your next challenge <Icon name="arrow" size={19}/></Link></div>
 </div>;
}
