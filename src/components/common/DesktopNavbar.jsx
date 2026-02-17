import React from 'react';
import { Link } from 'react-router-dom';
import { Home, User, History, Settings, Bell, QrCode, Newspaper, Shield } from 'lucide-react';

const DesktopNavbar = () => {
  return (
    <nav className="desktop-navbar">
      <ul className="desktop-navbar-nav">
        <li className="desktop-nav-item">
          <Link to="/" className="desktop-nav-link" data-tooltip="Home">
            <Home className="desktop-nav-icon home-icon" />
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/profile" className="desktop-nav-link" data-tooltip="Profile">
            <User className="desktop-nav-icon profile-nav-icon" />
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/history" className="desktop-nav-link" data-tooltip="Call History">
            <History className="desktop-nav-icon history-icon" />
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/reminders" className="desktop-nav-link" data-tooltip="Reminders">
            <Bell className="desktop-nav-icon reminders-nav-icon" />
          </Link>
        </li>
        <li className="desktop-nav-item">
          <Link to="/settings" className="desktop-nav-link" data-tooltip="Settings">
            <Settings className="desktop-nav-icon settings-nav-icon" />
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default DesktopNavbar;
