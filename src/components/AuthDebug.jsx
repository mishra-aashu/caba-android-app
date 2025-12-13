import React from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthDebug = () => {
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuth();

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '320px',
      maxHeight: '400px',
      overflow: 'auto'
    }}>
      <div><strong>Auth Debug</strong></div>
      <div>✅ User: {authUser?.name || 'None'}</div>
      <div>⏳ Loading: {authLoading ? 'Yes' : 'No'}</div>
      <div>🔑 Auth: {isAuthenticated ? 'Yes' : 'No'}</div>
      <div>🆔 User ID: {authUser?.id ? authUser.id.substring(0, 8) + '...' : 'None'}</div>
      <div>📧 Email: {authUser?.email || 'None'}</div>
      <div>📱 Phone: {authUser?.phone || 'None'}</div>
      <hr style={{ margin: '5px 0' }} />
      <div>🎫 Session: {isAuthenticated ? 'Active' : 'None'}</div>
      <div>🔑 Token: {isAuthenticated ? 'Present' : 'None'}</div>
      
      {isAuthenticated && (
        <>
          <hr style={{ margin: '5px 0' }} />
          <div style={{ color: '#4CAF50' }}>✅ Phone Login Active</div>
          <div style={{ fontSize: '10px' }}>
            Database-based authentication
          </div>
        </>
      )}
    </div>
  );
};

export default AuthDebug;
