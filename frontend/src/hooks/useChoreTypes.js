import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

export function useChoreTypes(houseId) {
  return useQuery(
    ['choreTypes', houseId],
    () => api.getChoreTypes(houseId).then((r) => r.data),
    { enabled: !!houseId }
  );
}

export function useCreateChoreType(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (body) => api.createChoreType(houseId, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['choreTypes', houseId]);
      },
    }
  );
}

export function useDeleteChoreType(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (choreTypeId) => api.deleteChoreType(houseId, choreTypeId),
    {
      onSuccess: () => {
        qc.invalidateQueries(['choreTypes', houseId]);
      },
    }
  );
}
