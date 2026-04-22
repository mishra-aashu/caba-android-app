/**
 * APKUpdateModal.jsx
 *
 * Shows an update prompt when the installed APK version is outdated.
 *
 * Two modes:
 *  - FORCE  (app < min_required_version) → non-dismissible, user MUST update
 *  - SOFT   (app < latest_version)       → dismissible, "Remind Me Later"
 *
 * Only renders on native Android (Capacitor). No-op on web.
 */
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../utils/platformCheck';
import { useAppVersions } from '../hooks/useAppVersions';
import { isOlderVersion } from '../utils/versionUtils';

// The version baked into this APK build (set by package.json at build time)
const CURRENT_APP_VERSION = __APP_VERSION__;   // injected by vite.config.js define

const APKUpdateModal = () => {
  const [dismissed, setDismissed] = useState(false);
  const { data: versionData } = useAppVersions();

  // Only active on native Android
  if (!isNativeWithPlugins() || dismissed) return null;
  if (!versionData) return null;

  const { latest_version, min_required_version, apk_download_url, release_notes } = versionData;

  const needsForceUpdate = isOlderVersion(CURRENT_APP_VERSION, min_required_version);
  const needsSoftUpdate  = !needsForceUpdate && isOlderVersion(CURRENT_APP_VERSION, latest_version);

  if (!needsForceUpdate && !needsSoftUpdate) return null;

  const handleDownload = () => {
    if (apk_download_url) window.open(apk_download_url, '_blank');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      // Force update: dark full overlay; soft: semi-transparent
      background: needsForceUpdate
        ? 'rgba(0,0,0,0.92)'
        : 'rgba(0,0,0,0.70)',
    }}>
      {/* Sheet */}
      <div style={{
        width: '100%', maxWidth: '480px',
        background: '#13131f',
        borderRadius: '24px 24px 0 0',
        border: '1px solid #2a2a4e',
        padding: '28px 24px 40px',
        boxShadow: '0 -8px 60px rgba(0, 168, 132, 0.25)',
        animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Drag handle */}
        <div style={{
          width: '36px', height: '4px', borderRadius: '2px',
          background: '#333', margin: '0 auto 24px'
        }} />

        {/* Icon + badge */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '68px', height: '68px', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #00a884, #00876a)',
            borderRadius: '20px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '34px',
            boxShadow: '0 8px 32px rgba(0, 168, 132, 0.45)'
          }}>📱</div>

          <span style={{
            display: 'inline-block',
            padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.5px', textTransform: 'uppercase',
            background: needsForceUpdate ? '#3a0a0a' : '#0a2a1a',
            border: `1.5px solid ${needsForceUpdate ? '#ff4444' : '#00a884'}`,
            color: needsForceUpdate ? '#ff6b6b' : '#00a884',
          }}>
            {needsForceUpdate ? '🚨 Critical Update Required' : '✨ New Version Available'}
          </span>
        </div>

        {/* Title */}
        <h2 style={{
          color: '#fff', textAlign: 'center', margin: '0 0 8px',
          fontSize: '20px', fontWeight: 700
        }}>
          {needsForceUpdate
            ? 'App Update Required'
            : 'Update Available 🎉'}
        </h2>

        {/* Version pill */}
        <p style={{ textAlign: 'center', margin: '0 0 16px' }}>
          <span style={{ color: '#555', fontSize: '13px' }}>
            {CURRENT_APP_VERSION}
          </span>
          <span style={{ color: '#444', margin: '0 8px' }}>→</span>
          <span style={{
            color: '#3fcf8e', fontWeight: 700, fontSize: '14px'
          }}>{latest_version}</span>
        </p>

        {/* Description */}
        <p style={{
          color: needsForceUpdate ? '#ff9999' : '#aaa',
          textAlign: 'center', margin: '0 0 16px',
          fontSize: '14px', lineHeight: 1.5
        }}>
          {needsForceUpdate
            ? 'This version is no longer supported. Please update to continue using ELEVENGRAM.'
            : 'A newer version of ELEVENGRAM is available with improvements and bug fixes.'}
        </p>

        {/* Release notes */}
        {release_notes && (
          <div style={{
            padding: '12px 14px', background: '#0d1a14',
            borderRadius: '10px', border: '1px solid #1a2a1e',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#666', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>What&apos;s New</p>
            <p style={{ color: '#bbb', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{release_notes}</p>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleDownload}
            disabled={!apk_download_url}
            style={{
              padding: '15px', borderRadius: '12px', border: 'none',
              background: apk_download_url
                ? 'linear-gradient(135deg, #00a884, #00876a)'
                : '#1a2a1e',
              color: apk_download_url ? '#fff' : '#666',
              fontWeight: 700, fontSize: '15px', cursor: apk_download_url ? 'pointer' : 'not-allowed',
              boxShadow: apk_download_url ? '0 4px 20px rgba(0, 168, 132, 0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            ⬇ Download Update{latest_version ? ` (v${latest_version})` : ''}
          </button>

          {!needsForceUpdate && (
            <button
              onClick={() => setDismissed(true)}
              style={{
                padding: '13px', borderRadius: '12px',
                background: 'transparent', border: '1px solid #2a2a4e',
                color: '#555', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
              }}
            >
              Remind Me Later
            </button>
          )}
        </div>

        {!apk_download_url && (
          <p style={{ color: '#444', fontSize: '11px', textAlign: 'center', marginTop: '10px' }}>
            Download link not available yet. Check back soon.
          </p>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default APKUpdateModal;
