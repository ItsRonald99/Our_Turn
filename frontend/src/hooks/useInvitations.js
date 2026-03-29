import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

export function useInvitations() {
  return useQuery(
    ['invitations'],
    () => api.getInvitations().then((r) => r.data),
    { refetchInterval: 30_000 }
  );
}

export function useInviteUser(houseId) {
  return useMutation((body) => api.sendInvitation(houseId, body));
}

export function useRespondInvitation() {
  const qc = useQueryClient();
  return useMutation(
    ({ invitationId, action }) => api.respondInvitation(invitationId, { action }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['invitations']);
      },
    }
  );
}
