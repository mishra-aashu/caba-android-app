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
            <div className={styles['marquee-row-wrapper']}>
                <motion.div
                    className={styles['marquee-row-inner']}
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
                </motion.div>
            </div>
        );
    };

    return (
        <div className={styles['hero-marquee']}>
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
                        // Emerald Green connections
                        ctx.strokeStyle = `rgba(0,168,132,${(1 - d / connectionDistance) * 0.12})`;
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
                ctx.fillStyle = `rgba(37,211,102,${p.o * 1.5})`; // Emerald Green particles
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

    return <canvas ref={canvasRef} className={styles['hero-canvas']} />;
};

// ═══════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════

const StatCard = ({ value, suffix, label, inView }) => {
    const count = useCountUp(value, 1800, inView);
    return (
        <div className={styles['stat-card']}>
            <div className={styles['stat-number']}>
                {count}<span className={styles['stat-suffix']}>{suffix}</span>
            </div>
            <div className={styles['stat-label']}>{label}</div>
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
        navigate('/download-apk');
    };

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
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

    const parallaxOffset = scrollY * 0.3;

    return (
        <div className={styles.landing} data-theme={theme}>
            <div className={styles['noise-overlay']} />
            {/* ═══════════════════════════════════════════════
          NAVIGATION
          ═══════════════════════════════════════════════ */}
            <nav className={`${styles['landing-nav']} ${scrollY > 60 ? styles.scrolled : ''}`}>
                <div className={styles['nav-inner']}>
                    <div className={styles['nav-brand']} onClick={() => scrollTo('hero')}>
                        <img src="/pwa-192x192.png" alt="Elevengram" className={styles['nav-logo']} />
                        <AppName size="small" />
                    </div>

                    <div className={`${styles['nav-links']} ${mobileMenuOpen ? styles.open : ''}`}>
                        <button onClick={() => scrollTo('features')}>Features</button>
                        <button onClick={() => scrollTo('story')}>Story</button>
                        <button onClick={() => scrollTo('tech')}>Tech</button>
                        <button
                            className={styles['theme-toggle-btn']}
                            onClick={toggleTheme}
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {!isMobile && (
                            <button className={styles['nav-cta']} onClick={handleLogin}>
                                Open Web App <ChevronRight size={16} />
                            </button>
                        )}
                    </div>

                    <button
                        className={styles['nav-hamburger']}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span className={mobileMenuOpen ? styles.open : ''} />
                    </button>
                </div>
            </nav>

            {/* ═══════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════ */}
            <section className={styles.hero} id="hero">
                <HeroCanvas isMobile={isMobile} />
                <BackgroundMarquee />

                <div className={styles['hero-gradient']} />

                <div
                    className={styles['hero-content']}
                    style={{ transform: `translateY(${parallaxOffset}px)` }}
                >
                    {/* Background Glow for Readability */}
                    <div className={styles['hero-text-glow']} />

                    {/* Animated Logo */}
                    <div className={styles['hero-logo-wrap']}>
                        <div className={styles['hero-logo-rings']}>
                            <div className={`${styles['h-ring']} ${styles.r1}`} />
                            <div className={`${styles['h-ring']} ${styles.r2}`} />
                        </div>
                        <div className={styles['hero-logo-text']}>
                            <AppName size="large" />
                        </div>
                    </div>

                    <h1 className={styles['hero-title']}>
                        <span className={styles['title-line']}>More Than Just</span>
                        <span className={`${styles['title-line']} ${styles['italic-accent']}`}>Chat.</span>
                    </h1>

                    <p className={styles['hero-subtitle']}>
                        Elevengram brings people together through secure messaging, crystal-clear
                        calls & a modern experience that just works — everywhere.
                    </p>

                    <div className={styles['hero-actions']}>
                        {!isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.primary}`} onClick={handleLogin}>
                                <span>Open Web App</span>
                                <ChevronRight size={18} />
                            </button>
                        )}
                        {isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.secondary}`} onClick={handleDownloadAPK}>
                                <Download size={18} />
                                <span>Download APK</span>
                            </button>
                        )}
                    </div>

                    <div className={styles['hero-badges']}>
                        <span className={styles['badge-item']}>
                            <Shield size={14} />
                            Secure
                        </span>
                        <span className={styles['badge-item']}>
                            <Zap size={14} />
                            Fast
                        </span>
                        <span className={styles['badge-item']}>
                            <Globe size={14} />
                            Global
                        </span>
                        <span className={styles['badge-item']}>
                            <Layers size={14} />
                            Open Source
                        </span>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className={styles['scroll-indicator']}>
                    <span>Scroll to explore</span>
                    <div className={styles['scroll-arrow']} />
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════════════ */}
            <section className={styles['stats-section']} ref={statsRef}>
                <div className={styles['stats-grid']}>
                    {STATS.map((s, i) => (
                        <StatCard key={i} {...s} inView={statsInView} />
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════════════ */}
            <section className={styles['features-section']} id="features" ref={featuresRef}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['section-header']} ${featuresInView ? styles.animate : ''}`}>
                        <span className={styles['section-tag']}>Features</span>
                        <h2>Everything you need,<br />nothing you don't.</h2>
                        <p>
                            Elevengram packs powerful communication tools into a clean,
                            intuitive interface — designed for real people.
                        </p>
                    </div>

                    <div className={styles['features-grid']}>
                        {FEATURES.map((f, i) => (
                            <div
                                key={i}
                                className={`${styles['feature-card']} ${featuresInView ? styles.animate : ''} ${activeFeature === i ? styles.glow : ''}`}
                                style={{
                                    animationDelay: `${i * 0.06}s`,
                                    '--accent': f.color
                                }}
                                onMouseEnter={() => setActiveFeature(i)}
                            >
                                <div className={styles['feature-icon-wrap']}>
                                    <span className={styles['feature-icon']}>{f.icon}</span>
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                                <div className={styles['feature-shine']} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          ORIGIN STORY
          ═══════════════════════════════════════════════ */}
            <section className={styles['story-section']} id="story" ref={storyRef}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['story-content']} ${storyInView ? styles.animate : ''}`}>
                        <div className={styles['story-text']}>
                            <span className={styles['section-tag']}>Our Story</span>
                            <h2>Why "Elevengram"?</h2>
                            <div className={styles['story-quote']}>
                                <div className={styles['quote-mark']}>"</div>
                                <blockquote style={{ border: 'none', background: 'none', padding: 0 }}>
                                    <strong>Elevengram</strong> represents the <strong>11th Level</strong> of communication.
                                    While most tools stop at ten, we chose to go <em>beyond</em> — elevating every 
                                    <em> interaction</em>, every <em>connection</em>, and every <em>moment</em>.
                                </blockquote>
                            </div>
                            <p>
                                Elevengram represents that same warm, casual spirit of connecting with
                                the people who matter — but with a focus on taking those 
                                conversations to the next level of security and simplicity.
                            </p>
                            <p>
                                We believe communication should feel natural, personal, and
                                effortless. That's why every feature in Elevengram is built around
                                bringing people closer together through meaningful interactions.
                            </p>
                        </div>

                        <div className={styles['story-visual']}>
                            <div className={styles['story-card']}>
                                <div className={styles['story-emoji']}>
                                    <Sparkles size={48} className={styles['sparkle-icon']} />
                                </div>
                                <div className={styles['story-greeting']}>
                                    <span className={styles.bhojpuri}>Kaa Baa?</span>
                                    <span className={styles.english}>What's up?</span>
                                </div>
                                <div className={styles['story-arrow']}><ChevronRight size={24} /></div>
                                <div className={styles['story-brand']}>
                                    <img src="/pwa-192x192.png" alt="Elevengram" className={styles['story-logo']} />
                                    <AppName size="small" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════ */}
            <section className={styles['how-section']}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['section-header']} ${styles.animate}`}>
                        <span className={styles['section-tag']}>Simple</span>
                        <h2>Up and running in seconds</h2>
                    </div>

                    <div className={styles['steps-grid']}>
                        {[
                            { num: '01', title: 'Sign Up', desc: 'Create your account with email or phone — takes 30 seconds', icon: <UserPlus size={32} /> },
                            { num: '02', title: 'Add Contacts', desc: 'Find friends by phone, email, or scan their QR code instantly', icon: <QrCode size={32} /> },
                            { num: '03', title: 'Start Talking', desc: 'Send messages, make calls, share media — it just works', icon: <Send size={32} /> }
                        ].map((step, i) => (
                            <div key={i} className={styles['step-card']}>
                                <div className={styles['step-num']}>{step.num}</div>
                                <div className={styles['step-icon']}>{step.icon}</div>
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
            <section className={styles['tech-section']} id="tech" ref={techRef}>
                <div className={styles['section-inner']}>
                    <div className={`${styles['section-header']} ${techInView ? styles.animate : ''}`}>
                        <span className={styles['section-tag']}>Technology</span>
                        <h2>Built with the best</h2>
                        <p>Modern, battle-tested technologies powering every conversation.</p>
                    </div>

                    <div className={styles['tech-grid']}>
                        {TECH_STACK.map((t, i) => (
                            <div
                                key={i}
                                className={`${styles['tech-card']} ${techInView ? styles.animate : ''}`}
                                style={{ animationDelay: `${i * 0.1}s`, '--tc': t.color }}
                            >
                                <div className={styles['tech-dot']} style={{ background: t.color }} />
                                <span className={styles['tech-name']}>{t.name}</span>
                                <span className={styles['tech-ver']}>{t.version}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          SECURITY
          ═══════════════════════════════════════════════ */}
            <section className={styles['security-section']}>
                <div className={styles['section-inner']}>
                    <div className={styles['security-content']}>
                        <div className={styles['security-icon']}>
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
                        <div className={styles['security-badges']}>
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
            <section className={styles['cta-section']} id="download" ref={ctaRef}>
                <div className={`${styles['cta-content']} ${ctaInView ? styles.animate : ''}`}>
                    <h2>Ready to start talking?</h2>
                    <p>Join Elevengram today — it's free, open source, and built for everyone.</p>

                    <div className={styles['cta-buttons']}>
                        {!isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.primary} ${styles.large}`} onClick={handleLogin}>
                                Open Web App <ChevronRight size={20} />
                            </button>
                        )}
                        {isMobile && (
                            <button className={`${styles['btn-hero']} ${styles.secondary} ${styles.large}`} onClick={handleDownloadAPK}>
                                <Download size={20} />
                                <span>Download Android APK</span>
                            </button>
                        )}
                    </div>

                    <div className={styles['cta-note']}>
                        Free forever • No ads • Open source
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════ */}
            <footer className={styles['landing-footer']}>
                <div className={styles['footer-inner']}>
                    <div className={styles['footer-brand']}>
                        <img src="/pwa-192x192.png" alt="Elevengram" className={styles['footer-logo']} />
                        <div>
                            <AppName size="small" />
                            <span className={styles['footer-tagline']}>The Art of Conversation</span>
                        </div>
                    </div>

                    <div className={styles['footer-links']}>
                        <a href="https://github.com/mishra-aashu/caba-android-app" target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                        <button onClick={() => scrollTo('features')}>Features</button>
                        <button onClick={() => scrollTo('story')}>Story</button>
                        {!isMobile && <button onClick={handleLogin}>Web App</button>}
                    </div>

                    <div className={styles['footer-bottom']}>
                        <p>Thank you for choosing Elevengram for your communication needs.</p>
                        <p className={styles['footer-copyright']}>© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
                        <p className={styles['footer-license']}>MIT License • Open Source</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;