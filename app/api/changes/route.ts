import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, shuttleChanges } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";

async function actor() { const user = await getChatGPTUser(); if (!user) throw new Error("UNAUTHORIZED"); return user.email; }
const failure = (error: unknown, fallback: string) => Response.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "로그인이 필요합니다." : fallback }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });

export async function GET(request: Request) {
  try { await actor(); const date = new URL(request.url).searchParams.get("date"); const db = getDb(); const rows = date ? await db.select().from(shuttleChanges).where(eq(shuttleChanges.date,date)).orderBy(asc(shuttleChanges.createdAt)) : await db.select().from(shuttleChanges).orderBy(asc(shuttleChanges.createdAt)); return Response.json({changes:rows}); }
  catch(error){ return failure(error,"변동사항을 불러오지 못했습니다."); }
}

export async function POST(request: Request) {
  try { const email=await actor(); const payload=await request.json() as {changes?:Array<{date:string;student:string;groupName?:string;type:string;detail:string;source:string}>}; if(!payload.changes?.length)return Response.json({error:"등록할 변동사항이 없습니다."},{status:400}); const now=new Date().toISOString(); const rows=payload.changes.map(item=>({...item,id:crypto.randomUUID(),groupName:item.groupName||"미분류",confirmed:false,createdBy:email,confirmedBy:null,createdAt:now,updatedAt:now})); const db=getDb(); await db.batch([db.insert(shuttleChanges).values(rows),db.insert(auditLogs).values(rows.map(row=>({id:crypto.randomUUID(),actor:email,action:"create",entityType:"change",entityId:row.id,summary:`${row.student} ${row.date} ${row.type}`,createdAt:now})))]); return Response.json({changes:rows},{status:201}); }
  catch(error){ return failure(error,"등록하지 못했습니다."); }
}

export async function PATCH(request: Request) {
  try { const email=await actor(); const {id,confirmed}=await request.json() as {id?:string;confirmed?:boolean}; if(!id||typeof confirmed!=="boolean")return Response.json({error:"잘못된 요청입니다."},{status:400}); const now=new Date().toISOString(); const db=getDb(); await db.batch([db.update(shuttleChanges).set({confirmed,confirmedBy:confirmed?email:null,updatedAt:now}).where(eq(shuttleChanges.id,id)),db.insert(auditLogs).values({id:crypto.randomUUID(),actor:email,action:confirmed?"confirm":"unconfirm",entityType:"change",entityId:id,summary:confirmed?"변동 확인 완료":"변동 확인 취소",createdAt:now})]); return Response.json({ok:true}); }
  catch(error){ return failure(error,"수정하지 못했습니다."); }
}

export async function DELETE(request: Request) {
  try { const email=await actor(); const id=new URL(request.url).searchParams.get("id"); if(!id)return Response.json({error:"id가 필요합니다."},{status:400}); const now=new Date().toISOString(); const db=getDb(); await db.batch([db.delete(shuttleChanges).where(eq(shuttleChanges.id,id)),db.insert(auditLogs).values({id:crypto.randomUUID(),actor:email,action:"delete",entityType:"change",entityId:id,summary:"변동 삭제",createdAt:now})]); return Response.json({ok:true}); }
  catch(error){ return failure(error,"삭제하지 못했습니다."); }
}
