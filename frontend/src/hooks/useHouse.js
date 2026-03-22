import { useAuth } from '../context/AuthContext';

export function useHouseId() {
  const { activeHouseId } = useAuth();
  return activeHouseId;
}

export { useAuth as useHouseAuth };
