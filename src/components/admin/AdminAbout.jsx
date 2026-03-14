import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Shield, Rocket, 
  Layers, Mail, Code, CheckCircle 
} from 'lucide-react';
import styles from './AdminAbout.module.css';

const AdminAbout = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.pageContainer}>
      {/* Dynamic Background */}
      <div className={`${styles.ambientGlow} ${styles.glow1}`}></div>
      <div className={`${styles.ambientGlow} ${styles.glow2}`}></div>

      <div className={styles.contentWrapper}>
        <div className={styles.backHeader}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} title="Go Back">
            <ArrowLeft size={20} />
          </button>
        </div>

        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>ELEVENGRAM</h1>
          <p className={styles.authorTag}>
            Created with <Heart size={16} fill="#ff4b2b" style={{ color: '#ff4b2b', margin: '0 4px', filter: 'drop-shadow(0 0 5px #ff4b2b)' }} /> 
            by Aashutosh Mishra | IIT Madras
          </p>
        </section>

        <div className={styles.grid}>
          {/* Card 0 */}
          <section className={styles.glassCard} style={{ '--index': 0 }}>
            <div className={styles.cardIcon}><Rocket /></div>
            <h2>Our Story</h2>
            <p>
              ELEVENGRAM was born from a simple idea: to create a messaging app that feels personal, 
              secure, and beautifully designed. We believe that communication should be both 
              private and delightful.
            </p>
          </section>

          {/* Card 1 */}
          <section className={styles.glassCard} style={{ '--index': 1 }}>
            <div className={styles.cardIcon}><Code /></div>
            <h2>The Developer</h2>
            <p>
              I'm <strong>Aashutosh Mishra</strong>, an IIT Madras student and the creator of ELEVENGRAM. This project is a 
              labor of love, crafted with obsessive attention to detail. Every pixel is aimed 
              at bringing people together beautifully.
            </p>
          </section>

          {/* Card 2 */}
          <section className={`${styles.glassCard} ${styles.wideCard}`} style={{ '--index': 2 }}>
            <div className={styles.cardIcon}><Layers /></div>
            <h2>Experience the Difference</h2>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}><CheckCircle size={16} /> End-to-end encryption</li>
              <li className={styles.featureItem}><CheckCircle size={16} /> High-fidelity WebRTC calls</li>
              <li className={styles.featureItem}><CheckCircle size={16} /> Ultra-fast real-time messaging</li>
              <li className={styles.featureItem}><CheckCircle size={16} /> Fluid, elite animations</li>
              <li className={styles.featureItem}><CheckCircle size={16} /> Seamless media sharing</li>
              <li className={styles.featureItem}><CheckCircle size={16} /> Cross-platform perfection</li>
            </ul>
          </section>

          {/* Card 3 */}
          <section className={styles.glassCard} style={{ '--index': 3 }}>
            <div className={styles.cardIcon}><Shield /></div>
            <h2>Security First</h2>
            <p>Built with world-class encryption technologies for maximum privacy & scale.</p>
            <div className={styles.techTags}>
              <span className={styles.tag}>React 19</span>
              <span className={styles.tag}>Supabase</span>
              <span className={styles.tag}>WebRTC</span>
            </div>
          </section>

          {/* Card 4 */}
          <section className={styles.glassCard} style={{ '--index': 4 }}>
            <div className={styles.cardIcon}><Mail /></div>
            <h2>Get in Touch</h2>
            <p>
              Have questions or feedback? I'd love to hear from you. 
              Let's build the future of messaging together.
            </p>
          </section>
        </div>

        <footer className={styles.footer}>
          <p className={styles.thanksNote}>Thank you for choosing Elevengram for your communication needs.</p>
          <p className={styles.copyright}>© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AdminAbout;
