'use client';

import { useEffect, useState } from 'react';
import type { ShuttleBase } from '@/types';
import ExcelUploader from '@/components/ExcelUploader';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const [data, setData] = useState<ShuttleBase | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/data')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ShuttleBase | null) => {
        setData(d);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">불러오는 중...</div>
      </div>
    );
  }

  if (!data) {
    return <ExcelUploader onUploaded={(d) => setData(d)} />;
  }

  return <Dashboard data={data} onReupload={(d) => setData(d)} />;
}
