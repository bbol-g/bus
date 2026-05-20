import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.ACCESS_PASSWORD!;
const COOKIE = 'bus_auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, PASSWORD, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
  return res;
}
