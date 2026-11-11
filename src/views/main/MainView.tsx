'use client';

import styled, { keyframes } from 'styled-components';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';

import PageHeader from '@/components/PageHeader';

import SearchTypeSelector from '@/components/SearchTypeSelector';
import { PeopleIcon } from '@/assets/icons/People';
import { PlusIcon } from '@/assets/icons/Plus';
import { searchState } from '@/jotai/global/store';
import { meetingDestinationState } from '@/jotai/meeting/store';

export default function MainView() {
  const [, setSearchList] = useAtom(searchState);
  const [, setDestination] = useAtom(meetingDestinationState);

  useEffect(() => {
    setSearchList([]);
    setDestination(null);
  }, [setSearchList, setDestination]);

  return (
    <Container>
      <PageHeader />
      <Introduction>
        <IllustrationScene aria-hidden="true">
          <MeetingIllustration
            src="/images/meeting-friends.webp"
            alt=""
            width={680}
            height={340}
            sizes="(max-width: 378px) calc(100vw - 40px), 340px"
            priority
          />
        </IllustrationScene>
        <Title>
          <span>우리,</span>
          <span>
            <em>어디서</em> 만날까요?
          </span>
        </Title>
        <Description>
          각자의 출발지로 중간지점을 찾고,
          <br />
          만나기 편한 약속장소를 정해보세요.
        </Description>
      </Introduction>
      <EntrySection>
        <SectionLabel>중간지점 찾기</SectionLabel>
        <SearchTypeSelectorBox aria-label="출발지 입력 방식">
          <SearchTypeSelector
            type="individual"
            icon={<PlusIcon width="42" height="42" />}
          />
          <SearchTypeSelector
            type="together"
            icon={<PeopleIcon width="42" height="42" />}
          />
        </SearchTypeSelectorBox>
        <DestinationEntry href="/meeting">
          <MapPin size={24} aria-hidden="true" />
          <span>
            <strong>정해진 장소로 모이기</strong>
            <small>약속 장소까지 이동시간을 확인해요</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </DestinationEntry>
      </EntrySection>
      <Guide aria-labelledby="meeting-guide-title">
        <h2 id="meeting-guide-title">약속장소 정하기, 이렇게 해보세요</h2>
        <p>
          사는 곳이 다른 친구들과 만날 때, 오케이나와에서 각자의 이동시간을
          비교해보세요. 회원가입 없이 중간지점을 찾을 수 있어요.
        </p>
        <ol>
          <li>
            <strong>출발지를 입력해요</strong>
            <p>한 사람이 직접 입력하거나, 모임 링크를 공유해 각자 입력해요.</p>
          </li>
          <li>
            <strong>이동시간을 비교해요</strong>
            <p>
              참가자마다 대중교통·자동차·도보를 선택하고, 추천 장소까지 걸리는
              시간을 확인해요.
            </p>
          </li>
          <li>
            <strong>만날 장소를 함께 골라요</strong>
            <p>
              추천 후보에 투표해 약속장소를 확정하고, 주변 카페나 식당을
              찾아봐요.
            </p>
          </li>
        </ol>
        <h2>중간지점 찾기, 궁금한 점</h2>
        <details>
          <summary>지도에서 딱 가운데인 곳을 추천하나요?</summary>
          <p>
            위치 기준과 이동시간 기준 중에서 선택할 수 있어요. 이동시간 기준은
            각자의 교통수단으로 걸리는 시간을 비교해 만날 후보 장소를 추천해요.
          </p>
        </details>
        <details>
          <summary>이미 약속장소를 정했다면요?</summary>
          <p>
            ‘정해진 장소로 모이기’에서 목적지를 먼저 선택하세요. 각 출발지에서
            그 장소까지의 예상 이동시간과 경로를 확인할 수 있어요.
          </p>
        </details>
        <details>
          <summary>이동시간은 실제와 같나요?</summary>
          <p>
            경로 제공사의 예상 시간이며, 출발 시각과 교통 상황에 따라 달라질 수
            있어요. 출발 전 카카오맵 길찾기로 다시 확인해주세요.
          </p>
        </details>
      </Guide>
      <Footer>오케이나와 · OKNAWA</Footer>
    </Container>
  );
}

const enter = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
`;

const arrive = keyframes`
  0% { opacity: 0; transform: translateY(24px) scale(0.94); }
  70% { opacity: 1; transform: translateY(-8px) scale(1.015); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

const ripple = keyframes`
  from { opacity: 0.65; transform: translateX(-50%) scale(0.6); }
  to { opacity: 0; transform: translateX(-50%) scale(2.2); }
`;

const Container = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: max(12px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  min-height: 100dvh;

  @media (max-width: 500px) and (max-height: 640px) {
    gap: 24px;
    padding-top: max(12px, env(safe-area-inset-top));
  }
`;

const Introduction = styled.header`
  margin-top: clamp(0px, 3vh, 24px);
  width: 100%;
  text-align: center;
`;

const IllustrationScene = styled.div`
  position: relative;
  width: min(100%, clamp(224px, 40dvh, 340px));
  margin: 0 auto 12px;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 2%;
    width: 64px;
    height: 20px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    &::after {
      animation: ${ripple} 1.4s ease-out 0.7s 2;
    }
  }

  @media (max-width: 500px) and (max-height: 640px) {
    margin-bottom: 16px;
  }
`;

const MeetingIllustration = styled(Image)`
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: auto;

  @media (prefers-reduced-motion: no-preference) {
    animation:
      ${arrive} 700ms cubic-bezier(0.22, 1, 0.36, 1) both,
      ${float} 1.8s ease-in-out 700ms 2;
  }
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  white-space: pre-line;
  line-height: 43px;

  > span {
    display: block;
  }

  em {
    color: var(--primary);
    color: color-mix(in srgb, var(--primary) 70%, var(--text-primary));
    font-style: normal;
  }

  @media (prefers-reduced-motion: no-preference) {
    > span {
      animation: ${enter} 600ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;
    }
    > span:last-child {
      animation-delay: 180ms;
    }
  }

  @media (max-width: 500px) and (max-height: 640px) {
    font-size: 30px;
    line-height: 40px;
  }
`;

const Description = styled.p`
  margin-top: 12px;
  color: var(--text-secondary);
  color: color-mix(in srgb, var(--text-muted) 85%, var(--text-primary));
  font-size: var(--font-body);
  line-height: 1.6;
  word-break: keep-all;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${enter} 600ms cubic-bezier(0.22, 1, 0.36, 1) 240ms both;
  }
`;

const SearchTypeSelectorBox = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  max-width: 324px;
  gap: 20px;

  @media (prefers-reduced-motion: no-preference) {
    > a {
      animation: ${enter} 600ms cubic-bezier(0.22, 1, 0.36, 1) 300ms backwards;
    }
    > a:last-child {
      animation-delay: 380ms;
    }
  }

  @media (max-width: 359px) {
    gap: 16px;
  }
`;

const EntrySection = styled.section`
  width: 100%;
  max-width: 324px;
`;
const SectionLabel = styled.h2`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${enter} 600ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both;
  }
`;
const DestinationEntry = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 18px 0 4px;
  border-top: 1px solid var(--border-strong);
  min-height: 82px;
  color: var(--text-primary);
  > svg {
    flex-shrink: 0;
    transition: transform 180ms ease;
  }
  > svg:first-child {
    color: var(--primary);
  }
  > span {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 18px;
    line-height: 1.5;
    font-weight: 600;
    word-break: keep-all;
  }
  small {
    display: block;
    margin-top: 4px;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    word-break: keep-all;
  }
  &:hover {
    background: var(--surface-muted);
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${enter} 600ms cubic-bezier(0.22, 1, 0.36, 1) 440ms backwards;
    transition:
      transform 160ms ease,
      background-color 160ms ease;

    &:active {
      transform: scale(0.98);
    }

    &:hover > svg:last-child,
    &:focus-visible > svg:last-child {
      transform: translateX(4px);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
  }
`;
const Guide = styled.section`
  width: 100%;
  max-width: 324px;
  margin-top: 20px;
  padding-top: 28px;
  border-top: 1px solid var(--border-strong);
  font-size: var(--font-body);
  line-height: 1.7;
  word-break: keep-all;
  overflow-wrap: anywhere;

  h2 {
    margin-bottom: 12px;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.5;
    text-wrap: balance;
  }
  p {
    color: var(--text-secondary);
  }
  ol {
    margin: 24px 0 36px;
    padding-left: 22px;
  }
  li + li {
    margin-top: 20px;
  }
  li p {
    margin-top: 4px;
  }
  strong {
    font-weight: 600;
  }
  details {
    border-bottom: 1px solid var(--border);
  }
  summary {
    padding: 16px 0;
    cursor: pointer;
    font-weight: 600;
    &:hover {
      color: var(--primary);
    }
    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }
  }
  details p {
    padding-bottom: 20px;
  }
`;

const Footer = styled.footer`
  color: var(--text-secondary);
  font-size: var(--font-caption);
`;
