import { OperationsApp } from "@/components/operations-app";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RyvoLoadingScreen } from "@/components/ryvo-loading-screen";
const sections=['merchants','orders','stock','competitions','economy','p2p','players','audit','settings'];
export function generateStaticParams(){return sections.map(section=>({section}))}
async function Workspace({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return <OperationsApp portal="admin" section={section}/>}
export default function Page(props:{params:Promise<{section:string}>}){return <Suspense fallback={<RyvoLoadingScreen label="Opening control room"/>}><Workspace {...props}/></Suspense>}
