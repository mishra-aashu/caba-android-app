import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Settings, QrCode, Users } from 'lucide-react';
import './BottomNavigation.css';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: MessageCircle, label: 'Chats' },
    { path: '/calls', icon: Phone, label: 'Calls' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/chat');
    }
    if (path === '/settings') {
      return location.pathname.startsWith('/settings') || location.pathname.startsWith('/profile');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottom-nav">
      {navItems.map(({ path, icon: Icon, label }) => (
        <button
          key={path}
          className={`nav-item ${isActive(path) ? 'active' : ''}`}
          onClick={() => navigate(path)}
        >
          <Icon size={20} />
          <span className="label">{label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNavigation;