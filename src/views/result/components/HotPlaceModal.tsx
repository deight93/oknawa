import { Chip } from '@nextui-org/react';
import styled from 'styled-components';
// import { useAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';

import PlaceItem from './PlaceItem';

import { useHotPlaceQuery } from '@/hooks/query/hot-place';

import { HotPlaceCategory } from '@/services/hot-place/types';
import { DistanceSummaryItem } from '@/types/location';

// import { resultState } from '@/jotai/result/store';

import { RestaurantIcon } from '@/assets/icons/Restaurant';
import { CafeIcon } from '@/assets/icons/Cafe';
import { DrinkIcon } from '@/assets/icons/Drink';

const HOT_PLACE_CATEGORY: { title: string; category: HotPlaceCategory }[] = [
  { title: '맛집', category: 'food' },
  { title: '카페', category: 'cafe' },
  { title: '술집', category: 'drink' },
];

interface HotPlaceModalProps {
  station: DistanceSummaryItem;
}

export default function HotPlaceModal({ station }: HotPlaceModalProps) {
  const [category, setCategory] = useState<HotPlaceCategory>('food');
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useHotPlaceQuery(category, {
      x: station.station.end_x,
      y: station.station.end_y,
    });

  const allPlaces = data?.pages.flatMap(page => page.documents) ?? [];

  const categoryIcons = {
    food: <RestaurantIcon />,
    cafe: <CafeIcon color="black" />,
    drink: <DrinkIcon color="black" />,
  };

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
        {allPlaces?.map(place => <PlaceItem key={place.id} place={place} />)}
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
