import { escrowRuntime,quoteSigner } from '@/lib/server/solana';
import { SOLANA_NETWORK } from '@/lib/solana-config';
let cached:{expires:number;ready:boolean}|null=null;
export async function GET(){if(!cached||cached.expires<Date.now()){let ready=false;try{if(process.env.SUPABASE_SERVICE_ROLE_KEY){const runtime=await escrowRuntime();ready=!runtime.config.paused&&quoteSigner().publicKey.equals(runtime.config.quoteAuthority)}}catch{}cached={expires:Date.now()+15000,ready}}return Response.json({ready:cached.ready,network:SOLANA_NETWORK,walletLinking:!!process.env.SUPABASE_SERVICE_ROLE_KEY},{headers:{'Cache-Control':'no-store'}})}
