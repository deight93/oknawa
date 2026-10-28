import { ArrowUpRight, MapPin } from 'lucide-react';
import styled from 'styled-components';

import { CafeIcon } from '@/assets/icons/Cafe';
import { RestaurantIcon } from '@/assets/icons/Restaurant';
import { HotPlace } from '@/services/hot-place/types';

interface PlaceItemProps {
  place: HotPlace;
}

const categoryIcons: Record<string, JSX.Element> = {
  음식점: <RestaurantIcon color="currentColor" width="24" height="24" />,
  카페: <CafeIcon color="currentColor" width="24" height="24" />,
};

export default function PlaceItem({ place }: PlaceItemProps) {
  const {
    place_name,
    category_group_name,
    road_address_name,
    address_name,
    place_url,
    main_photo_url,
    day_business_hours_infos,
  } = place;
  const businessHours = day_business_hours_infos?.[0];
  const hoursLabel =
    [businessHours?.day_of_the_week, businessHours?.day_time?.start_end_time]
      .filter(Boolean)
      .join(' ') || '영업시간 미기재';

  return (
    <PlaceLink
      href={place_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${place_name} · 카카오맵에서 보기`}
    >
      <CardContent>
        <PlaceName>{place_name}</PlaceName>
        <Category>{category_group_name}</Category>
        <Details>
          <CardBodyText>{road_address_name || address_name}</CardBodyText>
          <CardBodyText>{hoursLabel}</CardBodyText>
        </Details>
      </CardContent>
      <ImageBox aria-hidden="true">
        {main_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main_photo_url}
            alt=""
            width={64}
            height={72}
            loading="lazy"
          />
        ) : (
          (categoryIcons[category_group_name] ?? <MapPin size={24} />)
        )}
        <ExternalLinkIcon>
          <ArrowUpRight size={14} />
        </ExternalLinkIcon>
      </ImageBox>
    </PlaceLink>
  );
}

const PlaceLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-raised);
  color: var(--text-primary);
  text-decoration: none;
  &:hover {
    border-color: var(--border-strong);
  }
`;

const CardContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlaceName = styled.h3`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: keep-all;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
`;

const Category = styled.p`
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--place-muted, var(--text-muted));
`;

const Details = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
`;

const CardBodyText = styled.p`
  font-size: 13px;
  line-height: 1.45;
  word-break: keep-all;
  overflow-wrap: anywhere;
  color: var(--place-muted, var(--text-muted));
`;

const ImageBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 64px;
  height: 72px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--surface-strong);
  color: var(--place-muted, var(--text-muted));
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ExternalLinkIcon = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  border-radius: 4px;
  background: var(--surface-strong);
  color: var(--text-secondary);
`;
