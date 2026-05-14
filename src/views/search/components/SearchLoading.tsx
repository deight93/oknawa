'use client';

import { useEffect, useState } from 'react';
import styled from 'styled-components';

type SearchLoadingPhase = 'generating' | 'fetching';

interface SearchLoadingProps {
  phase?: SearchLoadingPhase;
}

const GENERATING_STEPS = [
  '후보 역을 고르는 중',
  '경로와 환승 정보를 계산 중',
  '추천 결과를 정리 중',
];

const FETCHING_STEP = '결과 화면을 준비 중';

export default function SearchLoading({
  phase = 'generating',
}: SearchLoadingProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const steps =
    phase === 'fetching'
      ? [...GENERATING_STEPS, FETCHING_STEP]
      : GENERATING_STEPS;
  const displayStepIndex =
    phase === 'fetching' ? steps.length - 1 : activeStepIndex;

  useEffect(() => {
    if (phase === 'fetching') return;

    const intervalId = window.setInterval(() => {
      setActiveStepIndex(
        prevIndex => (prevIndex + 1) % GENERATING_STEPS.length,
      );
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [phase]);

  return (
    <Container>
      <Wrapper>
        <Image src="/loading.gif" width={148} height={148} alt="loading" />
        <Text>
          가장 만나기 편한 <br /> 장소를 찾고 있어요
        </Text>
        <StepList>
          {steps.map((step, index) => (
            <StepItem key={step} $isActive={index === displayStepIndex}>
              <StepDot $isActive={index <= displayStepIndex} />
              {step}
            </StepItem>
          ))}
        </StepList>
      </Wrapper>
    </Container>
  );
}

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  z-index: 9999;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(320px, calc(100vw - 48px));
  padding: 32px 24px;
  border: 1px solid #20d86d;
  border-radius: 16px;
  background-color: #151518;
`;

const Image = styled.img`
  margin-bottom: 24px;
  border-radius: 24px;
`;

const Text = styled.p`
  color: #f4f4f5;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.45;
  text-align: center;
`;

const StepList = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
  margin-top: 22px;
`;

const StepItem = styled.div<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ $isActive }) => ($isActive ? '#f4f4f5' : '#777780')};
  font-size: 13px;
  font-weight: ${({ $isActive }) => ($isActive ? 800 : 600)};
`;

const StepDot = styled.span<{ $isActive: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background-color: ${({ $isActive }) => ($isActive ? '#18c964' : '#34343a')};
`;
