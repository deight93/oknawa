'use client';

import { Input } from '@nextui-org/react';
import { MouseEvent } from 'react';
import { useSetAtom } from 'jotai';
import { styled } from 'styled-components';
import { useRouter } from 'next/navigation';

import Address from '@/components/Address';
import useSearchForm from '@/hooks/form/search/useSearchForm';
import useSearchEntryFlow from '@/hooks/search/useSearchEntryFlow';
import { bottomSheetState, SearchState } from '@/jotai/global/store';
import Button from '@/components/Button';
import { ArrowBackIcon } from '@/assets/icons/ArrowBack';

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

  const setBottomSheet = useSetAtom(bottomSheetState);

  const { register, setValue, handleSubmit, watch, reset } = useSearchForm();
  const { isIndividualView, searchCount, submitSearch } = useSearchEntryFlow(
    type,
    shareRoomId,
    reset,
  );

  const handleSearchAddressBtnClick = (
    index: number,
    e: MouseEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    setBottomSheet(prevState => ({
      ...prevState,
      isOpen: true,
      contents: <Address setValue={setValue} currentIndex={index} />,
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

  const handleClearAddress = () =>
    setValue('address', {
      fullAddress: '',
      regionName: '',
      latitude: 0,
      longitude: 0,
    });

  return (
    <Container onSubmit={handleSubmit(handleSearchBtnClick)}>
      <Wrapper>
        <IconBox onClick={() => router.push('/')}>
          <ArrowBackIcon />
        </IconBox>
        <TitleBox>
          <Title>{titleText}</Title>
        </TitleBox>
        <Section>
          <Input
            isClearable
            placeholder="이름을 입력해주세요."
            size="sm"
            maxLength={5}
            {...register('name')}
            onClear={() => setValue('name', '')}
            value={nameValue}
          />
          <ClickableArea
            onClick={e => handleSearchAddressBtnClick(searchCount, e)}
          >
            <Input
              isClearable
              placeholder="출발지를 입력해주세요."
              size="sm"
              isReadOnly
              value={addressValue?.regionName || ''}
              onClear={handleClearAddress}
            />
          </ClickableArea>
        </Section>
        {isIndividualView ? (
          <Button
            label={buttonText}
            disabled={isButtonDisabled}
            type="submit"
            $widthFull
          />
        ) : (
          <Button
            label="등록하기"
            type="submit"
            disabled={isButtonDisabled}
            $widthFull
          />
        )}
      </Wrapper>
    </Container>
  );
}

const Container = styled.form`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 35px 19px 20px;
  min-height: 100dvh;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding-bottom: 120px;
`;

const IconBox = styled.div`
  width: 50px;
  margin-bottom: 20px;
  cursor: pointer;
`;

const TitleBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  margin-bottom: 16px;
  font-size: 28px;
  font-weight: 700;
  white-space: pre-line;
  line-height: 43px;
`;

const Section = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 30px;
`;

const ClickableArea = styled.div`
  width: 100%;
`;
