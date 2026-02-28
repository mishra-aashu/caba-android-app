import React, { useState, useEffect } from 'react';
import { useAddContact } from '../../hooks/useCommonQueries';
import { useAuth } from '../../hooks/useAuth';
import { Camera, X, Loader2, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './QRScanner.css';

const QRScanner = ({ onClose }) => {
    const { user } = useAuth();
    const { mutate: addContact, isPending } = useAddContact();
    const [isCapturing, setIsCapturing] = useState(false);
    const [scannedResult, setScannedResult] = useState(null);

    // Logic to handle the scanned URI
    const handleScannedURI = (uri) => {
        if (!uri.startsWith('caba://add')) {
            toast.error('Invalid QR code format');
            return;
        }

        try {
            const url = new URL(uri.replace('caba://', 'https://'));
            const contactId = url.searchParams.get('id');
            const publicKey = url.searchParams.get('key');

            if (!contactId) throw new Error('Missing User ID');

            setScannedResult({ id: contactId, key: publicKey });
        } catch (err) {
            console.error('Scan error:', err);
            toast.error('Could not parse QR code');
        }
    };

    const confirmAddContact = () => {
        if (!scannedResult) return;

        addContact({
            userId: user.id,
            contactUserId: scannedResult.id,
            contactName: `New Contact (${scannedResult.id.slice(0, 4)})` // Default name
        }, {
            onSuccess: () => {
                onClose();
            }
        });
    };

    // Helper for manual testing in placeholder mode
    const simulateScan = () => {
        const mockUri = `caba://add?id=test-user-id&key=test-public-key`;
        handleScannedURI(mockUri);
    };

    return (
        <div className="qr-scanner-overlay">
            <div className="qr-scanner-modal">
                <div className="scanner-header">
                    <h2>Scan QR Code</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="scanner-body">
                    {!scannedResult ? (
                        <div className="scanner-viewport">
                            {/* This is a placeholder for Capacitor Camera Viewport */}
                            <div className="viewport-overlay">
                                <div className="scan-frame">
                                    <div className="corner top-left"></div>
                                    <div className="corner top-right"></div>
                                    <div className="corner bottom-left"></div>
                                    <div className="corner bottom-right"></div>
                                    <motion.div
                                        className="scan-line"
                                        animate={{ top: ['10%', '90%', '10%'] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    />
                                </div>
                            </div>

                            <div className="viewport-placeholder">
                                <Camera size={48} className="camera-icon" />
                                <p>Align QR code within the frame</p>
                                <button className="simulate-btn" onClick={simulateScan}>
                                    Simulate Mobile Scan
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="scan-result-card">
                            <div className="result-avatar">
                                <UserPlus size={32} />
                            </div>
                            <h3>User Found</h3>
                            <p className="user-id-small">{scannedResult.id}</p>

                            <div className="result-actions">
                                <button className="btn-secondary" onClick={() => setScannedResult(null)}>
                                    Scan Again
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={confirmAddContact}
                                    disabled={isPending}
                                >
                                    {isPending ? <Loader2 className="animate-spin" /> : 'Add Contact'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="scanner-footer">
                    <p>Scan to instantly connect with CaBa users</p>
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
