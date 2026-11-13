export type Competition = { id:string; title:string; artist:string; category:string; theme:string; total:number; owned:number[]; fee:number; capacity:number; joined:number; winners:number; remaining:number; days:number; status:"open"|"active"|"upcoming"|"grace"; prize:number };
export const competitions: Competition[] = [
 {id:"harbour-lights",title:"The Other Side",artist:"Ada Nwosu",category:"3D Art",theme:"explorer",total:12,owned:[],fee:1000,capacity:200,joined:147,winners:20,remaining:20,days:28,status:"open",prize:40000},
 {id:"night-bloom",title:"Night Bloom",artist:"Ifeoma Adeyemi",category:"Abstract",theme:"bloom",total:12,owned:[0,1,2,4,5,6,8,9],fee:2000,capacity:150,joined:150,winners:25,remaining:8,days:19,status:"active",prize:60000},
 {id:"salt-flats",title:"Chrome Dreams",artist:"Tomas Reiner",category:"3D Art",theme:"chrome",total:25,owned:[0,1,3,4,5,6,7,8,10,11,12,13,15,16,18,19,21,23],fee:500,capacity:100,joined:100,winners:10,remaining:3,days:6,status:"grace",prize:10000},
 {id:"paper-lanterns",title:"Soft Orbit",artist:"Mira Sato",category:"Digital Art",theme:"orbit",total:10,owned:[],fee:1000,capacity:250,joined:0,winners:25,remaining:25,days:30,status:"upcoming",prize:50000}
];
export type Ledger = {id:string; label:string; amount:number; currency:"RYVO"|"NGN"; date:string};
export type DemoState = {balance:number; cash:number; universal:number; boards:Record<string,number[]>; ledger:Ledger[]; purchases:string[]};
export const initialState:DemoState = {balance:18400,cash:7500,universal:1,boards:{"night-bloom":competitions[1].owned,"salt-flats":competitions[2].owned},ledger:[{id:"welcome",label:"Competition entry · Night Bloom",amount:20000,currency:"RYVO",date:"2026-11-11T10:00:00Z"},{id:"purchase",label:"Universal Piece purchase",amount:-1600,currency:"RYVO",date:"2026-11-12T10:00:00Z"},{id:"sale",label:"Marketplace proceeds",amount:7500,currency:"NGN",date:"2026-11-12T11:00:00Z"}],purchases:[]};
export const money=(n:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n);
