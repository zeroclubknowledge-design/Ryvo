"use client";

import Image from "next/image";

import Link from "next/link";

import { useEffect, useState } from "react";

import { LandingFrame } from "@/components/welcome-pages";

import { Icon } from "@/components/collection-art";

import { type DemoState } from "@/lib/demo";

import { emptyWallet, loadLiveData } from "@/lib/live-data";

import { supabase } from "@/lib/supabase";



import { COMMUNITY_ALLOCATION, TOKEN_SUPPLY, TEAM_ALLOCATION, earnedTokens, tokenRate, tokenTiers } from "@/lib/token-program";

const count=(n:number)=>n.toLocaleString("en-NG");

function Distribution({distributed}:{distributed:number}){const percent=distributed/COMMUNITY_ALLOCATION*100;return <div className="token-distribution"><div><span>Community tokens earned</span><b>{count(distributed)} <small>/ {count(COMMUNITY_ALLOCATION)}</small></b></div><progress max={COMMUNITY_ALLOCATION} value={distributed} aria-label="Community token distribution"/><p><b>{percent.toFixed(2)}%</b> of the community allocation · {count(COMMUNITY_ALLOCATION-distributed)} RYVO to the launch milestone</p></div>}

export function TokenWalletCard({state,earned:balance}:{state:DemoState;earned?:number}){const earned=balance??earnedTokens(state.tokenProgram,state.ownerId??"guest"),distributed=state.tokenProgram?.distributed??0;return <section className="token-wallet-card"><div className="token-card-heading"><span><Image src="/ryvo-logo.png" alt="" width={26} height={26}/>RYVO Token wallet</span><b>PRE-LAUNCH</b></div><div className="token-earned"><strong>{count(earned)}</strong><span>RYVO tokens earned</span></div><p>Winning boards earn tokens. Your RYVO Credit balance stays separate.</p>{state.memberNumber&&<span className="token-wallet-rate">Player #{count(state.memberNumber)} · {tokenRate(state.memberNumber)} RYVO per winning collection</span>}<Distribution distributed={distributed}/><Link href="/ryvo-token">{distributed>=COMMUNITY_ALLOCATION?"Community allocation complete · Launching soon":"Explore RYVO Token"}<Icon name="arrow" size={17}/></Link><small>Pre-launch tokens cannot currently be transferred, swapped or withdrawn.</small></section>}

export function TokenPage(){

 const [state,setState]=useState<DemoState|null>(null),[notice,setNotice]=useState(false);

 const [unavailable,setUnavailable]=useState(false);

 useEffect(()=>{let active=true;void (async()=>{try{const {data}=await supabase().auth.getUser();const result=await loadLiveData(data.user);if(active)setState(result.state)}catch{if(active){setState(emptyWallet());setUnavailable(true)}}})();return()=>{active=false}},[]);

 const distributed=state?.tokenProgram?.distributed??0;

 return <LandingFrame active="/ryvo-token"><div className="token-page"><section className="token-hero"><div><span className="token-status">RYVO TOKEN · PRE-LAUNCH</span><h1>Made by players.<br/><em>Earned by winners.</em></h1><p>Complete an artwork in a winning slot. Earn RYVO tokens for your part in the game.</p><Link className="primary" href="/explore">Find your next challenge<Icon name="arrow"/></Link></div><div className="token-emblem"><Image src="/ryvo-logo.png" alt="RYVO Token" width={150} height={150}/><b>10,000,000</b><span>TOTAL RYVO SUPPLY</span></div></section><section className="token-allocation"><div><h2>The community<br/>comes first.</h2><p>A fixed supply. A community-led distribution.</p></div><div><div className="token-allocation-track" aria-label="80% community, 20% team"><span/><span/></div><div className="token-allocation-figures"><article><b>80<small>%</small></b><h3>Community airdrop</h3><p>{count(COMMUNITY_ALLOCATION)} RYVO earned through eligible winning boards.</p></article><article><b>20<small>%</small></b><h3>Team allocation</h3><p>{count(TEAM_ALLOCATION)} RYVO reserved for the team.</p></article></div></div></section><section className="token-rewards"><div><h2>Every winning board.<br/>A reward of your own.</h2><p>Your signup number sets your tier. The reward applies to each collection you complete within its available winner slots.</p></div><div className="token-tier-table">{tokenTiers.map((tier,i)=><article key={tier.from} className={state?.memberNumber&&state.memberNumber>=tier.from&&state.memberNumber<=tier.to?"your-tier":""}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{tier.label}</h3>{state?.memberNumber&&state.memberNumber>=tier.from&&state.memberNumber<=tier.to&&<small>Your current tier</small>}</div><b>{tier.reward}<small>RYVO / winning collection</small></b></article>)}</div><div className="token-rules"><p><Icon name="check"/>Only a completed board in a winning slot qualifies. Joining, buying or listing pieces does not earn a token reward.</p><p><Icon name="check"/>Each player receives one reward per winning collection. Rewards stop at the 8,000,000 RYVO community cap; a final reward may be reduced to fit the remaining allocation.</p><p><Icon name="check"/>RYVO Token is separate from RYVO Credit. Tokens cannot currently be spent, swapped or withdrawn.</p></div></section><section className="token-launch"><h2>The next chapter<br/>belongs to the players.</h2>{unavailable?<p role="status">Distribution data is temporarily unavailable.</p>:<Distribution distributed={distributed}/>}<p>{distributed>=COMMUNITY_ALLOCATION?"The community allocation is complete. Launching soon.":"The launch milestone is reached when all 8,000,000 community tokens have been earned."}</p><button className="token-launch-button" onClick={()=>setNotice(v=>!v)} aria-expanded={notice}><span>Launching<br/>soon</span><Icon name="arrow" size={21}/></button>{notice&&<p className="token-launch-explanation" role="status">{distributed>=COMMUNITY_ALLOCATION?"Distribution is complete. Launch details will be announced here.":`${count(COMMUNITY_ALLOCATION-distributed)} community tokens remain before the launch milestone.`} Token transfers will become available after launch.</p>}<small>Supply: {count(TOKEN_SUPPLY)} RYVO. Token launch details will be announced when the community milestone is reached.</small></section></div></LandingFrame>;

}
