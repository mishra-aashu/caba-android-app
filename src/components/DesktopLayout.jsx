import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DropdownMenu from './common/DropdownMenu';
import { MessageCircle, Phone, Newspaper, Settings, User, Search, MoreVertical, Plus, Bell, Info, HelpCircle, LogOut, Crown, X, Eye, EyeOff, ShieldCheck, Edit, Trash2, QrCode } from 'lucide-react';

const DesktopLayout = ({ chatListPanel, chatComponent }) => {
  return (
    <div className="desktop-layout">
      <div className="chat-list-panel">
        {chatListPanel}
      </div>
      <div className="chat-detail">
        {chatComponent}
      </div>
    </div>
  );
};

export default DesktopLayout;
