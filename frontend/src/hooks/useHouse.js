import { useQuery } from 'react-query';
import { api } from '../api/client';

const DEFAULT_HOUSE_ID = 'default-house';

export function useHouseId() {
  return DEFAULT_HOUSE_ID;
}

export function useHouse(houseId) {
  return useQuery(['house', houseId], () => api.getHouse(houseId).then((r) => r.data), {
    enabled: !!houseId,
  });
}

export function useHouses() {
  return useQuery('houses', () => api.getHouses().then((r) => r.data));
}
