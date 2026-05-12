'use client';

import { useEffect } from 'react';
import { getApiErrorMessage } from '@/api/errors';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('errrrrrrooror', error);
  }, [error]);
  return (
    <div>
      <h1>에러 발생</h1>
      <p>{getApiErrorMessage(error, '결과 화면을 불러오지 못했습니다.')}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
