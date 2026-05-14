'use client';

import { useEffect, useState } from 'react';
import type { ShuttleBase } from '@/types';
import { loadBase } from '@/lib/storage';
import ExcelUploader from '@/components/ExcelUploader';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const [data, setData] = useState<ShuttleBase | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const base = loadBase();
    setData(base);
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!data) {
    return <ExcelUploader onUploaded={(d) => setData(d)} />;
  }

  return <Dashboard data={data} onReupload={(d) => setData(d)} />;
}
