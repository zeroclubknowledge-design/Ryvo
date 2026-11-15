"use client";
import Image from "next/image";
import Link from "next/link";
import { Artwork, Icon } from "@/components/collection-art";
import { fragmentLayout, money, type Competition, type DemoState } from "@/lib/demo";

export function GameDiscovery({competitions,state,onHelp}:{competitions:Competition[];state:DemoState;onHelp:()=>void}) {
 const featured=competitions.find(c=>c.status==="open")??competitions[0];
 const playing=competitions.filter(c=>state.boards[c.id]);
 const current=playing.find(c=>c.status==="active")??playing[0];
 if(!featured)return null;
 return <section className="play-home" aria-label="Your play room">
  <div className="play-home-heading"><h1>Let’s play.</h1><button onClick={onHelp}><Icon name="help" size={17}/>How to play</button></div>
  <div className="play-home-grid">
   <div className="play-home-left">
    <Link className="home-credit" href="/wallet"><span>Your RYVO credit<Icon name="arrow" size={16}/></span><strong>{state.balance.toLocaleString()}<small>r/</small></strong><p>Ready for your next move.</p></Link>
    <section className="home-launch"><div className="home-launch-label"><Image src="/ryvo-logo.png" alt="" width={28} height={28}/><span>Made by you. Played by everyone.</span></div><h2>Turn your art <br/>into the next challenge.</h2><p>Upload an artwork. Choose 10–50 pieces. Put your competition in the queue.</p><Link href="/create">Create a competition<Icon name="arrow" size={18}/></Link></section>
   </div>
   <article className="home-feature"><Artwork theme={featured.coverKey?`upload:${featured.coverKey}`:featured.theme}/><div className="home-feature-shade"/><span className="home-feature-status"><i/>{featured.status==="open"?"Open to join":"Featured competition"}</span><div className="home-feature-content"><span>{featured.category} · {featured.total} pieces</span><h2>{featured.title}</h2><p>Be first to complete the picture.</p><div className="home-feature-numbers"><span><b>{money(featured.fee)}</b>Registration</span><span><b>{featured.joined}/{featured.capacity}</b>Players joined</span><span><b>{featured.remaining}</b>Winner slots</span></div><Link href={`/collection/${featured.id}`}>View challenge<Icon name="arrow" size={18}/></Link></div></article>
  </div>
  <div className="home-next-row">
   {current?<Link className="home-resume" href={`/board/${current.id}`}><div className="home-resume-art"><Artwork theme={current.theme}/><div className="home-resume-grid">{fragmentLayout(current.total).map((piece,i)=><span key={i} style={{left:`${piece.x*100}%`,top:`${piece.y*100}%`,width:`${piece.width*100}%`,height:`${piece.height*100}%`}} className={state.boards[current.id].includes(i)?"filled":""}/>)}</div></div><div><small>Continue playing</small><h3>{current.title}</h3><p>{state.boards[current.id].length} of {current.total} unique pieces</p></div><Icon name="arrow" size={20}/></Link>:<Link className="home-resume" href={`/collection/${featured.id}`}><Icon name="boards" size={30}/><div><small>Your first round</small><h3>A new board is waiting.</h3><p>Choose a challenge and join the game.</p></div><Icon name="arrow" size={20}/></Link>}
   <Link href="/referrals" className="home-invite"><Icon name="referrals" size={24}/><div><h3>Bring your squad.</h3><p>Earn from eligible entry payments.</p></div><Icon name="arrow" size={18}/></Link>
  </div>
 </section>;
}
