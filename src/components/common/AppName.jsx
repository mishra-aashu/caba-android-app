import React from 'react';
import './AppName.css';

const AppName = ({ className = '', size = 'medium' }) => {
  return (
    <div className={`brand-badge-pill ${size} ${className} gpu-accelerated`}>
      ELEVENGRAM
    </div>
  );
};

export default AppName;
