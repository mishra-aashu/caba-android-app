import { useEffect, useState, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
    MessageCircle, Phone, Image as ImageIcon, Users, Lock, Smartphone,
    Palette, QrCode, Clock, Newspaper, History, Bell,
    UserPlus, Send, ShieldCheck, Shield, Ghost, Ban,
    Sun, Moon, Sparkles, Zap, ChevronRight, Download,
    Globe, Layers, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../contexts/ThemeContext';
import '../styles/LandingPage.css';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const FEATURES = [
    {
        icon: <MessageCircle size={24} />,
        title: 'Real-time Messaging',
        desc: 'Instant text with typing indicators, read receipts & reactions',
        color: '#3b82f6'
    },
    {
        icon: <Phone size={24} />,
        title: 'Voice & Video Calls',
        desc: 'Crystal-clear WebRTC calls with global TURN server support',
        color: '#8b5cf6'
    },
    {
        icon: <ImageIcon size={24} />,
        title: 'Rich Media Sharing',
        desc: 'Share images, videos, voice notes & documents seamlessly',
        color: '#ec4899'
    },
    {
        icon: <Users size={24} />,
        title: 'Group Conversations',
        desc: 'Create rooms, manage members & chat with your whole crew',
        color: '#14b8a6'
    },
    {
        icon: <Lock size={24} />,
        title: 'Privacy First',
        desc: 'End-to-end security with vanishing messages & blocking',
        color: '#f59e0b'
    },
    {
        icon: <Smartphone size={24} />,
        title: 'Cross-Platform',
        desc: 'Works on Android, iOS, Desktop & Web — one account everywhere',
        color: '#22c55e'
    },
    {
        icon: <Palette size={24} />,
        title: 'Custom Themes',
        desc: 'Personalize chat wallpapers, colors & dark/light modes',
        color: '#f97316'
    },
    {
        icon: <QrCode size={24} />,
        title: 'QR Code Sharing',
        desc: 'Add contacts instantly by scanning their unique QR code',
        color: '#06b6d4'
    },
    {
        icon: <Clock size={24} />,
        title: 'Smart Reminders',
        desc: 'Set personal reminders so you never forget important things',
        color: '#a855f7'
    },
    {
        icon: <Newspaper size={24} />,
        title: 'News Feed',
        desc: 'Stay updated with integrated news right inside the app',
        color: '#ef4444'
    },
    {
        icon: <History size={24} />,
        title: 'Call History',
        desc: 'Complete call logs with duration, time & missed call tracking',
        color: '#64748b'
    },
    {
        icon: <Bell size={24} />,
        title: 'Push Notifications',
        desc: 'Never miss a message with Firebase-powered instant alerts',
        color: '#eab308'
    }
];

const STATS = [
    { value: '99.9', suffix: '%', label: 'Uptime' },
    { value: '12', suffix: '+', label: 'Features' },
    { value: '<1', suffix: 's', label: 'Message Delivery' },
    { value: '100', suffix: '%', label: 'Free & Open' }
];

const TECH_STACK = [
    { name: 'React', color: '#61DAFB', version: '19' },
    { name: 'Supabase', color: '#3FCF8E', version: 'Realtime' },
    { name: 'WebRTC', color: '#FF6B35', version: 'P2P' },
    { name: 'Firebase', color: '#FFCA28', version: 'FCM' },
    { name: 'Capacitor', color: '#53B9FF', version: 'Mobile' },
    { name: 'Vite', color: '#646CFF', version: 'Fast' }
];

// ═══════════════════════════════════════════════════════
// ANIMATED COUNTER HOOK
// ═══════════════════════════════════════════════════════

const useCountUp = (target, duration = 2000, start = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!start) return;

        const num = parseFloat(target);
        if (isNaN(num)) { setCount(target); return; }

        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setCount((num * eased).toFixed(num % 1 ? 1 : 0));
            if (progress < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }, [target, duration, start]);

    return count;
};

// ═══════════════════════════════════════════════════════
// INTERSECTION OBSERVER HOOK
// ═══════════════════════════════════════════════════════

const useInView = (options = {}) => {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                if (!options.repeat) observer.unobserve(el);
            } else if (options.repeat) {
                setInView(false);
            }
        }, { threshold: options.threshold || 0.2 });

        observer.observe(el);
        return () => observer.disconnect();
    }, [options.threshold, options.repeat]);

    return [ref, inView];
};

// ═══════════════════════════════════════════════════════
// HERO MARQUEE COMPONENT
// ═══════════════════════════════════════════════════════

const BackgroundMarquee = () => {
    const row1 = [...FEATURES, ...FEATURES];
    const row2 = [...FEATURES, ...FEATURES];
    const row3 = [...FEATURES, ...FEATURES];

    const MarqueeRow = ({ items, direction = 1, speed = 25 }) => {
        // Calculate stepped keyframes: move for 30%, pause for 70%
        const numItems = FEATURES.length; // 12
        const xKeyframes = ['0%'];
        const tKeyframes = [0];

        for (let i = 1; i <= numItems; i++) {
            const percentage = -(i / (numItems * 2)) * 100; // *2 because row is 2x duplication
            const moveTime = (i - 1) / numItems + 0.02; // Take 2% of time to move
            const pauseTime = i / numItems; // Pause until next segment

            xKeyframes.push(`${percentage}%`);
            tKeyframes.push(moveTime);

            if (i < numItems) {
                xKeyframes.push(`${percentage}%`);
                tKeyframes.push(pauseTime);
            }
        }

        // For reverse direction, we just invert the values
        const finalX = direction > 0 ? xKeyframes : xKeyframes.map(v => `${-50 - parseFloat(v)}%`);

        return (
            <div className="marquee-row-wrapper">
                <motion.div
                    className="marquee-row-inner"
                    animate={{ x: finalX }}
                    style={{ translateZ: 0 }}
                    transition={{
                        duration: speed * 3, // Slower to allow for pauses
                        ease: "easeInOut",
                        repeat: Infinity,
                        times: tKeyframes
                    }}
                >
                    {items.map((f, i) => (
                        <div key={i} className="marquee-item-container">
                            <div className="marquee-item" style={{ '--accent': f.color }}>
                                <div className="m-icon-box">{f.icon}</div>
                                <div className="m-text">
                                    <span className="m-title">{f.title}</span>
                                    <span className="m-desc">{f.desc}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>
        );
    };

    return (
        <div className="hero-marquee">
            <MarqueeRow items={row1} direction={1} speed={15} />
            <MarqueeRow items={row2} direction={-1} speed={20} />
            <MarqueeRow items={row3} direction={1} speed={18} />
        </div>
    );
};

const HeroCanvas = ({ isMobile }) => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        let w, h;

        const resize = () => {
            w = canvas.parentElement.offsetWidth;
            h = canvas.parentElement.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.scale(dpr, dpr);

            // Re-init particles (fewer on mobile for better performance)
            const count = isMobile ? 25 : 45;
            particlesRef.current = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2 + 0.5,
                o: Math.random() * 0.3 + 0.1
            }));
        };

        resize();
        window.addEventListener('resize', resize);

        const draw = () => {
            if (!mountedRef.current || document.hidden) {
                animRef.current = requestAnimationFrame(draw);
                return;
            }

            ctx.clearRect(0, 0, w, h);

            const ps = particlesRef.current;
            const connectionDistance = isMobile ? 80 : 150; // Dynamic distance based on mobile detected in parent

            // Draw connections
            const distSq = connectionDistance * connectionDistance;
            for (let i = 0; i < ps.length; i++) {
                const p1 = ps[i];
                for (let j = i + 1; j < ps.length; j++) {
                    const p2 = ps[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < distSq) {
                        const d = Math.sqrt(d2);
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(124,58,237,${(1 - d / connectionDistance) * 0.08})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            // Draw & update particles
            ps.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(167,139,250,${p.o})`;
                ctx.fill();
            });

            animRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            mountedRef.current = false;
            window.removeEventListener('resize', resize);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, []);

    return <canvas ref={canvasRef} className="hero-canvas" />;
};

// ═══════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════

const StatCard = ({ value, suffix, label, inView }) => {
    const count = useCountUp(value, 1800, inView);
    return (
        <div className="stat-card">
            <div className="stat-number">
                {count}<span className="stat-suffix">{suffix}</span>
            </div>
            <div className="stat-label">{label}</div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

const LandingPage = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [isMobile, setIsMobile] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [activeFeature, setActiveFeature] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Section refs for scroll
    const [statsRef, statsInView] = useInView({ threshold: 0.3 });
    const [featuresRef, featuresInView] = useInView({ threshold: 0.1 });
    const [storyRef, storyInView] = useInView({ threshold: 0.3 });
    const [techRef, techInView] = useInView({ threshold: 0.2 });
    const [ctaRef, ctaInView] = useInView({ threshold: 0.3 });

    // Platform check
    useEffect(() => {
        const checkDevice = () => {
            const width = window.innerWidth;
            const ua = navigator.userAgent.toLowerCase();
            const mobile = width < 768 ||
                /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
            setIsMobile(mobile);
            // Removed automatic redirect to /download-apk for mobile web users
        };

        checkDevice();
        // Don't add resize listener to prevent unwanted redirects during resize
    }, [navigate]);

    // Scroll tracking (throttled)
    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    setScrollY(window.scrollY);
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Auto-rotate features
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveFeature(prev => (prev + 1) % FEATURES.length);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    const handleLogin = () => navigate('/login');

    const handleDownloadAPK = () => {
        window.location.href = 'https://caba-messenger.vercel.app/app-release.apk';
    };

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
    };

    if (isRedirecting) {
        return (
            <div className="splash-redirect">
                <div className="splash-spinner" />
                <p>Loading CaBa...</p>
            </div>
        );
    }

    const parallaxOffset = scrollY * 0.3;

    return (
        <div className="landing">
            {/* ═══════════════════════════════════════════════
          NAVIGATION
          ═══════════════════════════════════════════════ */}
            <nav className={`landing-nav ${scrollY > 60 ? 'scrolled' : ''}`}>
                <div className="nav-inner">
                    <div className="nav-brand" onClick={() => scrollTo('hero')}>
                        <img src="/pwa-192x192.png" alt="CaBa" className="nav-logo" />
                        <span className="nav-name">CaBa</span>
                    </div>

                    <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
                        <button onClick={() => scrollTo('features')}>Features</button>
                        <button onClick={() => scrollTo('story')}>Story</button>
                        <button onClick={() => scrollTo('tech')}>Tech</button>
                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {!isMobile && (
                            <button className="nav-cta" onClick={handleLogin}>
                                Open Web App <ChevronRight size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        className="nav-hamburger"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={mobileMenuOpen ? 'open' : ''} />
                    </button>
                </div>
            </nav>

            {/* ═══════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════ */}
            <section className="hero" id="hero">
                <HeroCanvas isMobile={isMobile} />
                <BackgroundMarquee />

                <div className="hero-gradient" />

                <div
                    className="hero-content"
                    style={{ transform: `translateY(${parallaxOffset}px)` }}
                >
                    {/* Background Glow for Readability */}
                    <div className="hero-text-glow" />

                    {/* Animated Logo */}
                    <div className="hero-logo-wrap">
                        <div className="hero-logo-rings">
                            <div className="h-ring r1" />
                            <div className="h-ring r2" />
                        </div>
                        <img
                            src="/pwa-192x192.png"
                            alt="CaBa Messenger"
                            className="hero-logo-img"
                        />
                    </div>

                    <h1 className="hero-title">
                        <span className="title-line">Communication,</span>
                        <span className="title-line accent">Reimagined.</span>
                    </h1>

                    <p className="hero-subtitle">
                        CaBa brings people together through secure messaging, crystal-clear
                        calls & a modern experience that just works — everywhere.
                    </p>

                    <div className="hero-actions">
                        {!isMobile && (
                            <button className="btn-hero primary" onClick={handleLogin}>
                                <span>Open Web App</span>
                                <ChevronRight size={18} />
                            </button>
                        )}
                        {isMobile && (
                            <button className="btn-hero secondary" onClick={handleDownloadAPK}>
                                <Download size={18} />
                                <span>Download APK</span>
                            </button>
                        )}
                    </div>

                    <div className="hero-badges">
                        <span className="badge-item">
                            <Shield size={14} />
                            Secure
                        </span>
                        <span className="badge-item">
                            <Zap size={14} />
                            Fast
                        </span>
                        <span className="badge-item">
                            <Globe size={14} />
                            Global
                        </span>
                        <span className="badge-item">
                            <Layers size={14} />
                            Open Source
                        </span>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="scroll-indicator">
                    <span>Scroll to explore</span>
                    <div className="scroll-arrow" />
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════════════ */}
            <section className="stats-section" ref={statsRef}>
                <div className="stats-grid">
                    {STATS.map((s, i) => (
                        <StatCard key={i} {...s} inView={statsInView} />
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════════════ */}
            <section className="features-section" id="features" ref={featuresRef}>
                <div className="section-inner">
                    <div className={`section-header ${featuresInView ? 'animate' : ''}`}>
                        <span className="section-tag">Features</span>
                        <h2>Everything you need,<br />nothing you don't.</h2>
                        <p>
                            CaBa packs powerful communication tools into a clean,
                            intuitive interface — designed for real people.
                        </p>
                    </div>

                    <div className="features-grid">
                        {FEATURES.map((f, i) => (
                            <div
                                key={i}
                                className={`feature-card ${featuresInView ? 'animate' : ''} ${activeFeature === i ? 'glow' : ''}`}
                                style={{
                                    animationDelay: `${i * 0.06}s`,
                                    '--accent': f.color
                                }}
                                onMouseEnter={() => setActiveFeature(i)}
                            >
                                <div className="feature-icon-wrap">
                                    <span className="feature-icon">{f.icon}</span>
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                                <div className="feature-shine" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          ORIGIN STORY
          ═══════════════════════════════════════════════ */}
            <section className="story-section" id="story" ref={storyRef}>
                <div className="section-inner">
                    <div className={`story-content ${storyInView ? 'animate' : ''}`}>
                        <div className="story-text">
                            <span className="section-tag">Our Story</span>
                            <h2>What does "CaBa" mean?</h2>
                            <div className="story-quote">
                                <div className="quote-mark">"</div>
                                <blockquote style={{ border: 'none', background: 'none', padding: 0 }}>
                                    <strong>CaBa</strong> comes from the Bhojpuri greeting
                                    <em> "Kaa Baa?"</em> — meaning
                                    <em> "What's up?"</em> or <em>"How are things?"</em>
                                </blockquote>
                            </div>
                            <p>
                                Just like WhatsApp embodies "What's up?" in modern messaging,
                                CaBa represents that same warm, casual spirit of connecting with
                                the people who matter — rooted in the friendly culture of
                                everyday conversations.
                            </p>
                            <p>
                                We believe communication should feel natural, personal, and
                                effortless. That's why every feature in CaBa is built around
                                bringing people closer together through meaningful interactions.
                            </p>
                        </div>

                        <div className="story-visual">
                            <div className="story-card">
                                <div className="story-emoji">
                                    <Sparkles size={48} className="sparkle-icon" />
                                </div>
                                <div className="story-greeting">
                                    <span className="bhojpuri">Kaa Baa?</span>
                                    <span className="english">What's up?</span>
                                </div>
                                <div className="story-arrow"><ChevronRight size={24} /></div>
                                <div className="story-brand">
                                    <img src="/pwa-192x192.png" alt="CaBa" className="story-logo" />
                                    <span>CaBa</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════ */}
            <section className="how-section">
                <div className="section-inner">
                    <div className="section-header animate">
                        <span className="section-tag">Simple</span>
                        <h2>Up and running in seconds</h2>
                    </div>

                    <div className="steps-grid">
                        {[
                            { num: '01', title: 'Sign Up', desc: 'Create your account with email or phone — takes 30 seconds', icon: <UserPlus size={32} /> },
                            { num: '02', title: 'Add Contacts', desc: 'Find friends by phone, email, or scan their QR code instantly', icon: <QrCode size={32} /> },
                            { num: '03', title: 'Start Talking', desc: 'Send messages, make calls, share media — it just works', icon: <Send size={32} /> }
                        ].map((step, i) => (
                            <div key={i} className="step-card">
                                <div className="step-num">{step.num}</div>
                                <div className="step-icon">{step.icon}</div>
                                <h3>{step.title}</h3>
                                <p>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          TECH STACK
          ═══════════════════════════════════════════════ */}
            <section className="tech-section" id="tech" ref={techRef}>
                <div className="section-inner">
                    <div className={`section-header ${techInView ? 'animate' : ''}`}>
                        <span className="section-tag">Technology</span>
                        <h2>Built with the best</h2>
                        <p>Modern, battle-tested technologies powering every conversation.</p>
                    </div>

                    <div className="tech-grid">
                        {TECH_STACK.map((t, i) => (
                            <div
                                key={i}
                                className={`tech-card ${techInView ? 'animate' : ''}`}
                                style={{ animationDelay: `${i * 0.1}s`, '--tc': t.color }}
                            >
                                <div className="tech-dot" style={{ background: t.color }} />
                                <span className="tech-name">{t.name}</span>
                                <span className="tech-ver">{t.version}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          SECURITY
          ═══════════════════════════════════════════════ */}
            <section className="security-section">
                <div className="section-inner">
                    <div className="security-content">
                        <div className="security-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M9 12l2 2 4-4" />
                            </svg>
                        </div>
                        <h2>Your privacy is our priority</h2>
                        <p>
                            Built on Supabase with Row Level Security, your data stays yours.
                            Vanishing messages, user blocking, and encrypted connections
                            ensure every conversation remains private.
                        </p>
                        <div className="security-badges">
                            <span><ShieldCheck size={14} /> Encrypted Connections</span>
                            <span><Shield size={14} /> Row Level Security</span>
                            <span><Ghost size={14} /> Vanishing Messages</span>
                            <span><Ban size={14} /> User Blocking</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════ */}
            <section className="cta-section" id="download" ref={ctaRef}>
                <div className={`cta-content ${ctaInView ? 'animate' : ''}`}>
                    <h2>Ready to start talking?</h2>
                    <p>Join CaBa today — it's free, open source, and built for everyone.</p>

                    <div className="cta-buttons">
                        {!isMobile && (
                            <button className="btn-hero primary large" onClick={handleLogin}>
                                Open Web App <ChevronRight size={20} />
                            </button>
                        )}
                        {isMobile && (
                            <button className="btn-hero secondary large" onClick={handleDownloadAPK}>
                                <Download size={20} />
                                <span>Download Android APK</span>
                            </button>
                        )}
                    </div>

                    <div className="cta-note">
                        Free forever • No ads • Open source
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="footer-brand">
                        <img src="/pwa-192x192.png" alt="CaBa" className="footer-logo" />
                        <div>
                            <span className="footer-name">CaBa Messenger</span>
                            <span className="footer-tagline">The Art of Conversation</span>
                        </div>
                    </div>

                    <div className="footer-links">
                        <a href="https://github.com/mishra-aashu/caba-android-app" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                        <button onClick={() => scrollTo('features')}>Features</button>
                        <button onClick={() => scrollTo('story')}>Story</button>
                        {!isMobile && <button onClick={handleLogin}>Web App</button>}
                    </div>

                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} CaBa Messenger. Made with <Heart size={14} className="footer-heart" /> for better communication.</p>
                        <p className="footer-license">MIT License • Open Source</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;