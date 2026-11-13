import { applyDemoAction, initialState, isDemoState } from "@/lib/demo";

// Stateless demo operations work in read-only, serverless deployments.
// Each browser owns its test wallet; no real funds or server files are involved.
const headers = { "Cache-Control": "no-store" };

export async function GET() {
 return Response.json(structuredClone(initialState), { headers });
}

export async function POST(req: Request) {
 const origin = req.headers.get("origin");
 if (origin) {
  try {
   const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || new URL(req.url).host;
   if (new URL(origin).host !== host) return Response.json({error:"Origin not allowed"}, {status:403, headers});
  } catch {
   return Response.json({error:"Invalid origin"}, {status:403, headers});
  }
 }
 const raw = await req.text();
 if (raw.length > 128000) return Response.json({error:"Demo wallet data is too large."}, {status:413, headers});
 let body;
 try { body = JSON.parse(raw); } catch { return Response.json({error:"Invalid request."}, {status:400, headers}); }
 if (!body || typeof body.action !== "string") return Response.json({error:"Invalid action."}, {status:400, headers});
 if (!isDemoState(body.state)) return Response.json({error:"Please reload to initialize your demo wallet."}, {status:400, headers});
 try {
  return Response.json(applyDemoAction(body.state, body.action, body.id, body.index), {headers});
 } catch (error) {
  return Response.json({error:error instanceof Error ? error.message : "Unable to complete this demo payment."}, {status:400, headers});
 }
}
