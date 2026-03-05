import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import '../styles/LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        // 🚀 NATIVE APP CHECK - Immediate redirect
        if (Capacitor.isNativePlatform()) {
            setIsRedirecting(true);
            navigate('/login', { replace: true });
            return;
        }

        // 📱 WEB BROWSER - Detect device type
        const checkDevice = () => {
            const width = window.innerWidth;
            const userAgent = navigator.userAgent.toLowerCase();

            // Mobile detection (width < 768px OR mobile user-agent)
            const isMobileDevice =
                width < 768 ||
                /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            setIsMobile(isMobileDevice);
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);

        return () => window.removeEventListener('resize', checkDevice);
    }, [navigate]);

    if (isRedirecting) {
        return <div className="splash-screen">Loading...</div>;
    }

    // Handle navigation to login
    const handleGoToLogin = () => {
        navigate('/login');
    };

    // Handle APK download
    const handleDownloadAPK = () => {
        // Replace with actual APK URL when available
        // For now, using a placeholder or a potential link from the user
        window.location.href = 'https://caba-messenger.vercel.app/app-release.apk';
    };

    return (
        <div className="landing-page">
            {/* 🎨 HERO SECTION */}
            <div className="hero-section">
                <div className="hero-content">
                    <img
                        src="/pwa-192x192.png"
                        alt="CaBa Logo"
                        className="app-logo"
                    />
                    <h1>Welcome to CaBa Messenger</h1>
                    <p className="tagline">
                        The Art of Conversation. Secure, fast, and reliable messaging for everyone.
                    </p>

                    <div className="features">
                        <div className="feature">
                            <span className="icon">🔒</span>
                            <h3>Private by Default</h3>
                        </div>
                        <div className="feature">
                            <span className="icon">⚡</span>
                            <h3>Lightning Fast</h3>
                        </div>
                        <div className="feature">
                            <span className="icon">🌍</span>
                            <h3>Infinite History</h3>
                        </div>
                    </div>

                    {/* 📱 CONDITIONAL CALL-TO-ACTION */}
                    <div className="cta-section">
                        {isMobile ? (
                            // Mobile Web - Show Download APK Button
                            <button
                                className="btn-primary btn-large"
                                onClick={handleDownloadAPK}
                            >
                                📥 Download APK for Android
                            </button>
                        ) : (
                            // Desktop Web - Show Login Button
                            <button
                                className="btn-primary btn-large"
                                onClick={handleGoToLogin}
                            >
                                🚀 Go to Web Login
                            </button>
                        )}
                    </div>

                    {/* Optional: Secondary action */}
                    {!isMobile && (
                        <p className="secondary-text">
                            Or download our mobile app for the best experience
                        </p>
                    )}
                </div>
            </div>

            {/* Optional: Footer */}
            <footer className="landing-footer">
                <p>&copy; 2024 CaBa Messenger. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
