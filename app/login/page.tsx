'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      router.replace('/');
    } else {
      const data = await res.json();
      setError(data.error ?? '오류가 발생했습니다.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-xl font-bold text-center text-gray-800">셔틀 관리 시스템</h1>
        <input
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !pw}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </main>
  );
}
