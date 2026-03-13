import { createContext, useContext } from 'react';

export const DialogContext = createContext(null);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

export default DialogContext;
