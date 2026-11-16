import { supabase } from "@/lib/supabase";

export type Merchant = {user_id:string;name:string;status:"pending"|"approved"|"suspended";bank_name:string;account_name:string;account_number:string;credits:number;rate:number;minimum:number;maximum:number;online:boolean;created_at:string};
export type Trade = {id:string;buyer_id:string;merchant_id:string;merchant_name:string;buyer_name:string;amount:number;credits:number;status:"awaiting_payment"|"payment_reported"|"completed"|"cancelled"|"disputed";bank_name:string;account_name:string;account_number:string;created_at:string;expires_at:string;payment_reference?:string|null};
export type StockRequest = {id:string;merchant_id:string;merchant_name:string;credits:number;amount:number;rate:number;bank_name:string;account_name:string;account_number:string;status:"pending"|"completed"|"rejected";reference:string|null;created_at:string};
export type Audit = {id:number;actor:string;actor_name:string;action:string;subject:string;created_at:string};
export type OpsSettings = {manual_enabled:boolean;wholesale_rate:number;bank_name:string;account_name:string;account_number:string};
export type OpsData = {admin:boolean;merchant:Merchant|null;merchants:Merchant[];orders:Trade[];stock:StockRequest[];audit:Audit[];competitions:{id:string;creator_id:string;published:boolean;definition:{title?:string;joined?:number;capacity?:number;prize?:number}}[];players:{user_id:string;name:string;email:string;credits:number;earnings:number;created_at:string}[];settings:OpsSettings};
export async function operation<T=unknown>(action:string,payload:Record<string,unknown>={}) {
  const {data,error}=await supabase().rpc("ryvo_operation",{action,payload});
  if(error)throw new Error(error.code==="PGRST202"?"This workspace needs its database update. Please contact Ryvo support.":error.message);
  return data as T;
}
export const loadOperations=()=>operation<OpsData>("workspace");
const statusLabels:Record<string,string>={awaiting_payment:"Awaiting transfer",payment_reported:"Payment reported",completed:"Completed",cancelled:"Cancelled",disputed:"Needs review",pending:"Pending review",approved:"Approved",suspended:"Suspended",rejected:"Declined",published:"Published",hidden:"Hidden",online:"Online",offline:"Offline"};
export const tradeStatus=(status:string)=>statusLabels[status]??status;
