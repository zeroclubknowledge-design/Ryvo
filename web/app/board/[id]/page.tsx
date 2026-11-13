import { RyvoApp } from "@/components/ryvo-app";
import { competitions } from "@/lib/demo";
import { notFound } from "next/navigation";
import { Suspense } from "react";
export function generateStaticParams(){return competitions.map(c=>({id:c.id}));}
async function Board({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!competitions.some(c=>c.id===id))notFound();return <RyvoApp initialView="boards" boardId={id}/>;}
export default function Page(props:{params:Promise<{id:string}>}){return <Suspense fallback={<p>Opening your board…</p>}><Board {...props}/></Suspense>;}
