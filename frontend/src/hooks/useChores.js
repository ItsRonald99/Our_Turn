import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

export function useChoreTypes(houseId) {
  return useQuery(
    ['choreTypes', houseId],
    () => api.getChoreTypes(houseId).then((r) => r.data),
    { enabled: !!houseId }
  );
}

export function useAssignments(houseId, options = {}) {
  return useQuery(
    ['assignments', houseId, options],
    () => api.getAssignments(houseId, options).then((r) => r.data),
    { enabled: !!houseId }
  );
}

export function useCreateAssignment(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (body) => api.createAssignment(houseId, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['assignments', houseId]);
      },
    }
  );
}

export function useCompleteAssignment(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (assignmentId) => api.completeAssignment(houseId, assignmentId),
    {
      onSuccess: () => {
        qc.invalidateQueries(['assignments', houseId]);
      },
    }
  );
}
