import { useMutation } from 'react-query';
import { api } from '../api/client';

export function useChangePassword() {
  return useMutation((body) => api.changePassword(body));
}

export function useChangeUsername() {
  return useMutation((body) => api.changeUsername(body));
}
