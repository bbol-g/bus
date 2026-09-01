'use client';

import { useState } from 'react';
import type { ShuttleBase } from '@/types';
import { actionLabel, resolveInbox, type LineResult, type PlanOp } from '@/lib/inbox';
import type { DayOverrides } from '@/lib/schedule';
import { formatDate } from '@/lib/dateUtils';

interface Props {
  data: ShuttleBase;
  allDayOverrides: DayOverrides;
  year: number;
  onClose: () => void;
  onApply: (ops: PlanOp[]) => Promise<void>;
}

const PLACEHOLDER = `예시)
오전유치부 김건우 9/1~9/3 결석
오후유치부 이해니 9/7 개별등원
박시연 9/8, 9/10 개별하원`;

export default function InboxModal({ data, allDayOverrides, year, onClose, onApply }: Props) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<LineResult[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const allOps: PlanOp[] = results ? results.flatMap((r) => r.ops) : [];
  const hasProblems = results ? results.some((r) => r.intent.error || r.warning) : false;

  function preview() {
    setDone(false);
    setResults(resolveInbox(text, data, allDayOverrides, year));
  }

  async function apply() {
    if (allOps.length === 0) return;
    setApplying(true);
    try {
      await onApply(allOps);
      setDone(true);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto print:hidden" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">📥 인박스 — 문장으로 변경 적용</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            한 줄에 하나씩. <b>이름 + 날짜 + 동작</b>(결석 / 개별등원 / 개별하원)을 적으면 됩니다. 날짜는 <code>9/1</code>, <code>9/1~9/3</code>, <code>9/1, 9/7</code> 형식.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={6}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <button onClick={preview} className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700">미리보기</button>
            {results && allOps.length > 0 && !done && (
              <button onClick={apply} disabled={applying} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {applying ? '적용 중…' : `적용 (${allOps.length}건)`}
              </button>
            )}
          </div>

          {done && (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2">
              ✅ {allOps.length}건 적용 완료. 날짜를 이동하면 반영된 내용을 확인할 수 있습니다.
            </div>
          )}

          {results && (
            <div className="space-y-3 max-h-[45vh] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`rounded-lg border p-3 ${r.intent.error ? 'border-red-200 bg-red-50' : r.warning ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="text-xs text-gray-500 mb-1">{r.intent.raw}</div>
                  {r.intent.error ? (
                    <div className="text-sm text-red-600">✗ {r.intent.error}</div>
                  ) : r.warning ? (
                    <div className="text-sm text-amber-700">⚠️ {r.warning}</div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-gray-800 mb-1">
                        {r.matched.map((m) => `${m.name}(${m.bus})`).join(', ')} · {actionLabel(r.intent.action, r.intent.direction)} · {r.ops.length}건
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.ops.map((op, j) => (
                          <span key={j} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {formatDate(op.date)} · {op.section}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {hasProblems && allOps.length > 0 && (
                <p className="text-xs text-gray-400">문제 있는 줄은 건너뛰고 정상 항목만 적용됩니다.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
