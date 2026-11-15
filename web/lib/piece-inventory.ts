/** Physical copies are separate from the unique slots shown on a player's board. */
export function countCopies(fragments: readonly number[], total: number): number[] {
 const counts=Array<number>(total).fill(0);
 for(const index of fragments){
  if(!Number.isInteger(index)||index<0||index>=total)throw Error("Invalid fragment in inventory.");
  counts[index]++;
 }
 return counts;
}

export function completedSlots(counts: readonly number[]): number[] {
 return counts.flatMap((count,index)=>count>0?[index]:[]);
}

export function duplicateCopies(counts: readonly number[]): number {
 return counts.reduce((sum,count)=>sum+Math.max(0,count-1),0);
}

export function removeCopy(counts: readonly number[], index: number): number[] {
 if(!Number.isInteger(index)||index<0||index>=counts.length||counts[index]<1)throw Error("You do not own a copy of this piece.");
 const next=[...counts];next[index]--;return next;
}

/** Draw uniformly from the remaining physical copies, rather than equally by type. */
export function drawCopy(stock: readonly number[], random: (upper: number)=>number): number {
 if(!stock.every(count=>Number.isSafeInteger(count)&&count>=0))throw Error("Invalid piece supply.");
 const available=stock.reduce((sum,count)=>sum+count,0);
 if(!Number.isSafeInteger(available)||available<1)throw Error("All pieces in this competition have been drawn.");
 const ticket=random(available);
 if(!Number.isSafeInteger(ticket)||ticket<0||ticket>=available)throw Error("Unable to draw a piece. Please try again.");
 let cursor=ticket;
 for(let index=0;index<stock.length;index++){if(cursor<stock[index])return index;cursor-=stock[index]}
 throw Error("Unable to draw a piece. Please try again.");
}

/** Integer r/ pricing: one full set of draws always sums to the entry's value. */
export function pieceDrawPrice(entryCredits: number, total: number, drawIndex: number): number {
 if(!Number.isSafeInteger(entryCredits)||!Number.isSafeInteger(total)||total<1||entryCredits<total||!Number.isSafeInteger(drawIndex)||drawIndex<0)throw Error("Invalid piece pricing.");
 return Math.floor(entryCredits/total)+(drawIndex%total<entryCredits%total?1:0);
}
