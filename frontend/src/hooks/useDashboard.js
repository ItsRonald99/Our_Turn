import { useQuery } from 'react-query';
import { api } from '../api/client';
import { useHouseId } from './useHouse';

export function useDashboardStats() {
  const houseId = useHouseId();
  return useQuery(
    ['dashboard', houseId],
    () => api.getDashboardStats(houseId).then((r) => r.data),
    { enabled: !!houseId }
  );
}
