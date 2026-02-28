import React from 'react';
import QRCode from "react-qr-code";
import './UserQRCode.css';

const UserQRCode = ({ userId, publicKey, userName }) => {
    const qrValue = `caba://add?id=${userId}&key=${publicKey}`;

    return (
        <div className="user-qr-card">
            <div className="user-qr-header">
                <div className="user-qr-avatar">
                    {userName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="user-qr-info">
                    <h3>{userName || 'User'}</h3>
                    <p>Scan to add me on CaBa</p>
                </div>
            </div>

            <div className="user-qr-container">
                <div className="qr-wrapper shadow-premium">
                    <QRCode
                        value={qrValue}
                        size={200}
                        level="H"
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                    />
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
