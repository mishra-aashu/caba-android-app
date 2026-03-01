import React, { useState, useCallback, useRef } from 'react';
import { DialogContext } from './DialogContext';

export const DialogProvider = ({ children }) => {
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        type: 'alert', // 'alert' or 'confirm'
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: null,
        onCancel: null
    });

    const promiseRef = useRef(null);

    const showAlert = useCallback((message, title = 'Alert') => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                type: 'alert',
                title,
                message,
                confirmText: 'OK',
                cancelText: '',
                onConfirm: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: null
            });
        });
    }, []);

    const showConfirm = useCallback((message, title = 'Confirm Action') => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                type: 'confirm',
                title,
                message,
                confirmText: 'Confirm',
                cancelText: 'Cancel',
                onConfirm: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                },
                inputValue: '',
                inputPlaceholder: ''
            });
        });
    }, []);

    const showPrompt = useCallback((message, defaultValue = '', title = 'Input Required', inputPlaceholder = '') => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                type: 'prompt',
                title,
                message,
                confirmText: 'Submit',
                cancelText: 'Cancel',
                onConfirm: (value) => { // onConfirm for prompt will receive the input value
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(value);
                },
                onCancel: () => {
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    resolve(null); // Resolve with null if cancelled
                },
                inputValue: defaultValue,
                inputPlaceholder: inputPlaceholder
            });
        });
    }, []);

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    }, []);

    // Function to update input value from the dialog component
    const setInputValue = useCallback((value) => {
        setDialogState(prev => ({ ...prev, inputValue: value }));
    }, []);

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt, dialogState, closeDialog, setInputValue }}>
            {children}
        </DialogContext.Provider>
    );
};
