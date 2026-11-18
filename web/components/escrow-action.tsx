"use client";
import { useState } from 'react';
import { useWallet,useConnection } from '@solana/wallet-adapter-react';
import { PublicKey,Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { supabase } from '@/lib/supabase';
import { actionInstructions,depositInstruction } from '@/lib/escrow-protocol';
import { USDC_MINT } from '@/lib/solana-config';
import type { CashoutOrder } from '@/lib/cashout';
export function EscrowAction({order,kind,label,onDone}:{order:CashoutOrder;kind:string;label:string;onDone:()=>void}){
 const {publicKey,signTransaction}=useWallet(),{connection}=useConnection();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[stage,setStage]=useState('');
 const run=async()=>{setBusy(true);setError('');try{const {data}=await supabase().auth.getSession();if(!data.session)throw Error('Sign in first.');const post=async(body:Record<string,unknown>)=>{const response=await fetch('/api/solana/escrow',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session!.access_token}`},body:JSON.stringify({id:order.id,...body})});const result=await response.json();if(!response.ok)throw Error(result.error);return result};
 if(kind==='reconcile'||kind==='cancel-unfunded'){setStage('Checking Solana…');await post({action:kind});onDone();return}
 if(!publicKey||!signTransaction)throw Error('Connect a wallet that can sign Solana transactions.');setStage('Preparing escrow transaction…');const plan=await post({action:'prepare',kind}),program=new PublicKey(plan.program),mint=new PublicKey(plan.mint);if(plan.program!==process.env.NEXT_PUBLIC_SOLANA_ESCROW_PROGRAM_ID||plan.mint!==USDC_MINT)throw Error('The escrow program or USDC mint does not match this app.');
 for(const key of ['id','user_wallet','merchant_wallet','amount_micro','payout_minor','currency','country','bank_name','account_name','account_number'] as const)if(plan.order[key]!==order[key])throw Error('The signed quote differs from the order you reviewed.');
 const expectedInstructions=kind==='deposit'?[await depositInstruction(program,mint,new PublicKey(plan.quoteAuthority),plan.order)]:await actionInstructions(program,mint,publicKey,order,kind);
 const expected=new Transaction({feePayer:publicKey,blockhash:plan.block.blockhash,lastValidBlockHeight:plan.block.lastValidBlockHeight}).add(...expectedInstructions),prepared=Transaction.from(Buffer.from(plan.transaction,'base64'));
 if(!expected.serializeMessage().equals(prepared.serializeMessage())||!prepared.verifySignatures(false))throw Error('The escrow transaction failed validation.');
 setStage('Review USDC, SOL fees and rent in your wallet…');const signed=await signTransaction(prepared);setStage('Submitting to Solana…');const signature=await connection.sendRawTransaction(signed.serialize());setStage('Waiting for final confirmation…');const confirmation=await connection.confirmTransaction({...plan.block,signature},'finalized');if(confirmation.value.err)throw Error('Solana rejected the transaction. Your order has not been marked complete.');await post({action:'reconcile',signature});onDone();
 }catch(e){setError(e instanceof Error?e.message:'Escrow action failed. Refresh its status before retrying.')}finally{setBusy(false);setStage('')}};
 return <div className="escrow-action"><button className={kind==='reconcile'?'secondary':'primary'} disabled={busy} onClick={()=>void run()}>{busy?stage:label}</button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
