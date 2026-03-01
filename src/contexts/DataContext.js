import { createContext, useContext } from 'react';

export const DataContext = createContext();

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

export default DataContext;
