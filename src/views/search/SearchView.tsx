'use client';

import PageHeader from '@/components/PageHeader';

import { useId, useRef } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { styled } from 'styled-components';
import { useRouter } from 'next/navigation';

import Address from '@/components/Address';
import useSearchForm from '@/hooks/form/search/useSearchForm';
import useSearchEntryFlow from '@/hooks/search/useSearchEntryFlow';
import { bottomSheetState, SearchState } from '@/jotai/global/store';
import TravelModeSelector from './components/TravelModeSelector';
import { meetingDestinationState } from '@/jotai/meeting/store';
import { roomState } from '@/jotai/global/room';
import { searchState } from '@/jotai/global/store';
import { useInputStatusListQuery } from '@/hooks/query/search';
import MeetingDestinationField from './components/MeetingDestinationField';

const numberConfig: { [key: number]: string } = {
  1: '첫',
  2: '두',
  3: '세',
  4: '네',
  5: '다섯',
  6: '여섯',
  7: '일곱',
  8: '여덟',
  9: '아홉',
  10: '열',
};

interface SearchViewProps {
  type: 'individual' | 'together';
  shareRoomId: string | null;
  destinationMode?: boolean;
}

export default function SearchView({
  type,
  shareRoomId,
  destinationMode = false,
}: SearchViewProps) {
  const router = useRouter();
  const fieldId = useId();
  const addressButtonRef = useRef<HTMLButtonElement>(null);

  const setBottomSheet = useSetAtom(bottomSheetState);
  const draftDestination = useAtomValue(meetingDestinationState);
  const room = useAtomValue(roomState);
  const list = useAtomValue(searchState);
  const targetRoomId =
    type === 'together' && !destinationMode
      ? shareRoomId || (list.length > 0 ? room.roomId : '')
      : '';
  const { data: roomStatus } = useInputStatusListQuery(targetRoomId);
  const destination = targetRoomId
    ? roomStatus?.meeting_destination
    : destinationMode
      ? draftDestination
      : null;

  const { register, setValue, setFocus, handleSubmit, watch, reset } =
    useSearchForm();
  const { isIndividualView, searchCount, submitSearch, isSubmitting } =
    useSearchEntryFlow(
      type,
      shareRoomId,
      reset,
      destination ?? undefined,
      destinationMode,
    );

  const handleSearchAddressBtnClick = () => {
    setBottomSheet(prevState => ({
      ...prevState,
      isOpen: true,
      contents: <Address setValue={setValue} />,
      isFullContents: true,
    }));
  };

  const handleSearchBtnClick = (searchForm: SearchState) => {
    if (destinationMode && !destination) return;
    if (targetRoomId && !roomStatus) return;
    submitSearch(searchForm);
  };

  const getTitleText = (orderNums: number) => {
    if (isIndividualView) {
      return `${numberConfig[orderNums + 1] ?? orderNums + 1}번째 출발지 정보를\n입력해주세요.`;
    } else {
      if (orderNums > 0) {
        return `${
          numberConfig[orderNums + 1] ?? orderNums + 1
        }번째 출발지 정보를\n입력해주세요.`;
      } else {
        return '먼저 자신의 출발지 정보를\n입력해주세요.';
      }
    }
  };

  const addressValue = watch('address');
  const nameValue = watch('name');
  const titleText = getTitleText(searchCount);
  const buttonText =
    destination || searchCount >= 1
      ? '등록하기'
      : `${numberConfig[searchCount + 2]}번째 출발지 추가하기`;
  const isButtonDisabled =
    !nameValue ||
    !addressValue?.fullAddress ||
    (destinationMode && !destination) ||
    Boolean(targetRoomId && !roomStatus);

  const handleClearName = () => {
    setValue('name', '', { shouldDirty: true });
    setFocus('name');
  };

  const handleClearAddress = () => {
    setValue('address', {
      fullAddress: '',
      regionName: '',
      latitude: 0,
      longitude: 0,
    });
    addressButtonRef.current?.focus();
  };

  return (
    <Container onSubmit={handleSubmit(handleSearchBtnClick)}>
      <Wrapper>
        <PageHeader onBack={() => router.push('/')} />
        <Title>{titleText}</Title>
        {destination && <MeetingDestinationField destination={destination} />}
        {destinationMode && !destination && (
          <p className="mt-4 text-base">
            모임 장소를 먼저 선택해주세요.{' '}
            <button
              type="button"
              className="underline min-h-11"
              onClick={() => router.push('/meeting')}
            >
              장소 선택하기
            </button>
          </p>
        )}
        {targetRoomId && !roomStatus && (
          <p role="status" className="mt-4 text-base">
            모임 정보를 불러오는 중이에요. 계속 표시되면 초대 링크를
            확인해주세요.
          </p>
        )}
        <Section>
          <Field>
            <FieldLabel htmlFor={`${fieldId}-name`}>이름</FieldLabel>
            <FieldControl>
              <NameInput
                id={`${fieldId}-name`}
                type="text"
                placeholder="이름을 입력해주세요."
                maxLength={5}
                autoComplete="off"
                {...register('name')}
                value={nameValue}
              />
              {nameValue && (
                <ClearButton
                  type="button"
                  aria-label="이름 지우기"
                  onClick={handleClearName}
                >
                  <X size={18} aria-hidden="true" />
                </ClearButton>
              )}
            </FieldControl>
          </Field>
          <Field>
            <FieldLabel
              id={`${fieldId}-address-label`}
              htmlFor={`${fieldId}-address`}
            >
              출발지
            </FieldLabel>
            <FieldControl>
              <AddressButton
                ref={addressButtonRef}
                id={`${fieldId}-address`}
                type="button"
                aria-labelledby={`${fieldId}-address-label ${fieldId}-address-value`}
                onClick={handleSearchAddressBtnClick}
              >
                <MapPin size={20} aria-hidden="true" />
                <AddressValue
                  id={`${fieldId}-address-value`}
                  $placeholder={!addressValue?.regionName}
                >
                  {addressValue?.regionName || '출발지를 입력해주세요.'}
                </AddressValue>
                <Search size={20} aria-hidden="true" />
              </AddressButton>
              {addressValue?.fullAddress && (
                <ClearButton
                  type="button"
                  aria-label="출발지 지우기"
                  onClick={handleClearAddress}
                >
                  <X size={18} aria-hidden="true" />
                </ClearButton>
              )}
            </FieldControl>
          </Field>
          <TravelModeSelector
            value={watch('travelMode') ?? 'transit'}
            onChange={mode =>
              setValue('travelMode', mode, { shouldDirty: true })
            }
          />
        </Section>
        <SubmitButton
          disabled={isButtonDisabled || isSubmitting}
          aria-busy={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? '등록 중…'
            : isIndividualView
              ? buttonText
              : '등록하기'}
        </SubmitButton>
      </Wrapper>
    </Container>
  );
}

const Container = styled.form`
  display: flex;
  flex-direction: column;
  padding: max(12px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  min-height: 100dvh;
  @media (max-width: 480px) and (max-height: 640px) {
    padding-top: max(12px, env(safe-area-inset-top));
  }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const Title = styled.h1`
  margin-top: 24px;
  font-size: 28px;
  font-weight: 700;
  white-space: pre-line;
  line-height: 1.45;
  @media (max-width: 359px) {
    font-size: 24px;
    line-height: 1.5;
  }
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin: 26px 0 32px;
  @media (max-width: 480px) and (max-height: 640px) {
    gap: 16px;
    margin: 20px 0 24px;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldLabel = styled.label`
  color: var(--text-secondary);
  font-size: var(--font-label);
  font-weight: 600;
`;

const FieldControl = styled.div`
  display: flex;
  align-items: center;
  min-height: 52px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--surface-muted);

  &:focus-within {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;

const NameInput = styled.input`
  min-width: 0;
  width: 100%;
  height: 50px;
  padding: 0 14px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  caret-color: var(--primary);
  font-size: 16px;
  &[type='text'] {
    transform: none;
  }
  &::placeholder {
    color: color-mix(in srgb, var(--text-muted) 75%, var(--text-primary));
  }
`;

const ClearButton = styled.button`
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 44px;
  margin-right: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  &:hover {
    color: var(--text-primary);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: -2px;
  }
`;

const AddressButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
  min-height: 50px;
  padding: 0 14px;
  border: 0;
  outline: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  svg {
    flex-shrink: 0;
  }
`;

const AddressValue = styled.span<{ $placeholder: boolean }>`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $placeholder }) =>
    $placeholder
      ? 'color-mix(in srgb, var(--text-muted) 75%, var(--text-primary))'
      : 'var(--text-primary)'};
  font-size: 16px;
`;

const SubmitButton = styled.button`
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--primary);
  color: var(--button-text-on-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    color: var(--text-muted);
    background: transparent;
    border-color: var(--border-strong);
    cursor: default;
  }
  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;
