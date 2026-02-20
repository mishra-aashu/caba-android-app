import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const AdminAbout = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-page-wrapper">
      <div className="legal-page-container">
        {/* Header with Back Button */}
        <div className="legal-page-header">
          <button className="legal-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
        </div>

        <h1>About CaBa Chat</h1>
        <p><em>Created with ❤️ by Aashu Mishra</em></p>

        <h2>Our Story</h2>
        <p>
          CaBa Chat was born from a simple idea: to create a messaging app that feels personal, 
          secure, and beautifully designed. We believe that communication should be both 
          private and delightful.
        </p>

        <h2>Meet the Developer</h2>
        <p>
          Hi! I'm <strong>Aashu Mishra</strong>, the creator of CaBa Chat. I'm a passionate 
          developer who loves building apps that bring people together. This project is a 
          labor of love, crafted with attention to detail and a focus on user experience.
        </p>

        <h2>Features</h2>
        <ul>
          <li>End-to-end encrypted messaging</li>
          <li>Beautiful, modern UI design</li>
          <li>Group chat support</li>
          <li>Voice messages</li>
          <li>Media sharing (images, videos)</li>
          <li>Real-time messaging</li>
          <li>And much more!</li>
        </ul>

        <h2>Technology Stack</h2>
        <p>
          CaBa Chat is built with modern technologies:
        </p>
        <ul>
          <li>React - Frontend framework</li>
          <li>Supabase - Backend & real-time database</li>
          <li>Firebase - Authentication & notifications</li>
          <li>Capacitor - Cross-platform mobile app</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Have questions, feedback, or want to contribute? We'd love to hear from you! 
          Feel free to reach out through the app's support feature.
        </p>

        <h2>Thank You!</h2>
        <p>
          Thank you for using CaBa Chat! Your support means the world to us. 
          We're constantly working to improve and add new features, so stay tuned!
        </p>
      </div>
    </div>
  );
};

export default AdminAbout;
