"use client";
import Link from "next/link";
import { Artwork, Icon } from "@/components/collection-art";
import { fragmentLayout, money, type Competition, type DemoState } from "@/lib/demo";

export function GameDiscovery({competitions,state,onHelp}:{competitions:Competition[];state:DemoState;onHelp:()=>void}) {
 const featured=competitions.find(c=>c.status==="open")??competitions[0];
 const playing=competitions.filter(c=>state.boards[c.id]);
 const current=playing.find(c=>c.status==="active")??playing[0];
 const pieces=state.inventory?Object.values(state.inventory).reduce((sum,counts)=>sum+counts.reduce((a,b)=>a+b,0),0):Object.values(state.boards).reduce((sum,board)=>sum+board.length,0);
 if(!featured)return null;
 return <section className="game-room" aria-label="Your play room">
  <div className="room-heading"><div><h1>Your next<br/>move<span> starts here.</span></h1><p>One artwork. A board of missing pieces. A race to complete it.</p></div><button onClick={onHelp} className="room-guide" aria-label="How to play"><Icon name="help" size={19}/> How to play</button></div>
  <div className="room-stage">
   <article className="room-feature"><Artwork theme={featured.coverKey?`upload:${featured.coverKey}`:featured.theme}/><div className="room-feature-shade"/><div className="room-feature-top"><span><i/>{featured.status==="open"?"Registration open":"Featured challenge"}</span><span>{featured.category}</span></div><div className="room-feature-copy"><span className="room-artist">A challenge by {featured.artist}</span><h2>{featured.title}<span>.</span></h2><p>Find your pieces.<br/>Be first to the complete picture.</p><div className="room-feature-facts"><span><b>{featured.total}</b> pieces</span><span><b>{featured.remaining}</b> winner slots</span><span><b>{money(featured.fee)}</b> registration</span></div><Link href={`/collection/${featured.id}`} className="room-play">View challenge<Icon name="arrow" size={22}/></Link></div><span className="room-art-index">RYVO COLLECTIONS / {featured.total} PIECES</span></article>
   <aside className="room-next">
    {current?<Link className="room-continue" href={`/board/${current.id}`}><div className="room-continue-top"><span>YOUR GAME IS STILL ON</span><Icon name="arrow" size={20}/></div><div className="room-mini-board"><Artwork theme={current.theme}/><div className="room-mini-grid">{fragmentLayout(current.total).map((piece,i)=><span key={i} style={{left:`${piece.x*100}%`,top:`${piece.y*100}%`,width:`${piece.width*100}%`,height:`${piece.height*100}%`}} className={state.boards[current.id].includes(i)?"filled":""}/>)}</div></div><div className="room-continue-name"><h3>{current.title}</h3><span>{state.boards[current.id].length}<small> / {current.total} pieces</small></span></div><p>Pick up where you left off.</p></Link>:<Link className="room-continue room-new-player" href={`/collection/${featured.id}`}><Icon name="boards" size={42}/><h3>Your first piece.<br/>Your first move.</h3><p>Join a challenge to start your board.</p><span>Find your first game <Icon name="arrow" size={19}/></span></Link>}
    <Link className="room-create" href="/create"><span className="room-create-mark" aria-hidden>+</span><div><h3>Make the<br/>next challenge.</h3><p>Your art. Everyone’s next game.</p></div><span className="room-create-link">Launch a competition <Icon name="arrow" size={19}/></span></Link>
   </aside>
  </div>
  <div className="room-score"><Link href="/boards"><b>{String(playing.length).padStart(2,"0")}</b><span>Your boards</span><Icon name="arrow" size={17}/></Link><Link href="/boards"><b>{String(pieces).padStart(2,"0")}</b><span>Pieces collected</span><Icon name="arrow" size={17}/></Link><Link href="/wallet"><b>{String(state.universal).padStart(2,"0")}</b><span>Universal Pieces</span><Icon name="arrow" size={17}/></Link><p>Your board.<br/><span>Your next win?</span></p></div>
 </section>;
}
