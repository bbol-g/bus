'use client';

import { useRef, useState } from 'react';
import { parseExcelFile } from '@/lib/excelParser';
import { saveBase } from '@/lib/storage';
import type { ShuttleBase } from '@/types';

interface Props {
  onUploaded: (data: ShuttleBase) => void;
}

export default function ExcelUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await parseExcelFile(file);
      saveBase(data);
      onUploaded(data);
    } catch (e) {
      console.error(e);
      setError('파일 파싱에 실패했습니다. 형식을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🚌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">셔틀버스 대시보드</h1>
        <p className="text-gray-500 mb-8 text-sm">
          기초 데이터 엑셀 파일을 업로드하면 오늘 날짜 기준으로<br />
          버스별 등하원 명단을 자동으로 표시합니다.
        </p>

        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-4 cursor-pointer transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {loading ? (
            <div className="text-blue-600 font-medium">파싱 중...</div>
          ) : (
            <>
              <div className="text-4xl mb-3">📂</div>
              <div className="text-gray-600 font-medium">클릭하거나 파일을 여기로 드래그하세요</div>
              <div className="text-gray-400 text-sm mt-1">.xlsx / .xls</div>
            </>
          )}
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-50 rounded-lg px-4 py-2 mb-2">{error}</div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}
