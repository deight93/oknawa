export const 동이름에_건물명_추가 = (
  buildingName: string,
  extraAddress: string,
) => {
  if (extraAddress) {
    return buildingName ? `${extraAddress}, ${buildingName}` : extraAddress;
  }
  return buildingName || '';
};

export const 전체주소_생성 = (address: string, extraAddress: string) => {
  return extraAddress ? `${address} (${extraAddress})` : address;
};

export const 위도_경도_생성 = (
  전체주소: string,
): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(전체주소, function (result, status) {
      if (status === kakao.maps.services.Status.OK) {
        const coords = new kakao.maps.LatLng(
          Number(result[0].y),
          Number(result[0].x),
        );
        const latitude = coords.getLat();
        const longitude = coords.getLng();

        resolve({ latitude, longitude });
      } else {
        reject(new Error('Failed to fetch coordinates'));
      }
    });
  });
};
