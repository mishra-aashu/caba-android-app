import { useAuth as useAuthContext } from '../contexts/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};

export default useAuth;
