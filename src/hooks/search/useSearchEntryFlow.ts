import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { useAtom } from 'jotai';

import {
  useMakeRoomMutation,
  useSubmitDeparturePointMutation,
} from '@/hooks/mutation/search';
import { roomState } from '@/jotai/global/room';
import { SearchState, searchState } from '@/jotai/global/store';
import { SubmitDeparturePointRequestBody } from '@/services/search/types';
import useModal from '@/hooks/common/useModal';
import { getApiErrorMessage } from '@/api/errors';
import { assertBrowserStorageWritable } from '@/utils/browserStorage';

type SearchViewType = 'individual' | 'together';

const toDeparturePointRequestBody = (
  roomId: string,
  searchForm: SearchState,
): SubmitDeparturePointRequestBody => ({
  room_id: roomId,
  name: searchForm.name,
  travel_mode: searchForm.travelMode ?? null,
  region_name: searchForm.address.regionName,
  full_address: searchForm.address.fullAddress,
  start_x: searchForm.address.longitude,
  start_y: searchForm.address.latitude,
});

const toSearchStateSnapshot = (searchForm: SearchState): SearchState => ({
  name: searchForm.name,
  travelMode: searchForm.travelMode,
  address: {
    fullAddress: searchForm.address.fullAddress,
    latitude: searchForm.address.latitude,
    longitude: searchForm.address.longitude,
    regionName: searchForm.address.regionName,
  },
});

export default function useSearchEntryFlow(
  type: SearchViewType,
  shareRoomId: string | null,
  resetForm: () => void,
) {
  const router = useRouter();
  const [searchList, setSearchList] = useAtom(searchState);
  const [storageRoomData, setStorageRoomData] = useAtom(roomState);

  const { mutateAsync: makeRoom } = useMakeRoomMutation();
  const { mutateAsync: submitDeparturePoint } =
    useSubmitDeparturePointMutation();
  const { setModalContents } = useModal();
  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isIndividualView = type === 'individual';
  const searchCount = searchList.length;

  const submitIndividualSearch = (searchForm: SearchState) => {
    setSearchList(prevState => [
      ...prevState,
      toSearchStateSnapshot(searchForm),
    ]);

    if (searchCount >= 1) {
      router.push('/search/list');
      return;
    }

    resetForm();
  };

  const submitTogetherSearch = async (searchForm: SearchState) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      assertBrowserStorageWritable('local');
      const targetRoomId =
        shareRoomId || (searchCount > 0 ? storageRoomData.roomId : '');
      if (targetRoomId) {
        await submitDeparturePoint({
          requestBody: toDeparturePointRequestBody(targetRoomId, searchForm),
        });
        if (shareRoomId)
          setStorageRoomData({ roomId: shareRoomId, hostId: '' });
      } else {
        const data = await makeRoom(searchForm);
        setStorageRoomData({
          roomId: data?.room_id ?? '',
          hostId: data?.room_host_id ?? '',
        });
      }
      // Keep the lock until navigation unmounts this form, including the response gap.
      router.push('/search/list-together');
    } catch (error) {
      inFlight.current = false;
      setIsSubmitting(false);
      setModalContents({
        buttonLabel: '확인',
        contents: getApiErrorMessage(
          error,
          '출발지를 등록하지 못했습니다. 다시 시도해주세요.',
        ),
      });
    }
  };

  const submitSearch = (searchForm: SearchState) => {
    if (isIndividualView) {
      submitIndividualSearch(searchForm);
      return;
    }

    void submitTogetherSearch(searchForm);
  };

  return {
    isIndividualView,
    searchCount,
    isSubmitting,
    submitSearch,
  };
}
