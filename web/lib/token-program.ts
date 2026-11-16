export const TOKEN_SUPPLY=10_000_000;
export const COMMUNITY_ALLOCATION=8_000_000;
export const TEAM_ALLOCATION=2_000_000;
export const tokenTiers=[
 {from:1,to:1000,reward:100,label:"First 1,000 players"},
 {from:1001,to:10000,reward:50,label:"Players 1,001–10,000"},
 {from:10001,to:100000,reward:10,label:"Players 10,001–100,000"},
 {from:100001,to:1000000,reward:5,label:"Players 100,001–1,000,000"},
 {from:1000001,to:Infinity,reward:1,label:"Players 1,000,001 onward"}
];
export type TokenAward={ownerId:string;competitionId:string;memberNumber:number;amount:number;awardedAt:string};
export type TokenProgram={distributed:number;awards:TokenAward[]};
export const tokenRate=(memberNumber:number)=>Number.isSafeInteger(memberNumber)&&memberNumber>0?tokenTiers.find(t=>memberNumber<=t.to)!.reward:0;
export const earnedTokens=(program:TokenProgram|undefined,ownerId:string)=>program?.awards.filter(a=>a.ownerId===ownerId).reduce((sum,a)=>sum+a.amount,0)??0;
export function validTokenProgram(value:unknown):value is TokenProgram{
 if(!value||typeof value!=="object")return false;
 const p=value as TokenProgram;
 return Number.isSafeInteger(p.distributed)&&p.distributed>=0&&p.distributed<=COMMUNITY_ALLOCATION&&Array.isArray(p.awards)&&p.awards.length<=10000&&new Set(p.awards.map(a=>`${a?.competitionId}:${a?.ownerId}`)).size===p.awards.length&&p.awards.every(a=>a&&typeof a.ownerId==="string"&&a.ownerId.length<=100&&typeof a.competitionId==="string"&&a.competitionId.length<=100&&Number.isSafeInteger(a.memberNumber)&&a.memberNumber>0&&Number.isSafeInteger(a.amount)&&a.amount>0&&a.amount<=tokenRate(a.memberNumber)&&Number.isFinite(Date.parse(a.awardedAt)))&&p.awards.reduce((sum,a)=>sum+a.amount,0)<=p.distributed;
}
export function awardWinningTokens(program:TokenProgram,ownerId:string,competitionId:string,memberNumber:number,awardedAt:string){
 if(program.awards.some(a=>a.ownerId===ownerId&&a.competitionId===competitionId))return 0;
 const amount=Math.min(tokenRate(memberNumber),COMMUNITY_ALLOCATION-program.distributed);
 if(amount<=0)return 0;
 if(program.awards.length>=10000)throw Error("Demo token history is full. Please use a fresh demo environment.");
 program.awards.push({ownerId,competitionId,memberNumber,amount,awardedAt});program.distributed+=amount;
 return amount;
}
