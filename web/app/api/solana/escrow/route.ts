import { PublicKey,Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import bs58 from 'bs58';
import { requestUser,serviceClient,escrowRuntime,quoteSigner } from '@/lib/server/solana';
import { addresses,actionInstructions,decodeEscrow,depositInstruction,discriminator,orderBytes,termsHash } from '@/lib/escrow-protocol';
import type { CashoutOrder,CashoutWorkspace } from '@/lib/cashout';

export async function POST(req:Request){
 try{
  if(Number(req.headers.get('content-length')||0)>12000)return Response.json({error:'Request too large.'},{status:413});
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
  const {user,db}=await requestUser(req),body=await req.json(),admin=serviceClient();
  const {data,error}=await db.rpc('ryvo_cashout',{action:'workspace',payload:{}});if(error)throw error;
  const workspace=data as CashoutWorkspace;let order=workspace.orders.find(o=>o.id===body.id);if(!order)throw Error('Cash-out order unavailable.');
  const chain=await escrowRuntime(),a=addresses(chain.program,new PublicKey(order.user_wallet),order.id);
  if(body.action==='cancel-unfunded'){
   if(order.user_id!==user.id)throw Error('Only the player can cancel this quote.');
   const slot=await chain.connection.getSlot('finalized'),time=await chain.connection.getBlockTime(slot);
   if(!time||time<=Math.floor(Date.parse(order.expires_at)/1000)+60||await chain.connection.getAccountInfo(a.escrow,'finalized'))throw Error('The quote is still valid or has a funded escrow. It cannot be cancelled off-chain.');
   const result=await admin.rpc('ryvo_cancel_unfunded_cashout',{order_id:order.id});if(result.error)throw result.error;return Response.json({ok:true});
  }
  if(body.action==='reconcile'){
   const info=await chain.connection.getAccountInfo(a.escrow,'finalized');if(!info||!info.owner.equals(chain.program))throw Error('Escrow is not finalized on Solana yet. Try again shortly.');
   const record=await decodeEscrow(info.data);
   if(!record.orderId.equals(orderBytes(order.id))||!record.buyer.equals(new PublicKey(order.user_wallet))||!record.merchant.equals(new PublicKey(order.merchant_wallet))||!record.mint.equals(chain.mint)||record.amount!==order.amount_micro||!record.terms.equals(await termsHash(order))||!order.arbiter_wallet||!record.arbiter.equals(new PublicKey(order.arbiter_wallet)))throw Error('On-chain escrow does not match this order.');
   if(record.state<4){const vault=await chain.connection.getParsedAccountInfo(a.vault,'finalized');const token=vault.value?.data;if(!token||!('parsed' in token)||token.parsed.info.mint!==chain.mint.toBase58()||token.parsed.info.owner!==a.escrow.toBase58()||BigInt(token.parsed.info.tokenAmount.amount)<BigInt(order.amount_micro))throw Error('USDC vault balance could not be verified.');}
   const desired=record.state===0?'locked':record.state===1?'accepted':record.state===2?'paid':record.state===3?'disputed':record.state===4?'released':record.state===5?'refunded':null;if(!desired)throw Error('Unknown escrow state.');
   const instructionNames=record.state===0?['deposit']:record.state===1?['accept_payout']:record.state===2?['mark_paid']:record.state===3?['dispute']:record.state===4?['release','resolve_dispute']:['refund_timeout','resolve_dispute'];
   const signatures=body.signature?[{signature:String(body.signature)}]:await chain.connection.getSignaturesForAddress(a.escrow,{limit:25},'finalized');let verified:string|null=null;
   for(const candidate of signatures){if(!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(candidate.signature))continue;const tx=await chain.connection.getParsedTransaction(candidate.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});if(!tx||tx.meta?.err)continue;const instructions=[...tx.transaction.message.instructions,...(tx.meta?.innerInstructions??[]).flatMap(i=>i.instructions)];for(const ix of instructions){if(!ix.programId.equals(chain.program)||!('data' in ix))continue;const bytes=Buffer.from(bs58.decode(ix.data));for(const name of instructionNames){const index=name==='deposit'?4:1;if(bytes.subarray(0,8).equals(await discriminator('global',name))&&ix.accounts[index]?.equals(a.escrow)){verified=candidate.signature;break}}if(verified)break}if(verified)break}
   if(!verified)throw Error('A matching finalized escrow transaction was not found.');
   // Reconciliation must follow a confirmed deposit before later state changes.
   if(!order.deposit_signature&&desired!=='locked')throw Error('Reconcile the finalized deposit first, then the latest escrow action.');
   const settled=await admin.rpc('ryvo_reconcile_cashout',{order_id:order.id,event:desired,signature:verified});if(settled.error)throw settled.error;return Response.json({ok:true,status:desired,signature:verified});
  }
  if(body.action!=='prepare')throw Error('Invalid escrow request.');
  const kind=String(body.kind),actor=workspace.wallet?new PublicKey(workspace.wallet):null;if(!actor)throw Error('Verify your connected wallet first.');
  let txInstructions;
  if(kind==='deposit'){
   if(order.user_id!==user.id||!actor.equals(new PublicKey(order.user_wallet))||chain.config.paused)throw Error('This wallet cannot fund the order.');
   const signer=quoteSigner();if(!signer.publicKey.equals(chain.config.quoteAuthority))throw Error('Escrow quote authority mismatch.');
   if(await chain.connection.getAccountInfo(a.escrow,'finalized'))throw Error('Escrow already exists. Refresh its on-chain status instead of depositing again.');
   const source=await chain.connection.getTokenAccountBalance(getAssociatedTokenAddressSync(chain.mint,actor),'finalized');if(BigInt(source.value.amount)<BigInt(order.amount_micro))throw Error('Not enough USDC in this wallet’s associated USDC account.');
   const prepared=await admin.rpc('ryvo_prepare_cashout',{order_id:order.id,actor:user.id,arbiter:chain.config.arbiter.toBase58()});if(prepared.error)throw prepared.error;order=prepared.data as CashoutOrder;
   txInstructions=[await depositInstruction(chain.program,chain.mint,signer.publicKey,order)];
  }else{
   const buyer=order.user_id===user.id&&actor.equals(new PublicKey(order.user_wallet)),merchant=order.merchant_id===user.id&&actor.equals(new PublicKey(order.merchant_wallet));
   if(['release','refund'].includes(kind)&&!buyer)throw Error('Only the player can authorize this action.');
   if(['accept','paid'].includes(kind)&&(!merchant||workspace.merchant?.status!=='approved'))throw Error('Only the approved merchant can authorize this action.');
   if(kind.startsWith('resolve-')&&(!workspace.admin||actor.toBase58()!==order.arbiter_wallet))throw Error('Dispute resolution requires the order’s arbiter signer.');
   if(kind==='dispute'&&!buyer&&!merchant)throw Error('Only the player or merchant can dispute an order.');
   txInstructions=await actionInstructions(chain.program,chain.mint,actor,order,kind);
  }
  const block=await chain.connection.getLatestBlockhash('finalized'),transaction=new Transaction({feePayer:actor,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight}).add(...txInstructions);
  if(kind==='deposit')transaction.partialSign(quoteSigner());
  const fee=await chain.connection.getFeeForMessage(transaction.compileMessage(),'finalized');
  return Response.json({transaction:transaction.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),program:chain.program.toBase58(),mint:chain.mint.toBase58(),quoteAuthority:chain.config.quoteAuthority.toBase58(),order,block,feeLamports:fee.value},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Escrow request failed.'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
