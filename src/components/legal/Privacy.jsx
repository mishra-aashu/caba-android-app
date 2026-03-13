import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const LegalPlaceholder = ({ title, children }) => {
  const navigate = useNavigate();
  return (
    <div className="legal-page-container">
      {/* Header with Back Button */}
      <div className="legal-page-header">
        <button className="legal-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
      </div>
      
      <div className="disclaimer-box">
        <p>DISCLAIMER: This is a placeholder document.</p>
        <p>The text below is not legally binding. You MUST replace it with your own official Privacy Policy, drafted by a legal professional.</p>
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

const Privacy = () => {
  return (
    <LegalPlaceholder title="Privacy Policy">
      <h2>1. Information We Collect</h2>
      <p>
        We may collect personal identification information from Users in a variety of ways, including, but not limited to, when Users visit our app, register on the app, and in connection with other activities, services, features or resources we make available on our App. Users may be asked for, as appropriate, name, email address, phone number.
      </p>

      <h2>2. How We Use Collected Information</h2>
      <p>
        Elevengram may collect and use Users' personal information for the following purposes:
        <ul>
            <li>To run and operate our App: We may need your information to display content on the App correctly.</li>
            <li>To personalize user experience: We may use information in the aggregate to understand how our Users as a group use the services and resources provided on our App.</li>
            <li>To send periodic emails: We may use the email address to send User information and updates pertaining to their order.</li>
        </ul>
      </p>

      <h2>3. How We Protect Your Information</h2>
      <p>
        We adopt appropriate data collection, storage and processing practices and security measures to protect against unauthorized access, alteration, disclosure or destruction of your personal information, username, password, transaction information and data stored on our App.
      </p>
      
      <h2>4. Sharing Your Personal Information</h2>
      <p>
        We do not sell, trade, or rent Users' personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners, trusted affiliates and advertisers for the purposes outlined above.
      </p>

      <h2>5. Your Acceptance of These Terms</h2>
      <p>
        By using this App, you signify your acceptance of this policy. If you do not agree to this policy, please do not use our App. Your continued use of the App following the posting of changes to this policy will be deemed your acceptance of those changes.
      </p>
    </LegalPlaceholder>
  );
};

export default Privacy;
