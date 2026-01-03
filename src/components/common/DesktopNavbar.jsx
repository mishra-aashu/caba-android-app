import React from 'react';
import { Link } from 'react-router-dom';
import { Home, User, History, Settings, Bell, QrCode, Newspaper, Shield } from 'lucide-react';

const DesktopNavbar = () => {
  return (
    <nav className="desktop-navbar">
      <ul className="desktop-navbar-nav">
        <li className="desktop-nav-item">
          <Link to="/" className="desktop-nav-link">
            <Home className="desktop-nav-icon home-icon" />
            <span className="desktop-nav-text">Home</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/profile" className="desktop-nav-link">
            <User className="desktop-nav-icon profile-nav-icon" />
            <span className="desktop-nav-text">Profile</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/history" className="desktop-nav-link">
            <History className="desktop-nav-icon history-icon" />
            <span className="desktop-nav-text">History</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/reminders" className="desktop-nav-link">
            <Bell className="desktop-nav-icon reminders-nav-icon" />
            <span className="desktop-nav-text">Reminders</span>
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/settings" className="desktop-nav-link">
            <Settings className="desktop-nav-icon settings-nav-icon" />
            <span className="desktop-nav-text">Settings</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default DesktopNavbar;
