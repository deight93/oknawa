import { Card, CardBody, CardHeader } from '@nextui-org/react';
import Link from 'next/link';
import styled from 'styled-components';

import { CafeIcon } from '@/assets/icons/Cafe';
import { RestaurantIcon } from '@/assets/icons/Restaurant';
import { HotPlace } from '@/services/hot-place/types';

interface PlaceItemProps {
  place: HotPlace;
}

const categoryIcons: Record<string, JSX.Element> = {
  음식점: <RestaurantIcon color="gray" width="16" height="16" />,
  카페: <CafeIcon color="gray" width="16" height="16" />,
};

export default function PlaceItem({ place }: PlaceItemProps) {
  const {
    place_name,
    category_group_name,
    road_address_name,
    place_url,
    main_photo_url,
    day_business_hours_infos,
  } = place;

  const today = day_business_hours_infos?.[0];
  const dayOfWeek = today?.day_of_the_week ?? '영업시간 미기재';
  const timeSE = today?.day_time?.start_end_time ?? '';

  return (
    <StyledCard>
      <PlaceLink href={place_url} target="_blank" rel="noreferrer">
        <CardContent>
          <StyledCardHeader>
            <PlaceName>{place_name}</PlaceName>
            <Category>{category_group_name}</Category>
          </StyledCardHeader>
          <CardBody className="p-0">
            <CardBodyText>{road_address_name}</CardBodyText>
            <CardBodyText>
              {dayOfWeek} {timeSE}
            </CardBodyText>
          </CardBody>
        </CardContent>
        <ImageBox>
          {main_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={main_photo_url}
              alt="핫플레이스 사진"
              width={80}
              height={64}
              style={{
                borderRadius: '8px',
                minHeight: '70px',
              }}
            />
          ) : (
            <DefaultImage>{categoryIcons[category_group_name]}</DefaultImage>
          )}
        </ImageBox>
      </PlaceLink>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: var(--surface-raised);
`;

const PlaceLink = styled(Link)`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 12px;
  color: inherit;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StyledCardHeader = styled(CardHeader)`
  gap: 4px;
  padding: 0;
`;

const PlaceName = styled.h3`
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  max-width: 170px;
`;

const Category = styled.small`
  font-size: 12px;
  color: var(--text-muted);
`;

const CardBodyText = styled.p`
  font-size: 12px;
  color: var(--text-muted);
`;

const ImageBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  max-height: 75px;
  overflow: hidden;
  border-radius: 8px;
`;

const DefaultImage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 64px;
  background-color: var(--surface-strong);
  border-radius: 8px;
`;
