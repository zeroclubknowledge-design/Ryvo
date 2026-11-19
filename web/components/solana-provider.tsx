"use client";
import { ConnectionProvider,WalletProvider,useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { Menu } from '@base-ui/react/menu';
import { useEffect,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { shortAddress,SOLANA_NETWORK,SOLANA_RPC } from '@/lib/solana-config';
import { Icon } from '@/components/collection-art';

const adapters:[]=[];
export function SolanaProvider({children}:{children:ReactNode}){return <ConnectionProvider endpoint={SOLANA_RPC}><WalletProvider wallets={adapters} autoConnect localStorageKey="ryvo-wallet">{children}</WalletProvider></ConnectionProvider>}
export function ConnectWallet({compact=false,signIn=false,next='/explore'}:{compact?:boolean;signIn?:boolean;next?:string}){
 const {wallets,select,wallet,publicKey,connected,connecting,connect,disconnect,signMessage}=useWallet();
 const [requested,setRequested]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 useEffect(()=>{if(!requested||!wallet)return;let active=true;void connect().then(()=>{if(active)setRequested(false)}).catch(e=>{if(active){setRequested(false);setError(e instanceof Error?e.message:'Wallet connection was declined.')}});return()=>{active=false}},[wallet,requested,connect]);
 const authenticate=async()=>{if(!publicKey||!signMessage)return;setBusy(true);setError('');try{const {error}=await supabase().auth.signInWithWeb3({chain:'solana',wallet:{publicKey,signMessage},statement:'Sign in to Ryvo. This signature does not transfer funds.'});if(error)throw error;router.push(next);router.refresh()}catch(e){setError(e instanceof Error?e.message:'Wallet sign-in is not available. Please check that Solana sign-in is enabled.')}finally{setBusy(false)}};
 const ready=wallets.filter(w=>w.readyState===WalletReadyState.Installed||w.readyState===WalletReadyState.Loadable);
 return <div className={`solana-connect ${compact?'compact':''}`}><Menu.Root><Menu.Trigger className="wallet-connect-button" disabled={connecting||busy} aria-label={connected?'Connected wallet options':'Connect Solana wallet'}><Icon name="wallet" size={17}/><span>{connecting?'Connecting…':connected&&publicKey?shortAddress(publicKey.toBase58()):'Connect wallet'}</span></Menu.Trigger><Menu.Portal><Menu.Positioner className="ryvo-select-positioner" align="end" sideOffset={12}><Menu.Popup className="solana-wallet-menu"><strong>{connected?'Your Solana wallet':'Choose your wallet'}</strong>{connected?<><p>{publicKey?.toBase58()}</p><Menu.Item className="solana-wallet-option" onClick={()=>void disconnect()}>Disconnect wallet</Menu.Item></>:ready.length?ready.map(item=><Menu.Item key={item.adapter.name} className="solana-wallet-option" onClick={()=>{setError('');select(item.adapter.name);setRequested(true)}}>{item.adapter.name}<Icon name="arrow" size={15}/></Menu.Item>):<div className="solana-wallet-help"><p>No compatible wallet was detected. Open Ryvo inside your wallet’s browser, or install a Solana wallet.</p><a href="https://phantom.com/download" target="_blank" rel="noreferrer">Get Phantom ↗</a><a href="https://solflare.com/download" target="_blank" rel="noreferrer">Get Solflare ↗</a></div>}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>{signIn&&connected&&<button className="primary wallet-authenticate" disabled={busy||!signMessage} onClick={authenticate}>{busy?'Check your wallet…':'Sign in with this wallet'}<Icon name="arrow" size={17}/></button>}{signIn&&connected&&!signMessage&&<p>This wallet does not support sign-in messages. Choose another wallet.</p>}{error&&<p className="wallet-connect-error" role="alert">{error}</p>}</div>;
}
/** Balances come from /api/solana/balances: Solana's public RPC rejects browser-origin requests. */
export type SolanaBalances={address:string;sol:number;usdcMicro:number;solUsd:number|null};
export function useSolanaBalances(){
 const {publicKey}=useWallet();const [balances,setBalances]=useState<SolanaBalances|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!publicKey)return;let active=true;const address=publicKey.toBase58();
  const load=async()=>{if(active)setLoading(true);try{const response=await fetch(`/api/solana/balances?address=${encodeURIComponent(address)}`,{cache:'no-store'});const body=await response.json();if(!response.ok)throw Error(body.error);if(active){setBalances(body as SolanaBalances);setError('')}}catch(e){if(active)setError(e instanceof Error&&e.message?e.message:'Unable to read this wallet right now.')}finally{if(active)setLoading(false)}};
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);return()=>{active=false;clearInterval(timer)}},[publicKey,revision]);
 const current=publicKey&&balances?.address===publicKey.toBase58()?balances:null;
 return {balances:current,error:publicKey?error:'',loading:Boolean(publicKey)&&!current&&!error&&loading,refresh:()=>setRevision(v=>v+1),network:SOLANA_NETWORK};
}
