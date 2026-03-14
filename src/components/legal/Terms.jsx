import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LegalPlaceholder = ({ title, children, isSidebar = false }) => {
  const navigate = useNavigate();
  return (
    <div className={`legal-page-container ${isSidebar ? 'is-sidebar' : ''}`}>
      {/* Header with Back Button */}
      <div className="legal-page-header">
        <button className="legal-back-btn" onClick={() => isSidebar ? navigate('/settings') : navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
      </div>
      
      <div className="disclaimer-box">
        <p>DISCLAIMER: This is a placeholder document.</p>
        <p>The text below is not legally binding. You MUST replace it with your own official Terms and Conditions, drafted by a legal professional.</p>
      </div>
      <h1>{title} for Elevengram</h1>
      <p><em>Last updated: March 11, 2026</em></p>
      {children}
      
      <div className="legal-footer">
        <p>Thank you for choosing Elevengram for your communication needs.</p>
        <p className="copyright">© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
      </div>
    </div>
  );
};

const Terms = ({ isSidebar = false }) => {
  return (
    <LegalPlaceholder title="Terms and Conditions" isSidebar={isSidebar}>
      <h2>1. Introduction</h2>
      <p>
        Welcome to Elevengram ("we", "our", "us"). These Terms and Conditions govern your use of our chat application. By using our app, you agree to these terms in full. If you disagree with these terms or any part of these terms, you must not use our application.
      </p>

      <h2>2. License to Use Application</h2>
      <p>
        Unless otherwise stated, we or our licensors own the intellectual property rights in the application and material on the application. Subject to the license below, all these intellectual property rights are reserved.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You must not use this application in any way that causes, or may cause, damage to the application or impairment of the availability or accessibility of the application; or in any way which is unlawful, illegal, fraudulent, or harmful.
      </p>
      
      <h2>4. User Content</h2>
      <p>
        In these terms and conditions, "your user content" means material (including without limitation text, images, audio material, video material) that you submit to our application, for whatever purpose. You grant to us a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, adapt, publish, translate and distribute your user content in any existing or future media.
      </p>

      <h2>5. Limitations of Liability</h2>
      <p>
        The information on this application is provided "as is" without any representations or warranties, express or implied. We will not be liable to you in relation to the contents of, or use of, or otherwise in connection with, this application for any indirect, special or consequential loss.
      </p>
    </LegalPlaceholder>
  );
};

export default Terms;
