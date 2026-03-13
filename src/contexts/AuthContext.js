import { createContext, useContext } from 'react';

export const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
