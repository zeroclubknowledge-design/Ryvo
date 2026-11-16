import { allCompetitions, isDemoState, type DemoState } from "./demo.ts";
import { initializePieces } from "./piece-economy.ts";
export const WORLD_KEY="ryvo-demo-competition-world-v1";
export function hydrateWorld(state:DemoState):DemoState{
 try{
  const world=JSON.parse(localStorage.getItem(WORLD_KEY)||"null");
  const next=structuredClone(world?{...state,createdCompetitions:world.createdCompetitions,rounds:world.rounds,pieceSupply:world.pieceSupply??state.pieceSupply,finishers:world.finishers??state.finishers,players:world.players??state.players,tokenProgram:world.tokenProgram??state.tokenProgram}:state);
  if(!isDemoState(next))return state;
  initializePieces(next,allCompetitions(next));
  // Reserve copies in every existing local wallet before a new shared pool is spent.
  if(world?.pieceEconomy!==1){
   for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index);if(!key?.startsWith("ryvo-account-wallet:"))continue;
    try{
     const saved=JSON.parse(localStorage.getItem(key)||"null");
     if(!isDemoState(saved)||(saved.ownerId??"guest")===(state.ownerId??"guest"))continue;
     const other={...saved,createdCompetitions:next.createdCompetitions,pieceSupply:next.pieceSupply};
     if(isDemoState(other))initializePieces(other,allCompetitions(next));
    }catch{/* A malformed unrelated wallet cannot replace the current wallet. */}
   }
  }
  return isDemoState(next)?next:state;
 }catch{return state}
}
export function worldSnapshot(state:DemoState){return JSON.stringify({pieceEconomy:1,createdCompetitions:state.createdCompetitions??[],rounds:state.rounds??{},pieceSupply:state.pieceSupply??{},finishers:state.finishers??{},players:state.players??{},tokenProgram:state.tokenProgram??{distributed:0,awards:[]}})}
