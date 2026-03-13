import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DropdownMenu from './common/DropdownMenu';
import { MessageCircle, Phone, Settings, User, Search, MoreVertical, Plus, Bell, Info, HelpCircle, LogOut, Crown, X, Eye, EyeOff, ShieldCheck, Edit, Trash2, QrCode } from 'lucide-react';

const DesktopLayout = ({ chatListPanel, chatComponent, userDetailsPanel, particleOverlay }) => {
  const hasUserDetails = Boolean(userDetailsPanel);

  return (
    <div className={`desktop-layout ${hasUserDetails ? 'show-user-details' : ''}`} style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div className="chat-list-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {chatListPanel}
      </div>
      <div className="chat-detail" style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
        {chatComponent}
      </div>
      {hasUserDetails && (
        <div className="user-details-panel" style={{ height: '100%', overflow: 'hidden' }}>
          {userDetailsPanel}
        </div>
      )}
      {particleOverlay}
    </div>
  );
};

export default DesktopLayout;
