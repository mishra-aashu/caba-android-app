import useAuthStore from '../store/authStore';

export const useAuth = (selector) => {
  return useAuthStore(selector);
};

export default useAuth;

