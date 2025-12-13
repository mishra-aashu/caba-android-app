import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Newspaper, Settings, QrCode } from 'lucide-react';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: MessageCircle, label: 'Chats' },
    { path: '/calls', icon: Phone, label: 'Calls' },
    { path: '/qr', icon: QrCode, label: 'QR Code' },
    { path: '/news', icon: Newspaper, label: 'News' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/chat');
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