import { useEffect, useState, useRef, useContext, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle';
import Phone from 'lucide-react/dist/esm/icons/phone';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Users from 'lucide-react/dist/esm/icons/users';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone';
import Palette from 'lucide-react/dist/esm/icons/palette';
import QrCode from 'lucide-react/dist/esm/icons/qr-code';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Newspaper from 'lucide-react/dist/esm/icons/newspaper';
import History from 'lucide-react/dist/esm/icons/history';
import Bell from 'lucide-react/dist/esm/icons/bell';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Send from 'lucide-react/dist/esm/icons/send';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Download from 'lucide-react/dist/esm/icons/download';
import { ThemeContext } from '../contexts/ThemeContext';
import styles from '../styles/LandingPage.module.css';
import AppName from '../components/common/AppName';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const FEATURES = [
    {
        icon: <MessageCircle size={24} />,
        title: 'Real-time Messaging',
        desc: 'Instant text with typing indicators, read receipts & reactions',
        color: '#00a884'
    },
    {
        icon: <Phone size={24} />,
        title: 'Voice & Video Calls',
        desc: 'Crystal-clear WebRTC calls with global TURN server support',
        color: '#14b8a6'
    },
    {
        icon: <ImageIcon size={24} />,
        title: 'Rich Media Sharing',
        desc: 'Share images, videos, voice notes & documents seamlessly',
        color: '#059669'
    },
    {
        icon: <Users size={24} />,
        title: 'Group Conversations',
        desc: 'Create rooms, manage members & chat with your whole crew',
        color: '#10b981'
    },
    {
        icon: <Lock size={24} />,
        title: 'Privacy First',
        desc: 'End-to-end security with vanishing messages & blocking',
        color: '#065f46'
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
        color: '#16a34a'
    },
    {
        icon: <QrCode size={24} />,
        title: 'QR Code Sharing',
        desc: 'Add contacts instantly by scanning their unique QR code',
        color: '#0d9488'
    },
    {
        icon: <Clock size={24} />,
        title: 'Smart Reminders',
        desc: 'Set personal reminders so you never forget important things',
        color: '#15803d'
    },
    {
        icon: <Newspaper size={24} />,
        title: 'News Feed',
        desc: 'Stay updated with integrated news right inside the app',
        color: '#25d366'
    },
    {
        icon: <History size={24} />,
        title: 'Call History',
        desc: 'Complete call logs with duration, time & missed call tracking',
        color: '#0f766e'
    },
    {
        icon: <Bell size={24} />,
        title: 'Push Notifications',
        desc: 'Never miss a message with Firebase-powered instant alerts',
        color: '#34d399'
    }
];

const STATS = [
    { value: '99.9', suffix: '%', label: 'Uptime' },
    { value: '12', suffix: '+', label: 'Features' },
    { value: '<1', suffix: 's', label: 'Message Delivery' },
    { value: '100', suffix: '%', label: 'Free & Open' }
];

// ═══════════════════════════════════════════════════════
// TECH ICONS (Custom SVGs for branded feel)
// ═══════════════════════════════════════════════════════

const TechIcons = {
    React: () => (
        <svg viewBox="-11.5 -10.23174 23 20.46348" width="20" height="20">
            <title>React Logo</title>
            <circle cx="0" cy="0" r="2.05" fill="#61dafb" />
            <g stroke="#61dafb" strokeWidth="1" fill="none">
                <ellipse rx="11" ry="4.2" />
                <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                <ellipse rx="11" ry="4.2" transform="rotate(120)" />
            </g>
        </svg>
    ),
    Supabase: () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M13.35 21a.75.75 0 01-1.332.484l-7.5-10a.75.75 0 01.599-1.199h6.142V3a.75.75 0 011.332-.484l7.5 10a.75.75 0 01-.599 1.199h-6.142V21z" fill="#3ECF8E" />
        </svg>
    ),
    WebRTC: () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
    ),
    Firebase: () => (
        <svg viewBox="0 0 32 32" width="20" height="20">
            <path d="M5.56 24.38L14.74 3.12c.3-.67 1.25-.67 1.55 0l2.3 5.34L5.56 24.38z" fill="#FFC228" />
            <path d="M26.44 24.38L16.29 2.5a.86.86 0 00-1.63 0L13.14 6.13l13.3 18.25z" fill="#FFA712" />
            <path d="M5.56 24.38l.61-4.7L18.6 8.35c.16-.62 1-.74 1.34-.18l6.5 16.21-10.15 5.75c-.53.3-1.16.3-1.68 0L5.56 24.38z" fill="#F44336" />
        </svg>
    ),
    Capacitor: () => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#53B9FF">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
        </svg>
    ),
    Vite: () => (
        <svg viewBox="0 0 256 256" width="20" height="20">
            <defs>
                <linearGradient id="vite-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#41D1FF" />
                    <stop offset="100%" stopColor="#BD34FE" />
                </linearGradient>
            </defs>
            <path d="M128 0L11.5 244.5L128 256L244.5 244.5L128 0Z" fill="url(#vite-gradient)" />
            <path d="M128 32l-96 192l96 16l96-16l-96-192z" fill="#FFC228" opacity="0.8" />
        </svg>
    )
};

const TECH_STACK = [
    { name: 'React', color: '#61DAFB', version: '19', icon: <TechIcons.React /> },
    { name: 'Supabase', color: '#3FCF8E', version: 'Realtime', icon: <TechIcons.Supabase /> },
    { name: 'WebRTC', color: '#FF6B35', version: 'P2P', icon: <TechIcons.WebRTC /> },
    { name: 'Firebase', color: '#FFCA28', version: 'FCM', icon: <TechIcons.Firebase /> },
    { name: 'Capacitor', color: '#53B9FF', version: 'Mobile', icon: <TechIcons.Capacitor /> },
    { name: 'Vite', color: '#646CFF', version: 'Fast', icon: <TechIcons.Vite /> }
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
    const { threshold = 0.2, repeat = false } = options;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                if (!repeat) observer.unobserve(el);
            } else if (repeat) {
                setInView(false);
            }
        }, { threshold });

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold, repeat]);

    return [ref, inView];
};

// ═══════════════════════════════════════════════════════
// HERO MARQUEE COMPONENT
// ═══════════════════════════════════════════════════════

const BackgroundMarquee = memo(() => {
    // Generate 12 items (FEATURES length)
    const rowItems = [...FEATURES];

    return (
        <div className={styles['hero-marquee']}>
            <div className={styles['marquee-row-wrapper']}>
                <div className={`${styles['marquee-row-inner']} ${styles['marquee-row-forward']}`}>
                    {rowItems.concat(rowItems).map((f, i) => (
                        <div key={i} className={styles['marquee-item-container']}>
                            <div className={styles['marquee-item']} style={{ '--accent': f.color }}>
                                <div className={styles['m-icon-box']}>{f.icon}</div>
                                <div className={styles['m-text']}>
                                    <span className={styles['m-title']}>{f.title}</span>
                                    <span className={styles['m-desc']}>{f.desc}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className={styles['marquee-row-wrapper']}>
                <div className={`${styles['marquee-row-inner']} ${styles['marquee-row-reverse']}`}>
                    {rowItems.concat(rowItems).map((f, i) => (
                        <div key={i} className={styles['marquee-item-container']}>
                            <div className={styles['marquee-item']} style={{ '--accent': f.color }}>
                                <div className={styles['m-icon-box']}>{f.icon}</div>
                                <div className={styles['m-text']}>
                                    <span className={styles['m-title']}>{f.title}</span>
                                    <span className={styles['m-desc']}>{f.desc}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className={styles['marquee-row-wrapper']}>
                <div className={`${styles['marquee-row-inner']} ${styles['marquee-row-forward-slow']}`}>
                    {rowItems.concat(rowItems).map((f, i) => (
                        <div key={i} className={styles['marquee-item-container']}>
                            <div className={styles['marquee-item']} style={{ '--accent': f.color }}>
                                <div className={styles['m-icon-box']}>{f.icon}</div>
                                <div className={styles['m-text']}>
                                    <span className={styles['m-title']}>{f.title}</span>
                                    <span className={styles['m-desc']}>{f.desc}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

const HeroCanvas = memo(({ isMobile }) => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const animRef = useRef(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        const dpr = window.devicePixelRatio || 1;
        let w, h;
        let inView = true;

        const observer = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
        }, { threshold: 0.01 });

        observer.observe(canvas);

        const resize = () => {
            if (!canvas.parentElement) return;
            w = canvas.parentElement.offsetWidth;
            h = canvas.parentElement.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.scale(dpr, dpr);

            // Re-init particles (fewer on mobile for better performance)
            const count = isMobile ? 20 : 40;
            particlesRef.current = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.5 + 0.5,
                o: Math.random() * 0.2 + 0.1
            }));
        };

        resize();
        window.addEventListener('resize', resize, { passive: true });

        const draw = () => {
            if (!mountedRef.current) return;
            
            if (!inView || document.hidden) {
                animRef.current = requestAnimationFrame(draw);
                return;
            }

            ctx.clearRect(0, 0, w, h);

            const ps = particlesRef.current;
            const connectionDistance = isMobile ? 70 : 130;

            // Draw connections
            const distSq = connectionDistance * connectionDistance;
            ctx.lineWidth = 0.5;
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
                        ctx.strokeStyle = `rgba(0,168,132,${(1 - d / connectionDistance) * 0.1})`;
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
                ctx.fillStyle = `rgba(37,211,102,${p.o})`;
                ctx.fill();
            });

            animRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            mountedRef.current = false;
            window.removeEventListener('resize', resize);
            observer.disconnect();
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [isMobile]);

    return <canvas ref={canvasRef} className={styles['hero-canvas']} />;
});

// ═══════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════

const StatCard = memo(({ value, suffix, label, inView }) => {
    const count = useCountUp(value, 1800, inView);
    return (
        <div className={styles['stat-card']}>
            <div className={styles['stat-number']}>
                {count}<span className={styles['stat-suffix']}>{suffix}</span>
            </div>
            <div className={styles['stat-label']}>{label}</div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════
// CURSOR GLOW COMPONENT (Isolated to prevent full re-renders)
// ═══════════════════════════════════════════════════════

const CursorGlow = memo(({ isMobile }) => {
    const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

    useEffect(() => {
        if (isMobile) return;
        const handleMouseMove = (e) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isMobile]);

    if (isMobile) return null;

    return (
        <div 
            className={styles['cursor-glow']} 
            style={{ 
                transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0) translate(-50%, -50%)`
            }} 
        />
    );
});


// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

const LandingPage = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [isMobile, setIsMobile] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [activeFeature, setActiveFeature] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const containerRef = useRef(null);

    // Section refs for scroll (intersection observer for animations)
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
        };

        checkDevice();
    }, []);

    // Optimized scroll tracking using requestAnimationFrame for buttery smooth parallax
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let lastScrollY = el.scrollTop;
        let ticking = false;

        const updateParallax = () => {
            // Check if element still exists to avoid errors on unmount
            if (containerRef.current) {
                containerRef.current.style.setProperty('--parallax-offset', `${lastScrollY * 0.3}px`);
            }
            ticking = false;
        };

        const handleScroll = () => {
            lastScrollY = el.scrollTop;
            
            // Handle simple state updates
            const scrolled = lastScrollY > 60;
            if (scrolled !== isScrolled) setIsScrolled(scrolled);

            // Handle expensive visual updates with rAF
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [isScrolled]);

    // Auto-rotate features
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveFeature(prev => (prev + 1) % FEATURES.length);
        }, 5000); // Slower rotate
        return () => clearInterval(timer);
    }, []);

    const handleLogin = () => navigate('/login');

    const handleDownloadAPK = () => {
        navigate('/download-apk');
    };

    const scrollTo = (id) => {
        const el = document.getElementById(id);
        if (el && containerRef.current) {
            const top = el.offsetTop;
            containerRef.current.scrollTo({ top, behavior: 'smooth' });
        }
        setMobileMenuOpen(false);
    };

    if (isRedirecting) {
        return (
            <div className={styles['splash-redirect']}>
                <div className={styles['splash-spinner']} />
                <p>Loading Elevengram...</p>
            </div>
        );
    }

    return (
        <div className={styles.landing} data-theme={theme} ref={containerRef}>
            <div className={styles['noise-overlay']} />
            <CursorGlow isMobile={isMobile} />
            <nav className={`${styles['landing-nav']} ${isScrolled ? styles.scrolled : ''}`}>
                <div className={styles['nav-inner']}>
                    <div className={styles['nav-brand']} onClick={() => scrollTo('hero')}>
                        <img src="/pwa-192x192.png" alt="Elevengram" className={styles['nav-logo']} />
                        <AppName size="small" />
                    </div>
                    <div className={`${styles['nav-links']} ${mobileMenuOpen ? styles.open : ''}`}>
                        <button onClick={() => scrollTo('features')}>Features</button>
                        <button onClick={() => scrollTo('story')}>Story</button>
                        <button onClick={() => scrollTo('tech')}>Tech</button>
                        <button className={styles['theme-toggle-btn']} onClick={toggleTheme}>
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {!isMobile && (
                            <button className={styles['nav-cta']} onClick={handleLogin}>
                                Open Web App <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                    <button className={styles['nav-hamburger']} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        <span className={mobileMenuOpen ? styles.open : ''} />
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section className={styles.hero} id="hero">
                <HeroCanvas isMobile={isMobile} />
                <BackgroundMarquee />
                <div className={styles['hero-gradient']} />
                <div className={styles['hero-content']} style={{ transform: 'translateY(var(--parallax-offset, 0px))' }}>
                    <div className={styles['hero-text-glow']} />
                    <div className={styles['hero-logo-wrap']}>
                        <div className={styles['hero-logo-text']}><AppName size="large" /></div>
                    </div>
                    <h1 className={styles['hero-title']}>
                        <span className={styles['title-line']}>What Happens in Eleven,</span>
                        <span className={`${styles['title-line']} ${styles['italic-accent']}`}>Stays in Eleven.</span>
                    </h1>
                    <p className={styles['hero-subtitle']}>
                        Zero servers. Zero logs. Just pure, direct connections and crystal-clear communication.
                    </p>
                    <div className={styles['hero-actions']}>
                        {!isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.primary}`} onClick={handleLogin}>
                                <span>Open Web App</span><ChevronRight size={18} />
                            </button>
                        )}
                        {isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.secondary}`} onClick={handleDownloadAPK}>
                                <Download size={18} /><span>Download APK</span>
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* STATS */}
            <section className={styles['stats-section']} ref={statsRef}>
                <div className={styles['stats-grid']}>
                    {STATS.map((s, i) => <StatCard key={i} {...s} inView={statsInView} />)}
                </div>
            </section>

            {/* FEATURES */}
            <section className={styles['features-section']} id="features" ref={featuresRef}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['section-header']} ${featuresInView ? styles.animate : ''}`}>
                        <span className={styles['section-tag']}>Features</span>
                        <h2>Everything you need,<br />nothing you don't.</h2>
                    </div>
                    <div className={styles['features-grid']}>
                        {FEATURES.map((f, i) => (
                            <div key={i} className={`${styles['feature-card']} ${featuresInView ? styles.animate : ''} ${activeFeature === i ? styles.glow : ''}`} onMouseEnter={() => setActiveFeature(i)}>
                                <div className={styles['feature-icon-wrap']}><span className={styles['feature-icon']}>{f.icon}</span></div>
                                <h3>{f.title}</h3><p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* STORY */}
            <section className={styles['story-section']} id="story" ref={storyRef}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['story-content']} ${storyInView ? styles.animate : ''}`}>
                        <div className={styles['story-text']}>
                            <span className={styles['section-tag']}>Our Story</span>
                            <h2>Why "Elevengram"?</h2>
                            <div className={styles['story-quote']}>
                                <blockquote style={{ border: 'none', background: 'none', padding: 0 }}>
                                    <strong>Elevengram</strong> represents the <strong>11th Level</strong>...
                                </blockquote>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section className={styles['how-section']}>
                <div className={styles['section-inner']}>
                    <div className={styles['steps-grid']}>
                        {[
                            { num: '01', title: 'Sign Up' },
                            { num: '02', title: 'Add Contacts' },
                            { num: '03', title: 'Start Talking' }
                        ].map((step, i) => (
                            <div key={i} className={styles['step-card']}>
                                <div className={styles['step-num']}>{step.num}</div><h3>{step.title}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TECH */}
            <section className={styles['tech-section']} id="tech" ref={techRef}>
                <div className={styles['section-inner']}>
                    <div className={styles['tech-grid']}>
                        {TECH_STACK.map((t, i) => (
                            <div key={i} className={`${styles['tech-card']} ${techInView ? styles.animate : ''}`} style={{ '--tc': t.color }}>
                                <div className={styles['tech-icon-box']}>{t.icon}</div>
                                <span className={styles['tech-name']}>{t.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECURITY */}
            <section className={styles['security-section']}>
                <div className={styles['section-inner']}>
                    <div className={styles['security-content']}>
                        <h2>Your privacy is our priority</h2>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className={styles['cta-section']} id="cta" ref={ctaRef}>
                <div className={`${styles['cta-content']} ${ctaInView ? styles.animate : ''}`}>
                    <h2>Ready to start talking?</h2>
                </div>
            </section>

            {/* FOOTER */}
            <footer className={styles['landing-footer']}>
                <div className={styles['footer-inner']}>
                    <div className={styles['footer-brand']}><AppName size="small" /></div>
                    <div className={styles['footer-bottom']}>
                        <p>© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;