import { countCopies, completedSlots, drawCopy, pieceDrawPrice } from "./piece-inventory.ts";
import type { Competition, DemoState } from "./demo.ts";

export type PieceSupply={remaining:number[];adoptedOwners:string[]};
export type Finisher={ownerId:string;name:string;completedAt:string;reward:number};
export type PlayerProgress={name:string;pieces:number;updatedAt:string};
export const inventoryFor=(state:DemoState,game:Competition)=>state.inventory?.[game.id]??countCopies(state.boards[game.id]??[],game.total);
export const stockFor=(state:DemoState,game:Competition)=>state.pieceSupply?.[game.id]?.remaining??Array<number>(game.total).fill(game.capacity);
export const drawPriceFor=(state:DemoState,game:Competition)=>pieceDrawPrice(game.fee*10,game.total,state.drawCounts?.[game.id]??0);
export function syncBoard(state:DemoState,id:string){state.boards[id]=completedSlots(state.inventory![id])}

/** Migrate existing copies once per owner. Never recharge old entries or reset progress. */
export function initializePieces(state:DemoState,games:Competition[]){
 state.inventory??={};state.drawCounts??={};state.pieceSupply??={};state.finishers??={};state.players??={};
 for(const [id,pieces] of Object.entries(state.boards)){
  const game=games.find(game=>game.id===id);if(!game)continue;
  state.inventory[id]??=countCopies(pieces,game.total);
  const supply=state.pieceSupply[id]??={remaining:Array<number>(game.total).fill(game.capacity),adoptedOwners:[]};
  const owner=state.ownerId??"guest";
  if(!supply.adoptedOwners.includes(owner)){
   for(let index=0;index<game.total;index++){
    const reserved=(state.listings??[]).filter(listing=>listing.competitionId===id&&listing.index===index&&listing.status==="active").length;
    const copies=state.inventory[id][index]+reserved;
    if(copies>supply.remaining[index])throw Error("This legacy inventory exceeds the competition's remaining supply.");
    supply.remaining[index]-=copies;
   }
   supply.adoptedOwners.push(owner);
  }
  syncBoard(state,id);
 }
}

function randomBelow(upper:number){const limit=Math.floor(0x100000000/upper)*upper,draw=new Uint32Array(1);do{crypto.getRandomValues(draw)}while(draw[0]>=limit);return draw[0]%upper}
export function revealCopy(state:DemoState,game:Competition){
 const supply=state.pieceSupply![game.id];
 const index=drawCopy(supply.remaining,randomBelow);
 supply.remaining[index]--;state.inventory![game.id][index]++;syncBoard(state,game.id);
 return index;
}
