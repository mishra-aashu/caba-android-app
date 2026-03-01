import { createContext, useContext } from 'react';

export const CallContext = createContext(null);

export function useCall() {
    const context = useContext(CallContext);
    if (context === undefined) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
}

export default CallContext;
