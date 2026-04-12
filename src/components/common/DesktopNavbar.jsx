import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, User, History, Settings, Bell, Users } from 'lucide-react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useContacts } from '../../hooks/useCommonQueries';

const DesktopNavbar = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const location = useLocation();

  // Use cached contacts hook
  const { data: contactsData } = useContacts(user?.id);

  // Normalize contacts data structure
  const savedContacts = React.useMemo(() => {
    return contactsData ? contactsData.map(c => ({
      ...c,
      otherUser: c.contact_user
    })) : [];
  }, [contactsData]);

  // Unused raw fetch removed in favor of useContacts hook

  // Clicking "Groups" button triggers inline view in sidebar
  const handleGroupsClick = () => {
    // If we're already on home, just add/update query param
    // Otherwise navigate to home with param
    if (location.pathname === '/') {
       const params = new URLSearchParams(location.search);
       params.set('view', 'create-group');
       navigate(`/?${params.toString()}`);
    } else {
       navigate('/?view=create-group');
    }
  };

  return (
    <>
      <nav className="desktop-navbar">
        <ul className="desktop-navbar-nav">
          <li className="desktop-nav-item">
            <Link to="/" className="desktop-nav-link" data-tooltip="Home">
              <Home className="desktop-nav-icon home-icon" />
            </Link>
          </li>
          <li className="desktop-nav-item">
            <button
              className="desktop-nav-link"
              data-tooltip="Create Group"
              onClick={handleGroupsClick}
            >
              <Users className="desktop-nav-icon groups-icon" />
            </button>
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
    </>
  );
};

export default DesktopNavbar;
