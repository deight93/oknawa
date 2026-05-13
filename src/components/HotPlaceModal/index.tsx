import { Chip } from '@nextui-org/react';
import { useQueryClient } from '@tanstack/react-query';
import { useResetAtom } from 'jotai/utils';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import styled from 'styled-components';

import { CafeIcon } from '@/assets/icons/Cafe';
import { DrinkIcon } from '@/assets/icons/Drink';
import { RestaurantIcon } from '@/assets/icons/Restaurant';
import useModal from '@/hooks/common/useModal';
import { useConfirmHotPlaceMutation } from '@/hooks/mutation/hot-place';
import { useHotPlaceQuery } from '@/hooks/query/hot-place';
import { modalState } from '@/jotai/global/store';
import { HotPlace, HotPlaceCategory } from '@/services/hot-place/types';
import PlaceItem from './PlaceItem';
import { HotPlaceConfirmConfig } from './types';

interface HotPlaceModalProps {
  x: number;
  y: number;
  confirmConfig?: HotPlaceConfirmConfig;
}

const HOT_PLACE_CATEGORY: { title: string; category: HotPlaceCategory }[] = [
  { title: '맛집', category: 'food' },
  { title: '카페', category: 'cafe' },
  { title: '술집', category: 'drink' },
];

const categoryIcons: Record<HotPlaceCategory, JSX.Element> = {
  food: <RestaurantIcon />,
  cafe: <CafeIcon color="black" />,
  drink: <DrinkIcon color="black" />,
};

export default function HotPlaceModal({
  x,
  y,
  confirmConfig,
}: HotPlaceModalProps) {
  const [category, setCategory] = useState<HotPlaceCategory>('food');
  const [confirmingPlaceId, setConfirmingPlaceId] = useState('');
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const resetModal = useResetAtom(modalState);
  const { setModalContents } = useModal();
  const { mutate: confirmHotPlace } = useConfirmHotPlaceMutation();

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useHotPlaceQuery(category, { x, y });

  const allPlaces = data?.pages.flatMap(page => page.documents) ?? [];

  useEffect(() => {
    const target = loaderRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];

        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 300px',
        threshold: 0.1,
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const confirmPlace = (place: HotPlace) => {
    if (!confirmConfig) {
      return;
    }

    resetModal();
    setConfirmingPlaceId(place.id);
    confirmHotPlace(
      {
        ...confirmConfig,
        category,
        place,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ['confirmedHotPlace', confirmConfig.shareKey],
          });
          toast.success('최종 장소가 확정되었습니다.');
        },
        onError: () => {
          toast.error('최종 장소 확정에 실패했습니다.');
        },
        onSettled: () => {
          setConfirmingPlaceId('');
        },
      },
    );
  };

  const requestConfirmPlace = (place: HotPlace) => {
    setModalContents({
      buttonLabel: '취소',
      buttonLabel02: '확정하기',
      contents: `${place.place_name}을 최종 장소로 확정할까요?`,
      onConfirm: () => confirmPlace(place),
    });
  };

  return (
    <Container>
      <Contents>
        <Category>
          {HOT_PLACE_CATEGORY.map(c => {
            const isSelected = c.category === category;
            return (
              <Chip
                key={c.category}
                color={isSelected ? 'success' : 'default'}
                onClick={() => setCategory(c.category)}
              >
                <ChipItem>
                  {categoryIcons[c.category]}
                  {c.title}
                </ChipItem>
              </Chip>
            );
          })}
        </Category>
        {allPlaces.map(place => (
          <PlaceItem
            key={place.id}
            place={place}
            isConfirming={confirmingPlaceId === place.id}
            onConfirmPlace={
              confirmConfig ? () => requestConfirmPlace(place) : undefined
            }
          />
        ))}
      </Contents>
      <div ref={loaderRef} style={{ height: '10px' }} />
    </Container>
  );
}

const Container = styled.div``;

const Contents = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Category = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
`;

const ChipItem = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
`;
