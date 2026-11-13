export type Competition = { id:string; title:string; artist:string; category:string; theme:string; total:number; owned:number[]; fee:number; capacity:number; joined:number; winners:number; remaining:number; days:number; status:"open"|"active"|"upcoming"|"grace"; prize:number };
export const competitions: Competition[] = [
 {id:"harbour-lights",title:"The Other Side",artist:"Ada Nwosu",category:"3D Art",theme:"explorer",total:12,owned:[],fee:1000,capacity:200,joined:147,winners:20,remaining:20,days:28,status:"open",prize:40000},
 {id:"night-bloom",title:"Night Bloom",artist:"Ifeoma Adeyemi",category:"Abstract",theme:"bloom",total:12,owned:[0,1,2,4,5,6,8,9],fee:2000,capacity:150,joined:150,winners:25,remaining:8,days:19,status:"active",prize:60000},
 {id:"salt-flats",title:"Chrome Dreams",artist:"Tomas Reiner",category:"3D Art",theme:"chrome",total:25,owned:[0,1,3,4,5,6,7,8,10,11,12,13,15,16,18,19,21,23],fee:500,capacity:100,joined:100,winners:10,remaining:3,days:6,status:"grace",prize:10000},
 {id:"paper-lanterns",title:"Soft Orbit",artist:"Mira Sato",category:"Digital Art",theme:"orbit",total:10,owned:[],fee:1000,capacity:250,joined:0,winners:25,remaining:25,days:30,status:"upcoming",prize:50000}
];
export type Ledger = {id:string; label:string; amount:number; currency:"RYVO"|"NGN"; date:string};
export type DemoState = {version:2;balance:number; cash:number; universal:number; boards:Record<string,number[]>; ledger:Ledger[]; purchases:string[]};
export const initialState:DemoState = {version:2,balance:18400,cash:100000,universal:1,boards:{"night-bloom":competitions[1].owned,"salt-flats":competitions[2].owned},ledger:[{id:"welcome",label:"Competition entry · Night Bloom",amount:20000,currency:"RYVO",date:"2026-11-11T10:00:00Z"},{id:"purchase",label:"Universal Piece purchase",amount:-1600,currency:"RYVO",date:"2026-11-12T10:00:00Z"},{id:"demo-funding",label:"Welcome demo naira balance",amount:100000,currency:"NGN",date:"2026-11-13T10:00:00Z"}],purchases:[]};
export const money=(n:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(n);


export const DEMO_STORAGE_KEY = "ryvo-demo-wallet-v2";

/** Demo snapshots are browser-owned test data, never real-money accounts. */
export function isDemoState(value: unknown): value is DemoState {
 if (!value || typeof value !== "object") return false;
 const s = value as DemoState;
 const amount = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
 if (s.version !== 2 || !amount(s.cash) || !amount(s.balance) || !amount(s.universal)) return false;
 if (!s.boards || typeof s.boards !== "object" || Array.isArray(s.boards)) return false;
 for (const [id, pieces] of Object.entries(s.boards)) {
  const c = competitions.find(c => c.id === id);
  if (!c || !Array.isArray(pieces) || pieces.length > c.total || new Set(pieces).size !== pieces.length || pieces.some(i => !Number.isInteger(i) || i < 0 || i >= c.total)) return false;
 }
 if (!Array.isArray(s.purchases) || s.purchases.length > 200 || !s.purchases.every(p => typeof p === "string" && p.length < 100)) return false;
 if (!Array.isArray(s.ledger) || s.ledger.length > 500) return false;
 return s.ledger.every(t => t && typeof t.id === "string" && t.id.length <= 100 && typeof t.label === "string" && t.label.length <= 200 && Number.isSafeInteger(t.amount) && ["RYVO", "NGN"].includes(t.currency) && typeof t.date === "string" && Number.isFinite(Date.parse(t.date)));
}

export function applyDemoAction(snapshot: DemoState, action: string, id: unknown, index?: unknown): DemoState {
 const s = structuredClone(snapshot);
 const c = competitions.find(c => c.id === id);
 if (action === "join") {
  if (!c || c.status !== "open") throw Error("This competition is not open for registration.");
  if (s.boards[c.id]) throw Error("You have already joined this competition.");
  if (s.cash < c.fee) throw Error("Insufficient demo naira balance.");
  s.cash -= c.fee;
  s.boards[c.id] = [0];
  s.balance += c.fee * 10;
  const date = new Date().toISOString();
  s.ledger.unshift(
   {id:crypto.randomUUID(), label:`Entry payment · ${c.title}`, amount:-c.fee, currency:"NGN", date},
   {id:crypto.randomUUID(), label:`Entry credit · ${c.title}`, amount:c.fee*10, currency:"RYVO", date}
  );
 } else if (action === "buy") {
  if (!c || !s.boards[c.id]) throw Error("Join the competition before collecting pieces.");
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= c.total) throw Error("Invalid piece.");
  if (s.boards[c.id].includes(index)) throw Error("You already own this piece.");
  const price = 900 + index * 100;
  if (s.cash < price) throw Error("Insufficient demo naira balance.");
  s.cash -= price;
  s.boards[c.id].push(index);
  s.purchases.push(`${c.id}:${index}`);
  s.ledger.unshift({id:crypto.randomUUID(), label:`Piece #${String(index+1).padStart(2,"0")} · ${c.title}`, amount:-price, currency:"NGN", date:new Date().toISOString()});
 } else throw Error("Unsupported action.");
 return s;
}
