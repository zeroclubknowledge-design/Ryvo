import { promises as fs } from "node:fs";
import path from "node:path";
import { competitions, initialState, type DemoState } from "@/lib/demo";
const file = path.join(process.cwd(),".data","demo.json");
let queue:Promise<unknown>=Promise.resolve();
async function read():Promise<DemoState>{try{return JSON.parse(await fs.readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;return structuredClone(initialState);}}
export async function GET(){await queue;return Response.json(await read(),{headers:{"Cache-Control":"no-store"}});}
export async function POST(req:Request){
 const origin=req.headers.get("origin");if(origin){try{if(new URL(origin).host!==new URL(req.url).host)return Response.json({error:"Origin not allowed"},{status:403});}catch{return Response.json({error:"Invalid origin"},{status:403});}}
 const body=await req.json().catch(()=>null);if(!body||typeof body.action!=="string")return Response.json({error:"Invalid action"},{status:400});
 const operation=queue.then(async()=>{
  const s=await read(); const c=competitions.find(c=>c.id===body.id);
  if(body.action==="join"){
   if(!c||c.status!=="open")throw Error("This competition is not open for registration.");
   if(s.boards[c.id])throw Error("You have already joined this competition.");
   s.boards[c.id]=[0];s.balance+=c.fee*10;
   s.ledger.unshift({id:crypto.randomUUID(),label:`Demo entry · ${c.title}`,amount:c.fee*10,currency:"RYVO",date:new Date().toISOString()});
  }else if(body.action==="buy"){
   if(!c||!s.boards[c.id])throw Error("Join the competition before collecting pieces.");
   const index=body.index;if(!Number.isInteger(index)||index<0||index>=c.total)throw Error("Invalid piece.");
   if(s.boards[c.id].includes(index))throw Error("You already own this piece.");
   const price=900+index*100;if(s.cash<price)throw Error("Insufficient demo cash balance.");
   s.cash-=price;s.boards[c.id].push(index);s.purchases.push(`${c.id}:${index}`);
   s.ledger.unshift({id:crypto.randomUUID(),label:`Piece #${String(index+1).padStart(2,"0")} · ${c.title}`,amount:-price,currency:"NGN",date:new Date().toISOString()});
  }else throw Error("Unsupported action.");
  await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+".tmp";await fs.writeFile(temp,JSON.stringify(s,null,2));await fs.rename(temp,file);return s;
 });queue=operation.catch(()=>undefined);
 try{return Response.json(await operation);}catch(e){return Response.json({error:e instanceof Error?e.message:"Unable to complete action"},{status:400});}
}
