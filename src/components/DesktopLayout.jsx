import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DropdownMenu from './common/DropdownMenu';
import { MessageCircle, Phone, Settings, User, Search, MoreVertical, Plus, Bell, Info, HelpCircle, LogOut, Crown, X, Eye, EyeOff, ShieldCheck, Edit, Trash2, QrCode } from 'lucide-react';

const DesktopLayout = ({ chatListPanel, chatComponent, userDetailsPanel, particleOverlay }) => {
  const hasUserDetails = Boolean(userDetailsPanel);

  return (
    <div className={`desktop-layout ${hasUserDetails ? 'show-user-details' : ''}`}>
      <div className="chat-list-panel">
        {chatListPanel}
      </div>
      <div className="chat-detail">
        {chatComponent}
      </div>
      {hasUserDetails && (
        <div className="user-details-panel">
          {userDetailsPanel}
        </div>
      )}
      {particleOverlay}
    </div>
  );
};

export default DesktopLayout;
