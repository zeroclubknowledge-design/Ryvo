import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RyvoApp } from "@/components/ryvo-app";
import { competitions } from "@/lib/demo";
export function generateStaticParams(){return competitions.map(c=>({id:c.id}));}
async function Board({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!competitions.some(c=>c.id===id)&&!/^custom-[a-z0-9-]{10,80}$/.test(id))notFound();
 return <RyvoApp initialView="boards" collectionId={id} boardView/>;
}
export default function Page(props:{params:Promise<{id:string}>}){return <Suspense fallback={<p>Opening your board…</p>}><Board {...props}/></Suspense>;}
