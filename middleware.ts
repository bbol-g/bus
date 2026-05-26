import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';

const PASSWORD = process.env.ACCESS_PASSWORD;
const COOKIE = 'bus_auth';

export async function middleware(req: NextRequest) {
  // 비밀번호 미설정 시 보호 비활성화 (로컬 개발 환경)
  if (!PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // 로그인 페이지 자체는 항상 허용
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  // 쿠키 확인
  const cookie = req.cookies.get(COOKIE);
  if (cookie?.value && await verifyAuthToken(cookie.value, PASSWORD)) return NextResponse.next();

  // 미인증 → 로그인 페이지로
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
