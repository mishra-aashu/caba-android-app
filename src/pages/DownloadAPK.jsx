import React from 'react';
import { useAppVersions } from '../hooks/useAppVersions';

const DownloadAPK = () => {
  const { data: versionData, isLoading } = useAppVersions();

  const apkUrl = versionData?.apk_download_url || null;
  const version = versionData?.latest_version || '';
  const releaseNotes = versionData?.release_notes || '';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d0d14', fontFamily: 'system-ui, sans-serif', padding: '24px'
    }}>
      <div style={{
        maxWidth: '420px', width: '100%', textAlign: 'center',
        background: '#13131f', border: '1px solid #2a2a3e',
        borderRadius: '16px', padding: '40px 32px'
      }}>
        {/* App icon removed to keep rebranding clean */}

        <h2 style={{ color: '#fff', margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>
          ELEVENGRAM
        </h2>
        <p style={{ color: '#666', margin: '0 0 4px', fontSize: '13px' }}>Android App</p>

        {version && (
          <span style={{
            display: 'inline-block', margin: '0 0 20px',
            padding: '3px 10px', background: '#1a1a2e',
            border: '1px solid #3a3a6e', borderRadius: '20px',
            color: '#7c8cf8', fontSize: '12px', fontWeight: 600
          }}>
            v{version}
          </span>
        )}

        {releaseNotes && (
          <p style={{
            color: '#888', fontSize: '13px', margin: '0 0 24px',
            padding: '12px', background: '#0a0a18',
            borderRadius: '8px', border: '1px solid #1e1e3e',
            textAlign: 'left'
          }}>
            {releaseNotes}
          </p>
        )}

        {isLoading ? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0' }}>⏳ Loading...</div>
        ) : apkUrl ? (
          <a
            href={apkUrl}
            download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#fff', borderRadius: '10px', textDecoration: 'none',
              fontWeight: 700, fontSize: '15px',
              boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
              transition: 'transform 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            ⬇ Download APK
          </a>
        ) : (
          <div style={{
            padding: '16px', background: '#1a1a0e',
            border: '1px solid #444420', borderRadius: '8px',
            color: '#aaa', fontSize: '13px'
          }}>
            🔧 APK link not set yet. Admin se APK URL set karwao.
          </div>
        )}

        <p style={{ color: '#444', fontSize: '11px', marginTop: '20px' }}>
          Android 7.0+ required • ~15 MB
        </p>
      </div>
    </div>
  );
};

export default DownloadAPK;
