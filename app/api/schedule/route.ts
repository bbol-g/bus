import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, scheduleRides } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";

type RideInput = {
  id: string;
  bus: number;
  slot: string;
  day: string;
  time: string;
  stop: string;
  student: string;
  englishName?: string | null;
  groupName?: string;
  sourceSheet?: string;
  sourceRow?: number;
};
async function actor() {
  const user = await getChatGPTUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user.email;
}
async function importActor(request: Request) {
  const user = await getChatGPTUser();
  if (user) return user.email;
  const supplied = request.headers.get("x-shuttle-import-key");
  if (
    supplied &&
    env.SHUTTLE_IMPORT_KEY &&
    supplied === env.SHUTTLE_IMPORT_KEY
  )
    return "secure-excel-import";
  throw new Error("UNAUTHORIZED");
}
const fail = (error: unknown) =>
  Response.json(
    {
      error:
        error instanceof Error && error.message === "UNAUTHORIZED"
          ? "로그인이 필요합니다."
          : "시간표를 처리하지 못했습니다.",
    },
    {
      status:
        error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500,
    },
  );

export async function GET() {
  try {
    await actor();
    const rows = await getDb()
      .select()
      .from(scheduleRides)
      .orderBy(
        asc(scheduleRides.slot),
        asc(scheduleRides.bus),
        asc(scheduleRides.time),
      );
    return Response.json({ rides: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const email = await importActor(request);
    const payload = (await request.json()) as { rides?: RideInput[] };
    if (!payload.rides?.length)
      return Response.json(
        { error: "적용할 시간표가 없습니다." },
        { status: 400 },
      );
    if (payload.rides.length > 5000)
      return Response.json(
        { error: "시간표 행이 너무 많습니다." },
        { status: 400 },
      );
    const allowedSlots = new Set([
      "09-in",
      "15-in",
      "15-out",
      "1630-in",
      "1630-out",
      "18-out",
    ]);
    const allowedDays = new Set(["월", "화", "수", "목", "금"]);
    if (
      payload.rides.some(
        (r) =>
          !r.id ||
          !r.student ||
          !r.stop ||
          !allowedSlots.has(r.slot) ||
          !allowedDays.has(r.day) ||
          ![1, 2, 3, 5, 6].includes(Number(r.bus)),
      )
    )
      return Response.json(
        { error: "검증되지 않은 시간표 행이 있습니다." },
        { status: 400 },
      );
    const now = new Date().toISOString();
    const rows = payload.rides.map((r) => ({
      ...r,
      bus: Number(r.bus),
      englishName: r.englishName || null,
      groupName: r.groupName || "미분류",
      sourceSheet: r.sourceSheet || null,
      sourceRow: r.sourceRow || null,
      updatedAt: now,
    }));
    const db = getDb();
    await db.delete(scheduleRides);
    for (let offset = 0; offset < rows.length; offset += 50) {
      const statements = [];
      const page = rows.slice(offset, offset + 50);
      for (let i = 0; i < page.length; i += 5)
        statements.push(db.insert(scheduleRides).values(page.slice(i, i + 5)));
      await db.batch(statements);
    }
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actor: email,
      action: "replace",
      entityType: "schedule",
      entityId: "base",
      summary: `기본 시간표 ${rows.length}건 적용`,
      createdAt: now,
    });
    return Response.json({ ok: true, count: rows.length });
  } catch (error) {
    return fail(error);
  }
}
