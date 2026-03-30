import { useQuery, useMutation, useQueryClient } from 'react-query';
import { api } from '../api/client';

export function useNotifications() {
  return useQuery(
    ['notifications'],
    () => api.getNotifications().then((r) => r.data),
    { refetchInterval: 30_000 }
  );
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation(
    (notificationId) => api.markNotificationRead(notificationId),
    {
      onSuccess: () => qc.invalidateQueries(['notifications']),
    }
  );
}
