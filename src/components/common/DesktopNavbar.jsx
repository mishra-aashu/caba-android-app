import React from 'react';
import { Link } from 'react-router-dom';
import { Home, User, History, Settings, Bell, QrCode, Newspaper, Shield } from 'lucide-react';

const DesktopNavbar = () => {
  return (
    <nav className="desktop-navbar">
      <ul className="desktop-navbar-nav">
        <li className="desktop-nav-item">
          <Link to="/" className="desktop-nav-link">
            <Home className="desktop-nav-icon" />
            <span className="desktop-nav-text">Home</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/profile" className="desktop-nav-link">
            <User className="desktop-nav-icon" />
            <span className="desktop-nav-text">Profile</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/history" className="desktop-nav-link">
            <History className="desktop-nav-icon" />
            <span className="desktop-nav-text">History</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/reminders" className="desktop-nav-link">
            <Bell className="desktop-nav-icon" />
            <span className="desktop-nav-text">Reminders</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/news" className="desktop-nav-link">
            <Newspaper className="desktop-nav-icon" />
            <span className="desktop-nav-text">News</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/qr" className="desktop-nav-link">
            <QrCode className="desktop-nav-icon" />
            <span className="desktop-nav-text">QR</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/settings" className="desktop-nav-link">
            <Settings className="desktop-nav-icon" />
            <span className="desktop-nav-text">Settings</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/blocked" className="desktop-nav-link">
            <Shield className="desktop-nav-icon" />
            <span className="desktop-nav-text">Blocked</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default DesktopNavbar;
