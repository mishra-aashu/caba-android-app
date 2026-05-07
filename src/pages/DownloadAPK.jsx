import React from 'react';
import { motion as m } from 'framer-motion';
import { 
  CloudDownload, ShieldCheck, Smartphone, Info, Loader2, AlertCircle, Sparkles 
} from 'lucide-react';
import { useAppVersions } from '../hooks/useAppVersions';
import './DownloadAPK.css';

const DownloadAPK = () => {
  const { data: versionData, isLoading } = useAppVersions();

  const apkUrl = versionData?.apk_download_url || null;
  const version = versionData?.latest_version || '';
  const releaseNotes = versionData?.release_notes || '';

  return (
    <div className="download-page">
      {/* Dynamic Background Blobs */}
      <div className="background-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <m.div 
        className="download-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="brand-section">
          <m.div 
            className="app-logo-placeholder"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Smartphone size={40} />
          </m.div>
          <h2 className="app-name">ELEVENGRAM</h2>
          <p className="app-subtitle">The Premium Experience</p>
          
          {version && (
            <m.div 
              className="version-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Sparkles size={14} />
              <span>Version {version}</span>
            </m.div>
          )}
        </div>

        {releaseNotes && (
          <m.div 
            className="release-notes"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="notes-header">What's New</div>
            <p className="notes-content">{releaseNotes}</p>
          </m.div>
        )}

        <div className="actions-section">
          {isLoading ? (
            <div className="loading-state">
              <Loader2 className="animate-spin" size={20} />
              <span>Fetching latest build...</span>
            </div>
          ) : apkUrl ? (
            <m.a
              href={apkUrl}
              download
              className="download-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <CloudDownload size={22} />
              <span>Download APK</span>
            </m.a>
          ) : (
            <div className="error-state">
              <AlertCircle size={20} style={{ marginBottom: '8px' }} />
              <div>APK link is not available yet. Please contact the administrator to set the download URL.</div>
            </div>
          )}
        </div>

        <m.div 
          className="footer-info"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="info-item">
            <Info size={14} />
            <span>Android 7.0+ required • ~15 MB</span>
          </div>
          
          <div className="security-check">
            <div className="security-badge">
              <ShieldCheck size={12} />
              <span>Scanned & Secure</span>
            </div>
          </div>
        </m.div>
      </m.div>
    </div>
  );
};

export default DownloadAPK;
