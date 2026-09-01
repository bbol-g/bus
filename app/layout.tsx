import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"셔틀 운행 대시보드", description:"요일·시간대·차량별 운행표와 특정 날짜 변동사항을 확인하는 학원 셔틀 대시보드", icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){ return <html lang="ko"><body>{children}</body></html>; }
