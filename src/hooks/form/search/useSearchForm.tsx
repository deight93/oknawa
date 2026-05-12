import { useForm } from 'react-hook-form';
import { number, object, string } from 'yup';

import { yupResolver } from '@hookform/resolvers/yup';
import { SearchState } from '@/jotai/global/store';

const createSearchFormVerifySchema = () => {
  return object().shape({
    name: string().required('이름을 입력해주세요.'),
    address: object().shape({
      fullAddress: string().required('주소를 입력해주세요.'),
      latitude: number().required(),
      longitude: number().required(),
      regionName: string().required(),
    }),
  });
};

export default function useSearchForm() {
  return useForm<SearchState>({
    defaultValues: {
      name: '',
      address: {
        fullAddress: '',
        latitude: 0,
        longitude: 0,
        regionName: '',
      },
    },
    resolver: yupResolver(createSearchFormVerifySchema()),
  });
}
