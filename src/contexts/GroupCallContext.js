import { createContext, useContext } from 'react';

export const GroupCallContext = createContext(null);

export function useGroupCall() {
    const context = useContext(GroupCallContext);
    if (!context) {
        throw new Error('useGroupCall must be used within a GroupCallProvider');
    }
    return context;
}

export default GroupCallContext;
