import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

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

export function useUpdateAssignment(houseId) {
  const qc = useQueryClient();
  return useMutation(
    ({ assignmentId, ...body }) => api.updateAssignment(houseId, assignmentId, body),
    {
      onSuccess: () => {
        qc.invalidateQueries(['assignments', houseId]);
      },
    }
  );
}

export function useDeleteAssignment(houseId) {
  const qc = useQueryClient();
  return useMutation(
    (assignmentId) => api.deleteAssignment(houseId, assignmentId),
    {
      onSuccess: () => {
        qc.invalidateQueries(['assignments', houseId]);
      },
    }
  );
}
