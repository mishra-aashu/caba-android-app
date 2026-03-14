import React, { useEffect, useRef } from 'react';
// qrcode loaded dynamically
import './UserQRCode.css';

const UserQRCode = ({ userId, publicKey, userName }) => {
    const qrValue = `caba://add?id=${userId}&key=${publicKey}`;
    const canvasRef = useRef(null);

    useEffect(() => {
        const generateQR = async () => {
            if (canvasRef.current) {
                try {
                    const qrcode = await import('qrcode');
                    qrcode.toCanvas(canvasRef.current, qrValue, {
                        width: 200,
                        margin: 0,
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        }
                    }, (err) => {
                        if (err) console.error(err);
                    });
                } catch (err) {
                    console.error('Failed to load qrcode library:', err);
                }
            }
        };
        generateQR();
    }, [qrValue]);

    return (
        <div className="user-qr-card">
            <div className="user-qr-header">
                <div className="user-qr-avatar">
                    {userName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="user-qr-info">
                    <h3>{userName || 'User'}</h3>
                    <p>Scan to add me on ELEVENGRAM</p>
                </div>
            </div>

            <div className="user-qr-container">
                <div className="qr-wrapper shadow-premium">
                    <canvas ref={canvasRef} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                    {/* Logo Overlay */}
                    <div className="qr-logo-overlay">
                        <div className="logo-inner">
                            <span className="logo-text">CB</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="user-qr-footer">
                <div className="uri-badge">
                    <code>caba://add</code>
                </div>
            </div>
        </div>
    );
};

export default UserQRCode;
