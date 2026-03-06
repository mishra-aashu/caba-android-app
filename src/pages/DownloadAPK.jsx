import React from 'react';

const DownloadAPK = () => {
  const apkUrl = 'https://caba-messenger.vercel.app/app-release.apk';
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>Download CaBa Android App</h2>
      <p>Get the latest CaBa Android APK for the best experience on mobile.</p>
      <a
        href={apkUrl}
        style={{ display: 'inline-block', padding: '12px 20px', background: '#1e88e5', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}
        download
      >
        Download APK
      </a>
    </div>
  );
};

export default DownloadAPK;
