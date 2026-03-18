import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LegalPlaceholder = ({ title, children, isSidebar = false }) => {
  const navigate = useNavigate();
  return (
    <div className={`legal-page-wrapper ${isSidebar ? 'is-sidebar-view' : ''}`}>
      <div className={`legal-page-container ${isSidebar ? 'is-sidebar' : ''}`}>
        {/* Header with Back Button */}
        <div className="legal-page-header">
          <button className="legal-back-btn" onClick={() => isSidebar ? navigate('/settings') : navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div className="legal-header-content">
            <h1>{title}</h1>
            <p className="last-updated">Last updated: March 11, 2026</p>
          </div>
        </div>
        
        <div className="legal-content-body">
          {children}
        </div>
        
        <div className="legal-footer">
          <p>Thank you for choosing Elevengram for your communication needs.</p>
          <p className="copyright">© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

const Terms = ({ isSidebar = false }) => {
  return (
    <LegalPlaceholder title="Terms and Conditions" isSidebar={isSidebar}>
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Elevengram ("the Application"), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, you must not use our Application.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years of age (or the minimum age required in your country) to use Elevengram. By using the Application, you represent and warrant that you meet these eligibility requirements.
      </p>

      <h2>3. User Accounts & Security</h2>
      <p>
        To use certain features, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
      </p>

      <h2>4. License to Use</h2>
      <p>
        We grant you a personal, worldwide, royalty-free, non-assignable, and non-exclusive license to use the Application for personal, non-commercial communication. This license is for the sole purpose of enabling you to use and enjoy the benefit of the services provided by Elevengram.
      </p>

      <h2>5. Acceptable Use Policy</h2>
      <p>
        You agree not to use the Application to:
        <ul>
          <li>Send unauthorized commercial communications (spam).</li>
          <li>Engage in harassment, bullying, or intimidation of other users.</li>
          <li>Distribute illegal, harmful, or offensive content.</li>
          <li>Reverse engineer or attempt to extract the source code of the Application.</li>
          <li>Interfere with or disrupt the integrity or performance of the Application.</li>
        </ul>
      </p>
      
      <h2>6. User Content</h2>
      <p>
        You retain ownership of the content you transmit through Elevengram. By using the Application, you grant Elevengram a limited license to facilitate the delivery, storage, and processing of your content as necessary to provide the service. We do not claim ownership of your personal messages.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        The Application, including its original content, features, and functionality, are and will remain the exclusive property of Elevengram and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may terminate or suspend your account and bar access to the Application immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including without limitation a breach of the Terms.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        In no event shall Elevengram, nor its directors, employees, or partners, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, or other intangible losses, resulting from your access to or use of the Application.
      </p>

      <h2>10. Disclaimer of Warranties</h2>
      <p>
        Your use of the Application is at your sole risk. The Application is provided on an "AS IS" and "AS AVAILABLE" basis, without warranties of any kind, whether express or implied.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any legal action or proceeding related to your access to or use of the Application shall be instituted in the courts of Chennai, Tamil Nadu.
      </p>
    </LegalPlaceholder>
  );
};

export default Terms;
