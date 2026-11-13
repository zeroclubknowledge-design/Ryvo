export type Competition = { id:string; title:string; artist:string; category:string; theme:string; total:number; owned:number[]; fee:number; capacity:number; joined:number; winners:number; remaining:number; days:number; status:"open"|"active"|"upcoming"|"grace"; prize:number };
export const competitions: Competition[] = [
 {id:"harbour-lights",title:"The Other Side",artist:"Ada Nwosu",category:"3D Art",theme:"explorer",total:12,owned:[],fee:1000,capacity:200,joined:147,winners:20,remaining:20,days:28,status:"open",prize:40000},
 {id:"night-bloom",title:"Night Bloom",artist:"Ifeoma Adeyemi",category:"Abstract",theme:"bloom",total:12,owned:[0,1,2,4,5,6,8,9],fee:2000,capacity:150,joined:150,winners:25,remaining:8,days:19,status:"active",prize:60000},
 {id:"salt-flats",title:"Chrome Dreams",artist:"Tomas Reiner",category:"3D Art",theme:"chrome",total:25,owned:[0,1,3,4,5,6,7,8,10,11,12,13,15,16,18,19,21,23],fee:500,capacity:100,joined:100,winners:10,remaining:3,days:6,status:"grace",prize:10000},
 {id:"paper-lanterns",title:"Soft Orbit",artist:"Mira Sato",category:"Digital Art",theme:"orbit",total:10,owned:[],fee:1000,capacity:250,joined:0,winners:25,remaining:25,days:30,status:"upcoming",prize:50000}
];
export type Ledger = {id:string; label:string; amount:number; currency:"RYVO"|"NGN"; date:string};
export type BankAccount={bank:string;accountNumber:string;accountName:string};
export type Withdrawal={id:string;amount:number;bank:BankAccount;status:"pending"|"completed";requestedAt:string;readyAt:string};
export type FundingOrder={id:string;merchantId:string;naira:number;credits:number;createdAt:string};
export type Merchant={id:string;name:string;initials:string;rate:number;minimum:number;maximum:number;trades:number;completion:string;response:string};
export const merchants:Merchant[]=[
 {id:"lime-desk",name:"Lime Credit Desk",initials:"LC",rate:12,minimum:500,maximum:50000,trades:426,completion:"99.8%",response:"1–3 min"},
 {id:"orbit-trade",name:"Orbit Exchange",initials:"OE",rate:11,minimum:1000,maximum:75000,trades:318,completion:"99.4%",response:"2–5 min"},
 {id:"purple-vault",name:"Purple Vault",initials:"PV",rate:10,minimum:500,maximum:100000,trades:582,completion:"99.6%",response:"3–5 min"}
];
export const demoBanks=["Demo Bank","Access Bank","First Bank","GTBank","UBA","Zenith Bank"];
export type DemoState = {earnings?:number;walletVersion?:1;bank?:BankAccount|null;withdrawals?:Withdrawal[];fundingOrders?:FundingOrder[];version:2;balance:number; cash:number; universal:number; boards:Record<string,number[]>; ledger:Ledger[]; purchases:string[]};
export const initialState:DemoState = {walletVersion:1,earnings:7500,bank:null,withdrawals:[],fundingOrders:[],version:2,balance:18400,cash:100000,universal:1,boards:{"night-bloom":competitions[1].owned,"salt-flats":competitions[2].owned},ledger:[{id:"demo-earnings",label:"Sample marketplace earnings",amount:7500,currency:"NGN",date:"2026-11-13T10:01:00Z"},{id:"welcome",label:"Competition entry · Night Bloom",amount:20000,currency:"RYVO",date:"2026-11-11T10:00:00Z"},{id:"purchase",label:"Universal Piece purchase",amount:-1600,currency:"RYVO",date:"2026-11-12T10:00:00Z"},{id:"demo-funding",label:"Welcome demo naira balance",amount:100000,currency:"NGN",date:"2026-11-13T10:00:00Z"}],purchases:[]};
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
 if (s.earnings!==undefined&&!amount(s.earnings))return false;
 if(s.walletVersion!==undefined&&s.walletVersion!==1)return false;
 const bankValid=(b:BankAccount)=>b&&demoBanks.includes(b.bank)&&typeof b.accountNumber==="string"&&/^\d{10}$/.test(b.accountNumber)&&typeof b.accountName==="string"&&b.accountName.trim().length>=2&&b.accountName.length<=80;
 if(s.bank!==undefined&&s.bank!==null&&!bankValid(s.bank))return false;
 if(s.withdrawals!==undefined&&(!Array.isArray(s.withdrawals)||s.withdrawals.length>100||!s.withdrawals.every(w=>w&&typeof w.id==="string"&&w.id.length<=100&&amount(w.amount)&&w.amount>=500&&bankValid(w.bank)&&["pending","completed"].includes(w.status)&&Number.isFinite(Date.parse(w.requestedAt))&&Number.isFinite(Date.parse(w.readyAt)))))return false;
 if(s.fundingOrders!==undefined&&(!Array.isArray(s.fundingOrders)||s.fundingOrders.length>100||!s.fundingOrders.every(o=>o&&typeof o.id==="string"&&o.id.length<=100&&merchants.some(m=>m.id===o.merchantId)&&amount(o.naira)&&amount(o.credits)&&Number.isFinite(Date.parse(o.createdAt)))))return false;
 if (!Array.isArray(s.ledger) || s.ledger.length > 500) return false;
 return s.ledger.every(t => t && typeof t.id === "string" && t.id.length <= 100 && typeof t.label === "string" && t.label.length <= 200 && Number.isSafeInteger(t.amount) && ["RYVO", "NGN"].includes(t.currency) && typeof t.date === "string" && Number.isFinite(Date.parse(t.date)));
}

export function upgradeDemoWallet(snapshot:DemoState):DemoState {
 const s=structuredClone(snapshot);
 if(!s.walletVersion){s.earnings=7500;s.bank=null;s.withdrawals=[];s.fundingOrders=[];s.walletVersion=1;s.ledger.unshift({id:"demo-earnings",label:"Sample marketplace earnings",amount:7500,currency:"NGN",date:new Date().toISOString()});}
 s.fundingOrders??=[];s.withdrawals??=[];s.earnings??=7500;s.bank??=null;
 return s;
}
export function settleDemoWithdrawals(snapshot:DemoState,now=Date.now()):DemoState {
 const s=upgradeDemoWallet(snapshot);
 for(const withdrawal of s.withdrawals??[])if(withdrawal.status==="pending"&&Date.parse(withdrawal.readyAt)<=now)withdrawal.status="completed";
 return s;
}
export function applyDemoAction(snapshot: DemoState, action: string, id: unknown, index?: unknown, payload?:unknown): DemoState {
 const s = settleDemoWithdrawals(snapshot);
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
 } else if(action==="save-bank"){
  const bank=payload as BankAccount;
  if(!bank||!demoBanks.includes(bank.bank)||typeof bank.accountNumber!=="string"||!/^\d{10}$/.test(bank.accountNumber)||typeof bank.accountName!=="string"||bank.accountName.trim().length<2||bank.accountName.length>80)throw Error("Choose a bank and enter a 10-digit test account number and account name.");
  if((s.withdrawals??[]).some(w=>w.status==="pending"))throw Error("Wait until the pending withdrawal completes before changing banks.");
  s.bank={bank:bank.bank,accountNumber:bank.accountNumber,accountName:bank.accountName.trim()};
 } else if(action==="fund"){
  const order=payload as {merchantId:string;amount:number;orderId:string};
  const merchant=merchants.find(m=>m.id===order?.merchantId);
  if(!order||typeof order.orderId!=="string"||order.orderId.length<10||order.orderId.length>100)throw Error("Invalid funding order.");
  if((s.fundingOrders??[]).some(o=>o.id===order.orderId))return s;
  if(!merchant||!Number.isSafeInteger(order.amount)||order.amount<merchant.minimum||order.amount>merchant.maximum)throw Error("Enter an amount within the merchant’s naira limits.");
  if(s.cash<order.amount)throw Error("Insufficient demo naira for this transfer.");
  const credits=order.amount*merchant.rate;
  if(!Number.isSafeInteger(s.balance+credits))throw Error("Demo balance limit reached.");
  const date=new Date().toISOString();s.cash-=order.amount;s.balance+=credits;
  s.fundingOrders!.unshift({id:order.orderId,merchantId:merchant.id,naira:order.amount,credits,createdAt:date});
  s.ledger.unshift({id:crypto.randomUUID(),label:`P2P payment · ${merchant.name}`,amount:-order.amount,currency:"NGN",date},{id:crypto.randomUUID(),label:`P2P credit · ${merchant.name}`,amount:credits,currency:"RYVO",date});
 } else if(action==="withdraw"){
  const request=payload as {amount:number;requestId:string};
  if(!request||typeof request.requestId!=="string"||request.requestId.length<10||request.requestId.length>100)throw Error("Invalid withdrawal request.");
  if((s.withdrawals??[]).some(w=>w.id===request.requestId))return s;
  if(!s.bank)throw Error("Add a test bank account before withdrawing.");
  if((s.withdrawals??[]).some(w=>w.status==="pending"))throw Error("A withdrawal is already processing. Please wait for it to finish.");
  if(!Number.isSafeInteger(request.amount)||request.amount<500)throw Error("The demo withdrawal minimum is ₦500.");
  if(request.amount>(s.earnings??0))throw Error("Withdrawals can only use your available earnings, not RYVO credits or demo spending money.");
  s.earnings!-=request.amount;
  const date=new Date().toISOString();
  s.withdrawals!.unshift({id:request.requestId,amount:request.amount,bank:structuredClone(s.bank),status:"pending",requestedAt:date,readyAt:new Date(Date.now()+120000).toISOString()});
  s.ledger.unshift({id:request.requestId,label:`Withdrawal requested · ${s.bank.bank}`,amount:-request.amount,currency:"NGN",date});
 } else if(action!=="settle")throw Error("Unsupported action.");
 return s;
}
