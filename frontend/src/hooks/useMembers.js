import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

export function useMembers(houseId) {
  return useQuery(
    ['members', houseId],
    () => api.getMembers(houseId).then((r) => r.data),
    { enabled: !!houseId }
  );
}

export function useCreateMember(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (body) => api.createMember(houseId, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['members', houseId]);
      },
    }
  );
}

export function useUpdateMember(houseId) {
  const qc = useQueryClient();
  return useMutation(
    ({ memberId, ...body }) => api.updateMember(houseId, memberId, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['members', houseId]);
      },
    }
  );
}

export function useDeleteMember(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (memberId) => api.deleteMember(houseId, memberId),
    {
      onSuccess: () => {
        qc.invalidateQueries(['members', houseId]);
        qc.invalidateQueries(['assignments', houseId]);
      },
    }
  );
}
