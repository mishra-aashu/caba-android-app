import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, User, History, Settings, Bell, Users } from 'lucide-react';
import CreateGroupModal from '../groups/CreateGroupModal';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';

const DesktopNavbar = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [savedContacts, setSavedContacts] = useState([]);

  // Fetch saved contacts when modal opens
  useEffect(() => {
    if (showCreateGroupModal && user?.id) {
      fetchContacts();
    }
  }, [showCreateGroupModal, user?.id]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          user_id,
          contact_user_id,
          contact_name,
          is_favorite,
          created_at,
          otherUser:contact_user_id (id, name, phone, avatar, is_online)
        `)
        .eq('user_id', user.id);
      
      if (error) throw error;
      setSavedContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  // Clicking "Groups" button opens Create Group Modal
  const handleGroupsClick = () => {
    setShowCreateGroupModal(true);
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
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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

      {/* Create Group Modal - Opens when Groups button is clicked */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={() => {
          setShowCreateGroupModal(false);
          navigate('/');
        }}
        savedContacts={savedContacts}
      />
    </>
  );
};

export default DesktopNavbar;
