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

const Privacy = ({ isSidebar = false }) => {
  return (
    <LegalPlaceholder title="Privacy Policy" isSidebar={isSidebar}>
      <h2>1. Information We Collect</h2>
      <p>
        We collect information to provide better services to all our users. The types of information we collect include:
        <ul>
          <li><strong>Account Information:</strong> Your phone number and profile information (name, avatar) provided during registration.</li>
          <li><strong>Messages:</strong> We process your messages, images, and other content to deliver them to your intended recipients. </li>
          <li><strong>Usage Data:</strong> Information about how you use the Application, such as session duration, features used, and interaction patterns.</li>
          <li><strong>Device Information:</strong> We collect information about the device you use to access Elevengram, including hardware model, operating system, and unique device identifiers.</li>
        </ul>
      </p>

      <h2>2. How We Use Information</h2>
      <p>
        We use the information we collect for the following purposes:
        <ul>
          <li>To provide, maintain, and improve our services.</li>
          <li>To protect the security and integrity of our Application and users.</li>
          <li>To communicate with you about service updates and security alerts.</li>
          <li>To personalize your experience within the Application.</li>
        </ul>
      </p>

      <h2>3. Data Storage & Security</h2>
      <p>
        We take the security of your data seriously. We use industry-standard encryption and security measures to protect your information from unauthorized access, loss, or misuse. Your data is stored securely using cloud infrastructure provided by Supabase and PostgreSQL.
      </p>
      
      <h2>4. Data Retention & Deletion</h2>
      <p>
        We retain your personal information for as long as your account is active or as needed to provide you with the services. You can delete your account and associated data at any time through the Application settings. Once deleted, your data will be removed from our active databases, though some metadata may remain in encrypted backups for a limited period.
      </p>

      <h2>5. Sharing of Information</h2>
      <p>
        We do not sell your personal information to third parties. We may share information with service providers who perform services on our behalf (e.g., cloud hosting, authentication services) under strict confidentiality agreements.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        Depending on your location, you may have certain rights regarding your personal data, including the right to access, correct, or delete your information. You can exercise these rights directly within the Application settings or by contacting our support team.
      </p>

      <h2>7. Changes to This Policy</h2>
      <p>
        We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy, please contact us at support@elevengram.com.
      </p>
    </LegalPlaceholder>
  );
};

export default Privacy;
