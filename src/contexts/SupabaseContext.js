import { createContext, useContext } from 'react';

export const SupabaseContext = createContext();

export const useSupabase = () => {
    const context = useContext(SupabaseContext);
    if (!context) {
        throw new Error('useSupabase must be used within a SupabaseProvider');
    }
    return context;
};

export default SupabaseContext;
