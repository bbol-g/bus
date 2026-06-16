import { NextRequest, NextResponse } from 'next/server';
import { createAuthToken } from '@/lib/auth';

const PASSWORD = process.env.ACCESS_PASSWORD!;
const COOKIE = 'bus_auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== PASSWORD) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createAuthToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
  return res;
}
