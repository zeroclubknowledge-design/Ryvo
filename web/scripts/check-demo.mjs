import assert from 'node:assert/strict';
const base = process.env.RYVO_TEST_URL || 'http://localhost:3000';
const read=async()=>{const r=await fetch(`${base}/api/demo`);assert.equal(r.status,200);return r.json()};
const post=async(body,headers={})=>{const r=await fetch(`${base}/api/demo`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
const before=await read();
assert.ok(Number.isInteger(before.balance)&&before.balance>=0);
assert.ok(Number.isInteger(before.cash)&&before.cash>=0);
for(const [body,expected] of [[{},400],[{action:'unknown'},400],[{action:'join',id:'salt-flats'},400],[{action:'buy',id:'night-bloom',index:0},400],[{action:'buy',id:'night-bloom',index:-1},400],[{action:'buy',id:'night-bloom',index:99},400]]){assert.equal((await post(body)).status,expected)}
assert.equal((await post({action:'join',id:'harbour-lights'},{Origin:'https://untrusted.example'})).status,403);
if(before.boards['harbour-lights'])assert.equal((await post({action:'join',id:'harbour-lights'})).status,400);
const results=await Promise.all(Array.from({length:5},()=>post({action:'buy',id:'night-bloom',index:0})));
assert.ok(results.every(r=>r.status===400));
assert.deepEqual(await read(),before,'Rejected requests must never mutate balances, boards or ledger');
for(const route of ['/','/boards','/marketplace','/wallet','/referrals','/board/night-bloom'])assert.equal((await fetch(base+route)).status,200,route);
console.log('Passed: state shape, invalid actions, duplicate ownership, invalid indexes, closed registration, cross-origin guard, concurrent rejection, ledger integrity, and all main routes.');
