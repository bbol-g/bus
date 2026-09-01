'use client';

import { useRef, useState } from 'react';
import type { ShuttleBase } from '@/types';
import { actionLabel, resolveLine, type LineResult } from '@/lib/inbox';
import type { DayOverrides } from '@/lib/schedule';
import { formatDate } from '@/lib/dateUtils';

interface Props {
  data: ShuttleBase;
  allDayOverrides: DayOverrides;
  defaultDate: string; // 날짜 생략 시 적용할 날짜 (현재 보고 있는 날짜)
  onApply: (ops: LineResult['ops']) => Promise<void>;
  onOpenBulk: () => void; // 여러 줄 한번에 입력하는 모달 열기
}

export default function QuickInbox({ data, allDayOverrides, defaultDate, onApply, onOpenBulk }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<LineResult | null>(null);
  const [previewedText, setPreviewedText] = useState('');
  const [applying, setApplying] = useState(false);
  const [flash, setFlash] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const year = Number(defaultDate.slice(0, 4));

  function preview() {
    const t = text.trim();
    if (!t) { setResult(null); setPreviewedText(''); return; }
    setResult(resolveLine(t, data, allDayOverrides, year, defaultDate));
    setPreviewedText(t);
    setFlash('');
  }

  async function apply() {
    if (!result || result.ops.length === 0) return;
    setApplying(true);
    try {
      await onApply(result.ops);
      setFlash(`${result.matched.map((m) => m.name).join(', ')} · ${result.ops.length}건 적용됨`);
      setText('');
      setResult(null);
      setPreviewedText('');
      inputRef.current?.focus();
      setTimeout(() => setFlash(''), 3500);
    } finally {
      setApplying(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // 이미 같은 문장을 미리보기했고 적용할 항목이 있으면 → 적용, 아니면 미리보기
    if (result && result.ops.length > 0 && previewedText === text.trim()) apply();
    else preview();
  }

  const showResult = result && previewedText === text.trim();

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 print:hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0" title="변동사항 빠른 입력">📥</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="예: 김건우 결석  ·  이해니 9/7 개별등원  ·  박시연 9/8~9/10 결석  (날짜 생략 시 오늘 날짜)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {showResult && result && result.ops.length > 0 ? (
            <button
              onClick={apply}
              disabled={applying}
              className="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {applying ? '적용 중…' : `적용 (${result.ops.length})`}
            </button>
          ) : (
            <button
              onClick={preview}
              className="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700"
            >
              확인
            </button>
          )}
          <button
            onClick={onOpenBulk}
            className="shrink-0 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
            title="여러 줄 한번에 입력"
          >
            여러 건
          </button>
        </div>

        {flash && (
          <div className="mt-1.5 text-xs text-green-600">✅ {flash} <span className="text-gray-400">(날짜 이동 시 반영 확인)</span></div>
        )}

        {showResult && result && (
          <div className="mt-1.5 text-xs">
            {result.intent.error ? (
              <span className="text-red-600">✗ {result.intent.error}</span>
            ) : result.warning ? (
              <span className="text-amber-700">⚠️ {result.warning}</span>
            ) : (
              <span className="text-gray-600">
                <b className="text-gray-800">{result.matched.map((m) => `${m.name}(${m.bus})`).join(', ')}</b>
                {' · '}{actionLabel(result.intent.action, result.intent.direction)}
                {' · '}
                {result.ops.map((op) => `${formatDate(op.date)}`).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                {' · 총 '}{result.ops.length}건
                <span className="text-gray-400"> — Enter 한 번 더로 적용</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
