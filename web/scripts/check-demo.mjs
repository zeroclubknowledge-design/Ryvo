import assert from 'node:assert/strict';
import {initialState,applyDemoAction,allCompetitions,oneMonthAfter,fragmentLayout,isDemoState,settleDemoWithdrawals} from '../lib/demo.ts';
import {drawCopy,pieceDrawPrice} from '../lib/piece-inventory.ts';
const base=process.env.RYVO_TEST_URL||'http://localhost:3000';
const read=async()=>{const r=await fetch(base+'/api/demo');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);return r.json()};
const seed=await read(),original=structuredClone(seed);
const post=async(body,state=seed,headers={})=>{const r=await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({state,...body})});const data=await r.json();if(r.ok)assert.ok(isDemoState(data),`Invalid response for ${body.action}`);return {status:r.status,body:data}};
const joined=await post({action:'join',id:'harbour-lights'},seed,{Origin:new URL(base).origin});assert.equal(joined.status,200);
assert.equal(joined.body.cash,99000);assert.equal(joined.body.balance,seed.balance+10000);assert.deepEqual(joined.body.boards['harbour-lights'],[]);
assert.ok(joined.body.ledger.some(t=>t.currency==='NGN'&&t.amount===-1000));assert.ok(joined.body.ledger.some(t=>t.currency==='RYVO'&&t.amount===10000));
assert.equal((await post({action:'join',id:'harbour-lights'},joined.body)).status,400);
assert.equal((await post({action:'join',id:'harbour-lights'},{...seed,cash:999})).status,400);
assert.equal((await post({action:'join',id:'harbour-lights'},{...seed,balance:0})).status,200,'Entry uses naira, not an existing RYVO balance');
for(const action of ['buy-draw','redeem-universal'])assert.equal((await post({action,id:'harbour-lights',payload:{requestId:'waiting-test-order-1'}},joined.body)).status,400);
const filled=await post({action:'fill-demo-registration'},joined.body);assert.equal(filled.body.rounds['harbour-lights'].status,'active');assert.equal(filled.body.rounds['paper-lanterns'].status,'open');
assert.equal((await post({action:'buy',id:'night-bloom',index:3})).status,400,'No unlimited sample sellers');
assert.equal((await post({action:'join',id:'harbour-lights'},null)).status,400);assert.equal((await post({action:'join',id:'harbour-lights'},seed,{Origin:'https://untrusted.example'})).status,403);
const [a,b]=await Promise.all([post({action:'join',id:'harbour-lights'}),post({action:'join',id:'harbour-lights'})]);assert.equal(a.body.cash,99000);assert.equal(b.body.cash,99000);assert.deepEqual(seed,original);assert.deepEqual(await read(),seed);
for(let total=10;total<=50;total++){assert.equal(Array.from({length:total},(_,i)=>pieceDrawPrice(10000,total,i)).reduce((a,b)=>a+b),10000);assert.equal(fragmentLayout(total).length,total)}
assert.equal(pieceDrawPrice(10000,20,0),500);assert.equal(drawCopy([2,0,1],()=>2),2);assert.equal(drawCopy([2,0,1],()=>1),0);assert.throws(()=>drawCopy([0,0],()=>0));assert.throws(()=>drawCopy([-1,2],()=>0));
console.log('Passed: naira registration issues equivalent RYVO once, empty starting inventory, registration lock, queue advancement, exact draw pricing and finite-stock selection.');

const bank={bank:'Demo Bank',accountNumber:'0123456789',accountName:'Demo Tester'};
assert.equal((await post({action:'save-bank',payload:{...bank,accountNumber:'123'}})).status,400);
const bankSaved=await post({action:'save-bank',payload:bank});assert.equal(bankSaved.status,200);assert.deepEqual(bankSaved.body.bank,bank);
const funded=await post({action:'fund',payload:{merchantId:'lime-desk',amount:1000,orderId:'test-funding-order-1'}});
assert.equal(funded.status,200);assert.equal(funded.body.cash,99000);assert.equal(funded.body.balance,seed.balance+12000);assert.equal(funded.body.fundingOrders.length,1);
const fundingRetry=await post({action:'fund',payload:{merchantId:'lime-desk',amount:1000,orderId:'test-funding-order-1'}},funded.body);assert.equal(fundingRetry.status,200);assert.deepEqual(fundingRetry.body,funded.body);
assert.equal((await post({action:'fund',payload:{merchantId:'missing',amount:1000,orderId:'invalid-merchant'}})).status,400);
assert.equal((await post({action:'fund',payload:{merchantId:'lime-desk',amount:100000,orderId:'invalid-limit'}})).status,400);
assert.equal((await post({action:'fund',payload:{merchantId:'lime-desk',amount:1000,orderId:'low-balance-test'}},{...seed,cash:100})).status,400);
assert.equal((await post({action:'withdraw',payload:{amount:1000,requestId:'no-bank-request'}})).status,400);
assert.equal((await post({action:'withdraw',payload:{amount:8000,requestId:'too-much-request'}},bankSaved.body)).status,400);
assert.equal((await post({action:'withdraw',payload:{amount:0,requestId:'zero-request-test'}},bankSaved.body)).status,400);
const withdrawing=await post({action:'withdraw',payload:{amount:1000,requestId:'test-withdrawal-1'}},bankSaved.body);
assert.equal(withdrawing.status,200);assert.equal(withdrawing.body.earnings,6500);assert.equal(withdrawing.body.cash,seed.cash);assert.equal(withdrawing.body.balance,seed.balance);assert.equal(withdrawing.body.withdrawals[0].status,'pending');assert.deepEqual(withdrawing.body.withdrawals[0].bank,bank);
const retry=await post({action:'withdraw',payload:{amount:1000,requestId:'test-withdrawal-1'}},withdrawing.body);assert.equal(retry.status,200);assert.deepEqual(retry.body,withdrawing.body);
assert.equal((await post({action:'withdraw',payload:{amount:500,requestId:'another-withdrawal'}},withdrawing.body)).status,400);
assert.equal((await post({action:'save-bank',payload:{...bank,accountName:'Another Tester'}},withdrawing.body)).status,400);
const beforeDue=await post({action:'settle'},withdrawing.body);assert.equal(beforeDue.body.withdrawals[0].status,'pending');
const due=structuredClone(withdrawing.body);due.withdrawals[0].readyAt=new Date(Date.now()-1000).toISOString();
const settled=await post({action:'settle'},due);assert.equal(settled.status,200);assert.equal(settled.body.withdrawals[0].status,'completed');assert.equal(settled.body.earnings,6500);assert.equal(settled.body.ledger.length,due.ledger.length);
const legacy=structuredClone(seed);for(const key of ['walletVersion','earnings','bank','withdrawals','fundingOrders'])delete legacy[key];
const migrated=await post({action:'settle'},legacy);assert.equal(migrated.status,200);assert.equal(migrated.body.earnings,7500);assert.equal(migrated.body.cash,seed.cash);assert.deepEqual(migrated.body.boards,seed.boards);
const migratedAgain=await post({action:'settle'},migrated.body);assert.deepEqual(migratedAgain.body,migrated.body,'Migration must not reissue demo earnings');
for(const route of ['/','/discover','/how-it-works','/ryvo-credit','/onboarding','/explore','/boards','/wallet','/wallet/p2p','/notifications','/profile','/referrals','/signup','/signin','/create','/board/night-bloom','/collection/harbour-lights','/collection/night-bloom','/collection/salt-flats','/collection/paper-lanterns'])assert.equal((await fetch(base+route)).status,200,route);
assert.equal((await fetch(base+'/marketplace')).status,404,'Standalone marketplace was removed');
console.log('Passed: funding, bank validation, withdrawals, account isolation, migration and all application routes.');

const swapped=await post({action:'swap',payload:{amount:1100,requestId:'swap-order-test-1'}});assert.equal(swapped.status,200);assert.equal(swapped.body.balance,seed.balance-1100);assert.equal(swapped.body.earnings,seed.earnings+100);assert.equal(swapped.body.cash,seed.cash);assert.ok(swapped.body.ledger.some(t=>t.currency==='RYVO'&&t.amount===-1100));
assert.deepEqual((await post({action:'swap',payload:{amount:1100,requestId:'swap-order-test-1'}},swapped.body)).body,swapped.body);
for(const amount of [100,99,-110,111,20000,110.5])assert.equal((await post({action:'swap',payload:{amount,requestId:'invalid-swap-order'}})).status,400);
const sold=await post({action:'sell',payload:{amount:12000,merchantId:'lime-desk',requestId:'sell-order-test-1'}});assert.equal(sold.status,200);assert.equal(sold.body.balance,seed.balance-12000);assert.equal(sold.body.earnings,seed.earnings+1000);assert.equal(sold.body.cash,seed.cash);
assert.deepEqual((await post({action:'sell',payload:{amount:12000,merchantId:'lime-desk',requestId:'sell-order-test-1'}},sold.body)).body,sold.body);
for(const payload of [{amount:12000,merchantId:'missing'},{amount:12001,merchantId:'lime-desk'},{amount:12,merchantId:'lime-desk'},{amount:24000,merchantId:'lime-desk'}])assert.equal((await post({action:'sell',payload:{...payload,requestId:'invalid-sale-order'}})).status,400);
const saleBank=await post({action:'save-bank',payload:bank},sold.body);const saleWithdrawal=await post({action:'withdraw',payload:{amount:8500,requestId:'sale-withdrawal-test'}},saleBank.body);assert.equal(saleWithdrawal.status,200);assert.equal(saleWithdrawal.body.earnings,0);

console.log('Passed: swap fees, historical merchant-sale compatibility, fractional naira earnings and withdrawal protection.');

const seller=settleDemoWithdrawals({...structuredClone(seed),ownerId:'seller-account'});
seller.inventory['night-bloom'][0]++;seller.pieceSupply['night-bloom'].remaining[0]--;
const listed=await post({action:'list-piece',id:'night-bloom',index:0,payload:{price:1000,requestId:'copy-listing-order-1',ownerName:'Seller'}},seller);
assert.equal(listed.status,200);assert.equal(listed.body.inventory['night-bloom'][0],1);assert.ok(listed.body.boards['night-bloom'].includes(0),'Listing an extra must keep the board slot filled');assert.equal(listed.body.listings[0].currency,'RYVO');
assert.deepEqual((await post({action:'list-piece',id:'night-bloom',index:0,payload:{price:1000,requestId:'copy-listing-order-1',ownerName:'Seller'}},listed.body)).body,listed.body);
const secondListing=await post({action:'list-piece',id:'night-bloom',index:0,payload:{price:500,requestId:'copy-listing-order-2',ownerName:'Seller'}},listed.body);assert.equal(secondListing.status,200);assert.ok(!secondListing.body.boards['night-bloom'].includes(0));
const cancelled=await post({action:'cancel-listing',payload:{listingId:'copy-listing-order-2'}},secondListing.body);assert.equal(cancelled.body.inventory['night-bloom'][0],1);assert.ok(cancelled.body.boards['night-bloom'].includes(0));assert.ok(isDemoState(cancelled.body));
for(const price of [0,-1,1000001,500.5])assert.equal((await post({action:'list-piece',id:'night-bloom',index:0,payload:{price,requestId:'invalid-copy-price',ownerName:'Seller'}},seller)).status,400);
assert.equal((await post({action:'buy-listing',payload:listed.body.listings[0]},listed.body)).status,400);
const buyer={...structuredClone(seed),ownerId:'buyer-account'};
const acquired=await post({action:'buy-listing',payload:listed.body.listings[0]},buyer);assert.equal(acquired.status,200);assert.equal(acquired.body.balance,buyer.balance-1000);assert.equal(acquired.body.cash,buyer.cash);assert.equal(acquired.body.inventory['night-bloom'][0],2,'Buying an owned type must add a duplicate');
assert.deepEqual((await post({action:'buy-listing',payload:listed.body.listings[0]},acquired.body)).body,acquired.body);
const soldPiece=await post({action:'settle-sale',payload:{listingId:'copy-listing-order-1',buyerId:'buyer-account'}},listed.body);assert.equal(soldPiece.status,200);assert.equal(soldPiece.body.earnings,seller.earnings+99.5);assert.deepEqual((await post({action:'settle-sale',payload:{listingId:'copy-listing-order-1',buyerId:'buyer-account'}},soldPiece.body)).body,soldPiece.body);
assert.equal((await post({action:'cancel-listing',payload:{listingId:'copy-listing-order-1'}},soldPiece.body)).status,400);
const legacySeller=structuredClone(listed.body);legacySeller.listings[0].currency='NGN';
const legacyBuyer=await post({action:'buy-listing',payload:legacySeller.listings[0]},buyer);assert.equal(legacyBuyer.status,200);assert.equal(legacyBuyer.body.cash,buyer.cash-1000);
console.log('Passed: duplicate trading, last-copy removal, multiple listings of one type, cancellation, credit-priced purchases, naira fee settlement, legacy listings and retry protection.');

const forced=settleDemoWithdrawals(seed);forced.pieceSupply['night-bloom'].remaining.fill(0);forced.pieceSupply['night-bloom'].remaining[0]=3;
const revealed=await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'duplicate-universal-1'}},forced);assert.equal(revealed.status,200);assert.equal(revealed.body.inventory['night-bloom'][0],2);assert.equal(revealed.body.boards['night-bloom'].length,seed.boards['night-bloom'].length);assert.equal(revealed.body.universal,0);assert.equal(revealed.body.pieceSupply['night-bloom'].remaining[0],2);assert.equal(revealed.body.balance,seed.balance);assert.equal(revealed.body.cash,seed.cash);
assert.deepEqual((await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'duplicate-universal-1'}},revealed.body)).body,revealed.body);
assert.equal((await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'duplicate-universal-2'}},revealed.body)).status,400);
const paid=await post({action:'buy-draw',id:'night-bloom',payload:{requestId:'paid-random-draw-1'}},forced);assert.equal(paid.status,200);assert.equal(paid.body.balance,seed.balance-pieceDrawPrice(20000,12,0));assert.equal(paid.body.inventory['night-bloom'][0],2);assert.equal(paid.body.drawCounts['night-bloom'],1);
assert.deepEqual((await post({action:'buy-draw',id:'night-bloom',payload:{requestId:'paid-random-draw-1'}},paid.body)).body,paid.body);
const noStock=structuredClone(forced);noStock.pieceSupply['night-bloom'].remaining.fill(0);assert.equal((await post({action:'buy-draw',id:'night-bloom',payload:{requestId:'empty-stock-order-1'}},noStock)).status,400);assert.equal((await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'empty-stock-order-2'}},noStock)).status,400);
for(const requestId of [undefined,'short','x'.repeat(81)])assert.equal((await post({action:'buy-draw',id:'night-bloom',payload:{requestId}})).status,400);
const nearlyDone=settleDemoWithdrawals(seed);nearlyDone.boards['night-bloom']=Array.from({length:12},(_,i)=>i).filter(i=>i!==7);nearlyDone.inventory['night-bloom']=Array(12).fill(1);nearlyDone.inventory['night-bloom'][7]=0;nearlyDone.pieceSupply['night-bloom'].remaining.fill(0);nearlyDone.pieceSupply['night-bloom'].remaining[7]=1;
const win=await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'first-winning-draw'}},nearlyDone);assert.equal(win.status,200);assert.equal(win.body.boards['night-bloom'].length,12);assert.equal(win.body.finishers['night-bloom'].length,1);assert.equal(win.body.earnings,seed.earnings+2400);assert.equal(allCompetitions(win.body).find(c=>c.id==='night-bloom').remaining,7);
assert.deepEqual((await post({action:'redeem-universal',id:'night-bloom',payload:{requestId:'first-winning-draw'}},win.body)).body,win.body);
console.log('Passed: paid and gifted random draws allow duplicates, consume finite supply, preserve unique progress, reject depleted supply and award an idempotent demo prize.');

const launchPayload={title:'Test Round',description:'An uploaded artwork for a new competition.',artist:'Demo Creator',total:13,capacity:2,winners:1,fee:1000,creatorShare:5,artworkKey:'asset-11111111-1111-1111-1111-111111111111',coverKey:'asset-22222222-2222-2222-2222-222222222222',requestId:'33333333-3333-3333-3333-333333333333'};
const launched=await post({action:'launch',payload:launchPayload});assert.equal(launched.status,200);assert.equal(launched.body.cash,99950);assert.equal(launched.body.createdCompetitions.length,1);assert.equal(launched.body.createdCompetitions[0].launchFee,50);const gameId=launched.body.createdCompetitions[0].id;assert.equal(launched.body.rounds[gameId].status,'upcoming');
assert.deepEqual((await post({action:'launch',payload:launchPayload},launched.body)).body,launched.body);
const higherShare=await post({action:'launch',payload:{...launchPayload,creatorShare:10}});assert.equal(higherShare.body.cash,99900);
for(const change of [{total:9},{total:51},{total:12.5},{capacity:1},{winners:3},{creatorShare:7},{fee:999},{artworkKey:'invalid'}])assert.equal((await post({action:'launch',payload:{...launchPayload,...change}})).status,400);
assert.equal((await post({action:'launch',payload:launchPayload},{...seed,cash:49})).status,400);
assert.equal((await post({action:'join',id:gameId},launched.body)).status,400,'Queued games cannot be joined');
const advance1=await post({action:'fill-demo-registration'},launched.body);assert.equal(advance1.body.rounds['harbour-lights'].status,'active');assert.equal(advance1.body.rounds['paper-lanterns'].status,'open');
const advance2=await post({action:'fill-demo-registration'},advance1.body);assert.equal(advance2.body.rounds[gameId].status,'open');assert.equal(advance2.body.rounds[gameId].startedAt,undefined);
const customJoin=await post({action:'join',id:gameId},advance2.body);assert.equal(customJoin.status,200);assert.equal(customJoin.body.rounds[gameId].joined,1);
const live=await post({action:'fill-demo-registration'},customJoin.body);assert.equal(live.body.rounds[gameId].status,'active');assert.equal(live.body.rounds[gameId].endsAt,oneMonthAfter(live.body.rounds[gameId].startedAt));

const customDraw=await post({action:'buy-draw',id:gameId,payload:{requestId:'custom-piece-draw'}},live.body);assert.equal(customDraw.status,200);assert.equal(customDraw.body.balance,live.body.balance-pieceDrawPrice(10000,13,0));
const closing=structuredClone(live.body);closing.boards[gameId]=Array.from({length:12},(_,i)=>i);closing.inventory[gameId]=Array(13).fill(1);closing.inventory[gameId][12]=0;closing.pieceSupply[gameId].remaining.fill(0);closing.pieceSupply[gameId].remaining[12]=1;
const finalWinner=await post({action:'redeem-universal',id:gameId,payload:{requestId:'last-winner-slot'}},closing);assert.equal(finalWinner.status,200);assert.equal(finalWinner.body.rounds[gameId].status,'ended');assert.equal(finalWinner.body.finishers[gameId][0].reward,400);assert.equal(allCompetitions(finalWinner.body).find(c=>c.id===gameId).remaining,0);
assert.equal((await post({action:'buy-draw',id:gameId,payload:{requestId:'closed-winner-round'}},finalWinner.body)).status,400);
const expired=structuredClone(live.body);expired.rounds[gameId].startedAt='2020-01-31T12:00:00.000Z';expired.rounds[gameId].endsAt='2020-02-29T12:00:00.000Z';assert.equal((await post({action:'buy-draw',id:gameId,payload:{requestId:'expired-piece-draw'}},expired)).status,400);
assert.equal(oneMonthAfter('2026-01-31T12:34:00.000Z'),'2026-02-28T12:34:00.000Z');assert.equal(oneMonthAfter('2028-01-31T12:34:00.000Z'),'2028-02-29T12:34:00.000Z');
let example={...structuredClone(initialState),ownerId:'example-player',boards:{},balance:0};
example=applyDemoAction(example,'launch',undefined,undefined,{...launchPayload,total:20,capacity:100,winners:2,requestId:'example-100-player-round'});
const exampleId=example.createdCompetitions[0].id;
example=applyDemoAction(example,'fill-demo-registration');example=applyDemoAction(example,'fill-demo-registration');example=applyDemoAction(example,'join',exampleId);assert.equal(example.balance,10000);assert.equal(example.pieceSupply[exampleId].remaining.reduce((a,b)=>a+b),2000);
example=applyDemoAction(example,'fill-demo-registration');
for(let i=0;i<20;i++)example=applyDemoAction(example,'buy-draw',exampleId,undefined,{requestId:`example-paid-draw-${i}`});
assert.equal(example.balance,0);assert.equal(example.inventory[exampleId].reduce((a,b)=>a+b),20);assert.equal(example.pieceSupply[exampleId].remaining.reduce((a,b)=>a+b),1980);assert.ok(isDemoState(example));
const stock=Array(20).fill(100),distributed=Array(20).fill(0);for(let i=0;i<2000;i++){const index=drawCopy(stock,()=>0);stock[index]--;distributed[index]++}assert.deepEqual(distributed,Array(20).fill(100));assert.throws(()=>drawCopy(stock,()=>0));
const bad=structuredClone(example);bad.inventory[exampleId][0]=-1;assert.equal(isDemoState(bad),false);const badStock=structuredClone(example);badStock.pieceSupply[exampleId].remaining[0]=101;assert.equal(isDemoState(badStock),false);
console.log('Passed: creator launch rules, queue ordering, one-month expiry, first-completion prize settlement, winner-limit closure, 100x20 supply and exactly 10,000 r/ for 20 paid draws.');

// Existing local accounts reserve their copies once before new shared draws.
const {hydrateWorld,worldSnapshot,WORLD_KEY}=await import('../lib/demo-world.ts');
const storedWallets=new Map([
 ['ryvo-account-wallet:legacy-a',JSON.stringify({...structuredClone(initialState),ownerId:'legacy-a'})],
 ['ryvo-account-wallet:legacy-b',JSON.stringify({...structuredClone(initialState),ownerId:'legacy-b'})]
]);
globalThis.localStorage={get length(){return storedWallets.size},key:index=>[...storedWallets.keys()][index]??null,getItem:key=>storedWallets.get(key)??null};
const fresh={...structuredClone(initialState),ownerId:'new-player',boards:{}};
const migratedWorld=hydrateWorld(fresh),legacyGame=allCompetitions(fresh).find(game=>game.id==='night-bloom');
for(const slot of initialState.boards['night-bloom'])assert.equal(migratedWorld.pieceSupply['night-bloom'].remaining[slot],legacyGame.capacity-2);
storedWallets.set(WORLD_KEY,worldSnapshot(migratedWorld));
assert.deepEqual(hydrateWorld(migratedWorld).pieceSupply,migratedWorld.pieceSupply,'Shared legacy copies must not be reserved twice');
delete globalThis.localStorage;
console.log('Passed: all existing local wallets reserve legacy copies once in the shared finite supply.');
