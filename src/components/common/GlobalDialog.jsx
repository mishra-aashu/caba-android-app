import React from 'react';
import Modal from './Modal';
import { useDialog } from '../../contexts/DialogContext';
import '../../styles/global-dialog.css';

const GlobalDialog = () => {
    const { dialogState, closeDialog, setInputValue } = useDialog();
    const { isOpen, type, title, message, confirmText, cancelText, onConfirm, onCancel, inputValue, inputPlaceholder } = dialogState;

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (type === 'prompt') {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={type === 'confirm' || type === 'prompt' ? onCancel : onConfirm}
            title={title}
            size="small"
            showCloseButton={false}
            closeOnOverlayClick={type === 'alert'}
        >
            <div className="global-dialog-body">
                <p className="dialog-message">{message}</p>

                {type === 'prompt' && (
                    <div className="dialog-input-container">
                        <input
                            type="text"
                            className="dialog-input"
                            value={inputValue || ''}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={inputPlaceholder}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirm();
                                if (e.key === 'Escape') onCancel();
                            }}
                        />
                    </div>
                )}

                <div className="dialog-footer">
                    {(type === 'confirm' || type === 'prompt') && (
                        <button
                            className="dialog-btn cancel-btn"
                            onClick={onCancel}
                        >
                            {cancelText || 'Cancel'}
                        </button>
                    )}
                    <button
                        className={`dialog-btn confirm-btn ${dialogState.variant === 'destructive' ? 'destructive' : ''}`}
                        onClick={handleConfirm}
                    >
                        {type === 'prompt' ? 'Submit' : (confirmText || 'OK')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GlobalDialog;
