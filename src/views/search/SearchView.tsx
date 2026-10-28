'use client';

import { useId, useRef } from 'react';
import { ChevronLeft, MapPin, Search, X } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { styled } from 'styled-components';
import { useRouter } from 'next/navigation';

import Address from '@/components/Address';
import useSearchForm from '@/hooks/form/search/useSearchForm';
import useSearchEntryFlow from '@/hooks/search/useSearchEntryFlow';
import { bottomSheetState, SearchState } from '@/jotai/global/store';
import TravelModeSelector from './components/TravelModeSelector';

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
}

export default function SearchView({ type, shareRoomId }: SearchViewProps) {
  const router = useRouter();
  const fieldId = useId();
  const addressButtonRef = useRef<HTMLButtonElement>(null);

  const setBottomSheet = useSetAtom(bottomSheetState);

  const { register, setValue, setFocus, handleSubmit, watch, reset } =
    useSearchForm();
  const { isIndividualView, searchCount, submitSearch } = useSearchEntryFlow(
    type,
    shareRoomId,
    reset,
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
    submitSearch(searchForm);
  };

  const getTitleText = (orderNums: number) => {
    if (isIndividualView) {
      return `${numberConfig[orderNums + 1]}번째 출발지 정보를\n입력해주세요.`;
    } else {
      if (orderNums > 0) {
        return `${
          numberConfig[orderNums + 1]
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
    searchCount >= 1
      ? '등록하기'
      : `${numberConfig[searchCount + 2]}번째 출발지 추가하기`;
  const isButtonDisabled = !nameValue || !addressValue?.fullAddress;

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
        <BackButton
          type="button"
          aria-label="홈으로 돌아가기"
          onClick={() => router.push('/')}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </BackButton>
        <Title>{titleText}</Title>
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
        <SubmitButton disabled={isButtonDisabled} type="submit">
          {isIndividualView ? buttonText : '등록하기'}
        </SubmitButton>
      </Wrapper>
    </Container>
  );
}

const Container = styled.form`
  display: flex;
  flex-direction: column;
  padding: 20px 19px 28px;
  min-height: 100dvh;
  @media (max-width: 480px) and (max-height: 640px) {
    padding-top: 16px;
  }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const BackButton = styled.button`
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: 0 0 24px -10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 2px;
  }
  @media (max-width: 480px) and (max-height: 640px) {
    margin-bottom: 16px;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  white-space: pre-line;
  line-height: 43px;
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
  font-size: 14px;
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
  border: 1px solid var(--text-muted);
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    color: var(--text-muted);
    border-color: var(--border-strong);
    cursor: default;
  }
  &:hover:not(:disabled) {
    background: var(--surface-raised);
  }
  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--primary) 65%, var(--text-primary));
    outline-offset: 3px;
  }
`;
