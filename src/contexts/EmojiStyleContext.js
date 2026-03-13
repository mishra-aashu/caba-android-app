import { createContext, useContext } from 'react';

export const EmojiStyleContext = createContext();

export const useEmojiStyle = () => {
    const context = useContext(EmojiStyleContext);
    if (!context) {
        throw new Error('useEmojiStyle must be used within an EmojiStyleProvider');
    }
    return context;
};

export default EmojiStyleContext;
