import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '셔틀버스 대시보드',
  description: '학원 셔틀버스 등하원 명단 관리',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
