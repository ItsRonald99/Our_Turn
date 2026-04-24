import { useQuery, useMutation, useQueryClient } from 'react-query';
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

export function useAdjustTally(houseId) {
  const qc = useQueryClient();
  return useMutation(
    ({ action, memberId, choreTypeId }) =>
      action === 'add'
        ? api.addTally(houseId, { memberId, choreTypeId })
        : api.removeTally(houseId, { memberId, choreTypeId }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['dashboard', houseId]);
      },
    }
  );
}
