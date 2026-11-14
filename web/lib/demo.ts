export type Competition = { id:string; title:string; artist:string; category:string; theme:string; total:number; owned:number[]; fee:number; capacity:number; joined:number; winners:number; remaining:number; days:number; status:"open"|"active"|"upcoming"|"ended"; description?:string; artworkKey?:string; coverKey?:string; prize:number };
export const competitions: Competition[] = [
 {id:"harbour-lights",title:"The Other Side",artist:"Ada Nwosu",category:"3D Art",theme:"explorer",total:12,owned:[],fee:1000,capacity:200,joined:147,winners:20,remaining:20,days:28,status:"open",prize:40000},
 {id:"night-bloom",title:"Night Bloom",artist:"Ifeoma Adeyemi",category:"Abstract",theme:"bloom",total:12,owned:[0,1,2,4,5,6,8,9],fee:2000,capacity:150,joined:150,winners:25,remaining:8,days:19,status:"active",prize:60000},
 {id:"salt-flats",title:"Chrome Dreams",artist:"Tomas Reiner",category:"3D Art",theme:"chrome",total:25,owned:[0,1,3,4,5,6,7,8,10,11,12,13,15,16,18,19,21,23],fee:500,capacity:100,joined:100,winners:10,remaining:3,days:6,status:"active",prize:10000},
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
export type PieceListing={id:string;competitionId:string;index:number;price:number;ownerId:string;ownerName:string;status:"active"|"sold"|"cancelled";listedAt:string;buyerId?:string};
export type CreatedCompetition=Competition&{creatorId:string;launchFee:number;creatorShare:5|10;createdAt:string;requestId:string;description:string;artworkKey:string;coverKey:string};
export type RoundProgress={joined:number;status:Competition["status"];startedAt?:string;endsAt?:string};
export type DemoState = {ownerId?:string;listings?:PieceListing[];createdCompetitions?:CreatedCompetition[];rounds?:Record<string,RoundProgress>;earnings?:number;walletVersion?:1;bank?:BankAccount|null;withdrawals?:Withdrawal[];fundingOrders?:FundingOrder[];version:2;balance:number; cash:number; universal:number; boards:Record<string,number[]>; ledger:Ledger[]; purchases:string[]};
export const initialState:DemoState = {walletVersion:1,earnings:7500,bank:null,withdrawals:[],fundingOrders:[],version:2,balance:18400,cash:100000,universal:1,boards:{"night-bloom":competitions[1].owned,"salt-flats":competitions[2].owned},ledger:[{id:"demo-earnings",label:"Sample marketplace earnings",amount:7500,currency:"NGN",date:"2026-11-13T10:01:00Z"},{id:"welcome",label:"Welcome RYVO credit",amount:20000,currency:"RYVO",date:"2026-11-11T10:00:00Z"},{id:"purchase",label:"Universal Piece purchase",amount:-1600,currency:"RYVO",date:"2026-11-12T10:00:00Z"},{id:"demo-funding",label:"Welcome demo naira balance",amount:100000,currency:"NGN",date:"2026-11-13T10:00:00Z"}],purchases:[]};
export const CREDIT_RATE=10;
export const SWAP_FEE=100;
export const credit=(n:number)=>`${n.toLocaleString()} r/`;
export const money=(n:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2,minimumFractionDigits:0}).format(n);

export const validMoney=(n:unknown):n is number=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=1e12&&Math.abs(n*100-Math.round(n*100))<0.001;
export const roundMoney=(n:number)=>Math.round(n*100)/100;
export const marketplaceFee=(price:number)=>Math.round(price/2)/100;
export const launchFeeFor=(fee:number,capacity:number,share:5|10)=>roundMoney(fee*capacity*share/200);
export function oneMonthAfter(iso:string){const d=new Date(iso),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString()}
export function fragmentLayout(total:number){const rows=Math.max(1,Math.floor(Math.sqrt(total))),base=Math.floor(total/rows),extra=total%rows;const result:{x:number;y:number;width:number;height:number}[]=[];for(let row=0;row<rows;row++){const count=base+(row<extra?1:0);for(let col=0;col<count;col++)result.push({x:col/count,y:row/rows,width:1/count,height:1/rows})}return result}
export function allCompetitions(s:DemoState,now=0):Competition[]{return [...competitions,...s.createdCompetitions??[]].map(c=>{const r=s.rounds?.[c.id];return {...c,...r,days:r?.endsAt&&now?Math.max(0,Math.ceil((Date.parse(r.endsAt)-Math.max(now,r.startedAt?Date.parse(r.startedAt):now))/86400000)):c.days}})}
export function validListing(l:unknown):l is PieceListing{if(!l||typeof l!=="object")return false;const a=l as PieceListing;return typeof a.id==="string"&&a.id.length>=10&&a.id.length<=100&&typeof a.competitionId==="string"&&Number.isInteger(a.index)&&a.index>=0&&a.index<50&&Number.isSafeInteger(a.price)&&a.price>=500&&a.price<=100000&&typeof a.ownerId==="string"&&a.ownerId.length<=100&&typeof a.ownerName==="string"&&a.ownerName.length<=80&&["active","sold","cancelled"].includes(a.status)&&Number.isFinite(Date.parse(a.listedAt))}
function progressRounds(s:DemoState,now:number){s.rounds??={};for(const c of [...competitions,...s.createdCompetitions??[]]){s.rounds[c.id]??={joined:c.joined,status:c.status,...(c.status==="active"?{startedAt:c.id==="night-bloom"?"2026-11-03T10:00:00.000Z":"2026-10-21T10:00:00.000Z",endsAt:c.id==="night-bloom"?"2026-12-03T10:00:00.000Z":"2026-11-21T10:00:00.000Z"}:{})};const r=s.rounds[c.id];if(r.status==="open"&&r.joined>=c.capacity){r.status="active";r.startedAt=new Date(now).toISOString();r.endsAt=oneMonthAfter(r.startedAt)}if(r.status==="active"&&r.endsAt&&Date.parse(r.endsAt)<=now)r.status="ended"}
if(!Object.values(s.rounds).some(r=>r.status==="open")){const next=[...competitions,...s.createdCompetitions??[]].find(c=>s.rounds![c.id]?.status==="upcoming");if(next)s.rounds[next.id].status="open"}}


export const DEMO_STORAGE_KEY = "ryvo-demo-wallet-v2";

/** Demo snapshots are browser-owned test data, never real-money accounts. */
export function isDemoState(value: unknown): value is DemoState {
 if (!value || typeof value !== "object") return false;
 const s = value as DemoState;
 const amount = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0;
 if (s.version !== 2 || !validMoney(s.cash) || !amount(s.balance) || !amount(s.universal)) return false;
 if (!s.boards || typeof s.boards !== "object" || Array.isArray(s.boards)) return false;
 if(s.ownerId!==undefined&&(typeof s.ownerId!=="string"||s.ownerId.length>100))return false;
 if(s.createdCompetitions!==undefined&&(!Array.isArray(s.createdCompetitions)||s.createdCompetitions.length>20||!s.createdCompetitions.every(c=>c&&/^custom-[a-z0-9-]{10,80}$/.test(c.id)&&typeof c.title==="string"&&c.title.length>=3&&c.title.length<=70&&typeof c.artist==="string"&&c.artist.length<=80&&typeof c.description==="string"&&c.description.length<=1200&&Number.isInteger(c.total)&&c.total>=10&&c.total<=50&&Number.isInteger(c.capacity)&&c.capacity>=2&&c.capacity<=10000&&[500,1000,2000].includes(c.fee)&&Number.isInteger(c.winners)&&c.winners>=1&&c.winners<=c.capacity&&[5,10].includes(c.creatorShare)&&validMoney(c.launchFee)&&c.launchFee===launchFeeFor(c.fee,c.capacity,c.creatorShare)&&typeof c.creatorId==="string"&&c.status==="upcoming"&&c.joined===0&&c.theme===`upload:${c.artworkKey}`&&typeof c.requestId==="string"&&c.requestId.length<=100&&typeof c.artworkKey==="string"&&/^asset-[a-z0-9-]{10,80}$/.test(c.artworkKey)&&typeof c.coverKey==="string"&&/^asset-[a-z0-9-]{10,80}$/.test(c.coverKey)&&Number.isFinite(Date.parse(c.createdAt)))))return false;
 const definitions=allCompetitions(s);
 if(s.rounds!==undefined&&(!s.rounds||typeof s.rounds!=="object"||Object.entries(s.rounds).some(([id,r])=>{const c=definitions.find(c=>c.id===id);return !c||!r||!Number.isInteger(r.joined)||r.joined<0||r.joined>c.capacity||!["open","active","upcoming","ended"].includes(r.status)||r.startedAt!==undefined&&!Number.isFinite(Date.parse(r.startedAt))||r.endsAt!==undefined&&!Number.isFinite(Date.parse(r.endsAt))})))return false;
 if(s.createdCompetitions&&new Set(s.createdCompetitions.map(c=>c.id)).size!==s.createdCompetitions.length)return false;
 if(s.listings!==undefined&&(!Array.isArray(s.listings)||s.listings.length>200||!s.listings.every(l=>validListing(l)&&l.ownerId===(s.ownerId??"guest")&&definitions.some(c=>c.id===l.competitionId&&l.index<c.total))))return false;
 for (const [id, pieces] of Object.entries(s.boards)) {
  const c = allCompetitions(s).find(c => c.id === id);
  if (!c || !Array.isArray(pieces) || pieces.length > c.total || new Set(pieces).size !== pieces.length || pieces.some(i => !Number.isInteger(i) || i < 0 || i >= c.total)) return false;
 }
 if (!Array.isArray(s.purchases) || s.purchases.length > 200 || !s.purchases.every(p => typeof p === "string" && p.length < 100)) return false;
 if (s.earnings!==undefined&&!validMoney(s.earnings))return false;
 if(s.walletVersion!==undefined&&s.walletVersion!==1)return false;
 const bankValid=(b:BankAccount)=>b&&demoBanks.includes(b.bank)&&typeof b.accountNumber==="string"&&/^\d{10}$/.test(b.accountNumber)&&typeof b.accountName==="string"&&b.accountName.trim().length>=2&&b.accountName.length<=80;
 if(s.bank!==undefined&&s.bank!==null&&!bankValid(s.bank))return false;
 if(s.withdrawals!==undefined&&(!Array.isArray(s.withdrawals)||s.withdrawals.length>100||!s.withdrawals.every(w=>w&&typeof w.id==="string"&&w.id.length<=100&&validMoney(w.amount)&&w.amount>=500&&bankValid(w.bank)&&["pending","completed"].includes(w.status)&&Number.isFinite(Date.parse(w.requestedAt))&&Number.isFinite(Date.parse(w.readyAt)))))return false;
 if(s.fundingOrders!==undefined&&(!Array.isArray(s.fundingOrders)||s.fundingOrders.length>100||!s.fundingOrders.every(o=>o&&typeof o.id==="string"&&o.id.length<=100&&merchants.some(m=>m.id===o.merchantId)&&amount(o.naira)&&amount(o.credits)&&Number.isFinite(Date.parse(o.createdAt)))))return false;
 if(s.listings?.some(l=>l.status==="active"&&s.boards[l.competitionId]?.includes(l.index)))return false;
 if (!Array.isArray(s.ledger) || s.ledger.length > 500) return false;
 return s.ledger.every(t => t && typeof t.id === "string" && t.id.length <= 100 && typeof t.label === "string" && t.label.length <= 200 && (t.currency==="NGN"?validMoney(Math.abs(t.amount)):Number.isSafeInteger(t.amount)) && ["RYVO", "NGN"].includes(t.currency) && typeof t.date === "string" && Number.isFinite(Date.parse(t.date)));
}

export function upgradeDemoWallet(snapshot:DemoState):DemoState {
 const s=structuredClone(snapshot);
 if(!s.walletVersion){s.earnings=7500;s.bank=null;s.withdrawals=[];s.fundingOrders=[];s.walletVersion=1;s.ledger.unshift({id:"demo-earnings",label:"Sample marketplace earnings",amount:7500,currency:"NGN",date:new Date().toISOString()});}
 s.fundingOrders??=[];s.withdrawals??=[];s.earnings??=7500;s.bank??=null;s.listings??=[];s.createdCompetitions??=[];s.ownerId??="guest";
 return s;
}
export function settleDemoWithdrawals(snapshot:DemoState,now=Date.now()):DemoState {
 const s=upgradeDemoWallet(snapshot);
 progressRounds(s,now);
 for(const withdrawal of s.withdrawals??[])if(withdrawal.status==="pending"&&Date.parse(withdrawal.readyAt)<=now)withdrawal.status="completed";
 return s;
}
export function applyDemoAction(snapshot: DemoState, action: string, id: unknown, index?: unknown, payload?:unknown): DemoState {
 const s = settleDemoWithdrawals(snapshot);
 const c = allCompetitions(s).find(c => c.id === id);
 if (action === "join") {
  if (!c || c.status !== "open") throw Error("This competition is not open for registration.");
  if (s.boards[c.id]) throw Error("You have already joined this competition.");
  if (s.balance < c.fee*CREDIT_RATE) throw Error("Insufficient RYVO credit. Fund your wallet through P2P.");
  s.balance -= c.fee*CREDIT_RATE;
  s.boards[c.id] = [0];
  s.rounds![c.id].joined++;
  const date = new Date().toISOString();
  s.ledger.unshift({id:crypto.randomUUID(),label:`Entry payment · ${c.title}`,amount:-c.fee*CREDIT_RATE,currency:"RYVO",date});
 } else if (action === "buy") {
  if (!c || !s.boards[c.id]) throw Error("Join the competition before collecting pieces.");
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= c.total) throw Error("Invalid piece.");
  if (s.boards[c.id].includes(index)) throw Error("You already own this piece.");
  if(c.status!=="active")throw Error("Collecting starts when registration fills and the competition goes live.");
  if(s.listings?.some(l=>l.competitionId===c.id&&l.index===index&&l.status==="active"))throw Error("This piece is listed by you. Cancel its listing to return it to your board.");
  const price = 900 + index * 100;
  if (s.cash < price) throw Error("Insufficient demo naira balance.");
  s.cash -= price;
  s.boards[c.id].push(index);
  s.purchases.push(`${c.id}:${index}`);
  s.ledger.unshift({id:crypto.randomUUID(), label:`Piece #${String(index+1).padStart(2,"0")} · ${c.title}`, amount:-price, currency:"NGN", date:new Date().toISOString()});
 } else if(action==="list-piece"){
  const p=payload as {price:number;requestId:string;ownerName:string};
  if(!c||c.status!=="active"||typeof index!=="number"||!Number.isInteger(index)||index<0||index>=c.total)throw Error("Listing starts when the competition goes live. Choose an owned piece in an active competition.");
  if(!p||typeof p.requestId!=="string"||p.requestId.length<10||p.requestId.length>100||typeof p.ownerName!=="string"||p.ownerName.length>80||!Number.isSafeInteger(p.price)||p.price<500||p.price>100000)throw Error("Set a whole-naira price between ₦500 and ₦100,000.");
  if(s.listings!.some(l=>l.id===p.requestId))return s;
  if(!s.boards[c.id]?.includes(index))throw Error("You can only list a piece currently on your board.");
  if(s.listings!.some(l=>l.competitionId===c.id&&l.index===index&&l.status==="active"))throw Error("This piece is already listed.");
  s.boards[c.id]=s.boards[c.id].filter(i=>i!==index);
  s.listings!.unshift({id:p.requestId,competitionId:c.id,index,price:p.price,ownerId:s.ownerId!,ownerName:p.ownerName||"Player",status:"active",listedAt:new Date().toISOString()});
 } else if(action==="cancel-listing"){
  const p=payload as {listingId:string};const l=s.listings!.find(l=>l.id===p?.listingId);
  if(!l||l.ownerId!==s.ownerId)throw Error("Listing not found in your account.");
  if(l.status==="cancelled")return s;if(l.status!=="active")throw Error("A sold piece cannot return to your board.");
  l.status="cancelled";if(!s.boards[l.competitionId]?.includes(l.index))s.boards[l.competitionId]?.push(l.index);
 } else if(action==="buy-listing"){
  const l=payload as PieceListing;
  if(!validListing(l)||l.status!=="active"||l.ownerId===s.ownerId)throw Error("This listing cannot be purchased.");
  if(s.purchases.includes(`listing:${l.id}`))return s;
  const game=allCompetitions(s).find(c=>c.id===l.competitionId);
  if(!game||game.status!=="active"||!s.boards[game.id])throw Error("Join an available competition before buying a piece.");
  if(l.index>=game.total||s.boards[game.id].includes(l.index))throw Error("You already own this fragment or it is invalid.");
  if(s.cash<l.price)throw Error("Insufficient demo naira balance.");
  s.cash=roundMoney(s.cash-l.price);s.boards[game.id].push(l.index);s.purchases.push(`listing:${l.id}`);
  s.ledger.unshift({id:`buy:${l.id}`,label:`Piece #${String(l.index+1).padStart(2,"0")} · ${game.title}`,amount:-l.price,currency:"NGN",date:new Date().toISOString()});
 } else if(action==="settle-sale"){
  const p=payload as {listingId:string;buyerId:string};const l=s.listings!.find(l=>l.id===p?.listingId);
  if(!l||typeof p.buyerId!=="string"||p.buyerId===s.ownerId)throw Error("Invalid sale.");
  if(l.status==="sold")return s;if(l.status!=="active")throw Error("This listing is no longer available.");
  const proceeds=roundMoney(l.price-marketplaceFee(l.price));l.status="sold";l.buyerId=p.buyerId;s.earnings=roundMoney(s.earnings!+proceeds);
  s.ledger.unshift({id:`sale:${l.id}`,label:`Piece sale · ${l.ownerName} · 0.5% fee`,amount:proceeds,currency:"NGN",date:new Date().toISOString()});
 } else if(action==="launch"){
  const p=payload as {title:string;description:string;artist:string;total:number;capacity:number;winners:number;fee:number;creatorShare:5|10;artworkKey:string;coverKey:string;requestId:string};
  if(!p||typeof p.requestId!=="string"||p.requestId.length<10||p.requestId.length>80)throw Error("Invalid launch request.");
  if(s.createdCompetitions!.some(c=>c.requestId===p.requestId))return s;
  if(s.createdCompetitions!.length>=20)throw Error("Your demo competition limit is 20.");
  if(typeof p.title!=="string"||p.title.trim().length<3||p.title.length>70||typeof p.description!=="string"||p.description.trim().length<20||p.description.length>1200||typeof p.artist!=="string"||p.artist.length<2||p.artist.length>80||!Number.isInteger(p.total)||p.total<10||p.total>50||!Number.isInteger(p.capacity)||p.capacity<2||p.capacity>10000||!Number.isInteger(p.winners)||p.winners<1||p.winners>p.capacity||![500,1000,2000].includes(p.fee)||![5,10].includes(p.creatorShare)||!/^asset-[a-z0-9-]{10,80}$/.test(p.artworkKey)||!/^asset-[a-z0-9-]{10,80}$/.test(p.coverKey))throw Error("Check your artwork, 10–50 fragments, capacity, winner slots and entry fee.");
  const fee=launchFeeFor(p.fee,p.capacity,p.creatorShare);if(s.cash<fee)throw Error("Insufficient demo naira for the launch fee.");
  const date=new Date().toISOString();s.cash=roundMoney(s.cash-fee);
  const game:CreatedCompetition={id:`custom-${p.requestId}`,title:p.title.trim(),description:p.description.trim(),artist:p.artist,category:"Digital Art",theme:`upload:${p.artworkKey}`,artworkKey:p.artworkKey,coverKey:p.coverKey,total:p.total,owned:[],fee:p.fee,capacity:p.capacity,joined:0,winners:p.winners,remaining:p.winners,days:30,status:"upcoming",prize:roundMoney(p.fee*p.capacity*0.2),creatorId:s.ownerId!,launchFee:fee,creatorShare:p.creatorShare,createdAt:date,requestId:p.requestId};
  s.createdCompetitions!.push(game);s.rounds![game.id]={joined:0,status:"upcoming"};
  s.ledger.unshift({id:`launch:${p.requestId}`,label:`Competition launch · ${game.title}`,amount:-fee,currency:"NGN",date});
 } else if(action==="fill-demo-registration"){
  const current=allCompetitions(s).find(c=>c.status==="open");if(!current)throw Error("No registration is open.");
  s.rounds![current.id].joined=current.capacity;
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
 } else if(action==="swap"||action==="sell"){
  const order=payload as {amount:number;requestId:string;merchantId?:string};
  if(!order||typeof order.requestId!=="string"||order.requestId.length<10||order.requestId.length>100)throw Error("Invalid conversion request.");
  if(s.ledger.some(t=>t.id===order.requestId))return s;
  const merchant=merchants.find(m=>m.id===order.merchantId);
  if(action==="sell"&&!merchant)throw Error("Choose a merchant.");
  const rate=action==="swap"?CREDIT_RATE:merchant!.rate;
  const fee=action==="swap"?SWAP_FEE:0;
  if(!Number.isSafeInteger(order.amount)||order.amount<=fee||(order.amount-fee)%rate!==0)throw Error(`Enter credits above ${fee} r/ with the remaining amount divisible by ${rate}.`);
  const naira=(order.amount-fee)/rate;
  if(action==="sell"&&(naira<merchant!.minimum||naira>merchant!.maximum))throw Error("Enter credits within the merchant’s displayed limits.");
  if(order.amount>s.balance)throw Error("Insufficient RYVO credit.");
  if(!validMoney(roundMoney(s.earnings!+naira)))throw Error("Demo balance limit reached.");
  s.balance-=order.amount;s.earnings=roundMoney(s.earnings!+naira);
  const date=new Date().toISOString();
  s.ledger.unshift({id:order.requestId,label:action==="swap"?`Swap debit · includes ${fee} r/ fee`:`P2P sale · ${merchant!.name}`,amount:-order.amount,currency:"RYVO",date},{id:crypto.randomUUID(),label:action==="swap"?"Swap to naira":"P2P sale proceeds",amount:naira,currency:"NGN",date});
 } else if(action==="withdraw"){
  const request=payload as {amount:number;requestId:string};
  if(!request||typeof request.requestId!=="string"||request.requestId.length<10||request.requestId.length>100)throw Error("Invalid withdrawal request.");
  if((s.withdrawals??[]).some(w=>w.id===request.requestId))return s;
  if(!s.bank)throw Error("Add a test bank account before withdrawing.");
  if((s.withdrawals??[]).some(w=>w.status==="pending"))throw Error("A withdrawal is already processing. Please wait for it to finish.");
  if(!validMoney(request.amount)||request.amount<500)throw Error("The demo withdrawal minimum is ₦500.");
  if(request.amount>(s.earnings??0))throw Error("Withdrawals can only use your available earnings, not RYVO credits or demo spending money.");
  s.earnings=roundMoney(s.earnings!-request.amount);
  const date=new Date().toISOString();
  s.withdrawals!.unshift({id:request.requestId,amount:request.amount,bank:structuredClone(s.bank),status:"pending",requestedAt:date,readyAt:new Date(Date.now()+120000).toISOString()});
  s.ledger.unshift({id:request.requestId,label:`Withdrawal requested · ${s.bank.bank}`,amount:-request.amount,currency:"NGN",date});
 } else if(action!=="settle")throw Error("Unsupported action.");
 progressRounds(s,Date.now());
 return s;
}
