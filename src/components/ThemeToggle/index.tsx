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
  display: inline-flex;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  &:hover {
    background: var(--surface-muted);
  }
`;
