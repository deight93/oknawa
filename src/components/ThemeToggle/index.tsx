'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isLight = isMounted && resolvedTheme === 'light';

  return (
    <ToggleButton
      type="button"
      aria-label={isLight ? '다크 모드로 변경' : '라이트 모드로 변경'}
      title={isLight ? '다크 모드' : '라이트 모드'}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
    >
      {isLight ? <Moon size={18} /> : <Sun size={18} />}
    </ToggleButton>
  );
}

const ToggleButton = styled.button`
  position: fixed;
  top: 16px;
  right: max(16px, calc((100vw - 500px) / 2 + 16px));
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  background-color: var(--surface);
  color: var(--text-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 100000000;
`;
