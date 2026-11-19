export const SOLANA_NETWORK=process.env.NEXT_PUBLIC_SOLANA_NETWORK==='devnet'?'devnet':'mainnet-beta';
export const USDC_MINT=SOLANA_NETWORK==='devnet'?'4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU':'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOLANA_RPC=process.env.NEXT_PUBLIC_SOLANA_RPC_URL||(SOLANA_NETWORK==='devnet'?'https://api.devnet.solana.com':'https://api.mainnet-beta.solana.com');
export const USDC_SCALE=1_000_000;
/** Ryvo's treasury wallet receives launch fees and entry payments (public address). */
export const TREASURY_ADDRESS=process.env.NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS||'BrPs45Ds29TisK7weQHZoXcZAVVPmViEPddA8s1PSPU2';
export const countries=[{code:'NG',name:'Nigeria',currency:'NGN'},{code:'GH',name:'Ghana',currency:'GHS'},{code:'KE',name:'Kenya',currency:'KES'},{code:'ZA',name:'South Africa',currency:'ZAR'},{code:'UG',name:'Uganda',currency:'UGX'},{code:'TZ',name:'Tanzania',currency:'TZS'},{code:'GB',name:'United Kingdom',currency:'GBP'},{code:'US',name:'United States',currency:'USD'},{code:'CA',name:'Canada',currency:'CAD'},{code:'DE',name:'Germany',currency:'EUR'},{code:'FR',name:'France',currency:'EUR'}] as const;
export function parseUsdc(value:string){
 if(!/^\d{1,9}(\.\d{1,6})?$/.test(value))throw Error('Enter a USDC amount with up to six decimal places.');
 const [whole,fraction='']=value.split('.');const micro=Number(whole)*USDC_SCALE+Number(fraction.padEnd(6,'0'));
 if(!Number.isSafeInteger(micro)||micro<=0||micro>1_000_000_000_000)throw Error('Enter a USDC amount greater than zero and no more than 1,000,000.');return micro;
}
export function usdc(micro:number){return `${(micro/USDC_SCALE).toLocaleString('en-US',{maximumFractionDigits:6})} USDC`}
export const currencyDigits=(currency:string)=>new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;
export function localMoney(minor:number,currency:string){return new Intl.NumberFormat('en',{style:'currency',currency}).format(minor/10**currencyDigits(currency))}
export const shortAddress=(address:string)=>`${address.slice(0,4)}…${address.slice(-4)}`;
