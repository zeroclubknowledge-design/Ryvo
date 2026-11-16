export async function POST() {
 return Response.json({error:"This endpoint is no longer available. Payments and game transactions must be verified by the server."},{status:410,headers:{"Cache-Control":"no-store"}});
}
