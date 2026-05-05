import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, User, History, Settings, Bell, Users, Gamepad2, Music } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useContacts } from '../../hooks/useCommonQueries';
import { supabase as supabaseClient } from '../../config/supabase';

const DesktopNavbar = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const location = useLocation();
  const { togglePanel } = useMusicStore();


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

  // Live game invite badge
  const [gameInviteCount, setGameInviteCount] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadCount = async () => {
      const { count } = await supabaseClient
        .from('game_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');
      if (!cancelled) setGameInviteCount(count || 0);
    };
    loadCount();
    const ch = supabaseClient
      .channel(`desktop_nav_game_invites_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_invitations',
        filter: `receiver_id=eq.${user.id}`,
      }, loadCount)
      .subscribe();
    return () => { cancelled = true; supabaseClient.removeChannel(ch); };
  }, [user?.id]);

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
          <li className="desktop-nav-item" style={{ position: 'relative' }}>
            <Link to="/games" className={`desktop-nav-link${location.pathname === '/games' ? ' active' : ''}`} data-tooltip="Game Hub">
              <Gamepad2 className="desktop-nav-icon" style={{ color: location.pathname === '/games' ? '#00a884' : undefined }} />
              {gameInviteCount > 0 && (
                <span className="nav-notif-dot" style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: '#ff4b4b', // Red dot for better visibility
                  borderRadius: '50%', width: '10px', height: '10px',
                  border: '2px solid #111',
                  boxShadow: '0 0 10px rgba(255, 75, 75, 0.5)',
                  animation: 'pulse 2s infinite'
                }} />
              )}
            </Link>
          </li>
          <li className="desktop-nav-item">
            <button 
              className="desktop-nav-link" 
              data-tooltip="Music Discovery"
              onClick={() => navigate('/listen-together')}
            >
              <Music className="desktop-nav-icon music-icon" />
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
