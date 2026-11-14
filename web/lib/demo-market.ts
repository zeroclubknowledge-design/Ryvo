import { validListing, type DemoState, type PieceListing } from "@/lib/demo";
export const MARKET_KEY="ryvo-demo-piece-market-v1";
export function readMarket():PieceListing[]{try{const data=JSON.parse(localStorage.getItem(MARKET_KEY)||"[]");return Array.isArray(data)?data.filter(validListing):[]}catch{return[]}}
export function mergeMarket(state:DemoState){const own=state.listings??[],ids=new Set(own.map(l=>l.id));const next=[...own,...readMarket().filter(l=>!ids.has(l.id))].slice(0,1000);localStorage.setItem(MARKET_KEY,JSON.stringify(next));return next}
export function atomicBrowserWrite(entries:[string,string][]):void{const previous=entries.map(([key])=>[key,localStorage.getItem(key)] as const);try{for(const [key,value] of entries)localStorage.setItem(key,value)}catch{for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}}throw Error("Browser storage is full. The demo trade was not completed.")}}
