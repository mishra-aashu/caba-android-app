import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import styles from './LinkPreview.module.css';
import { ExternalLink } from 'lucide-react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const extractUrls = (text) => {
  if (!text) return [];
  return text.match(URL_REGEX) || [];
};

const LinkPreview = ({ url }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPreview = async () => {
      try {
        setLoading(true);
        // Assuming the edge function is deployed and accessible via Supabase
        const { data, error } = await supabase.functions.invoke('link-preview', {
          body: { url }
        });

        if (error) throw error;
        
        if (isMounted && data) {
          setPreview(data);
        }
      } catch (err) {
        console.error('Failed to fetch link preview:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (error || (!loading && (!preview || (!preview.title && !preview.image)))) {
    return null;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles['link-preview-container']}>
      {loading ? (
        <div className={styles['preview-skeleton']}>
          <div className={styles['skeleton-img']} />
          <div className={styles['skeleton-text']}>
            <div className={styles['skeleton-title']} />
            <div className={styles['skeleton-desc']} />
          </div>
        </div>
      ) : (
        <>
          {preview.image && (
            <div className={styles['preview-image']}>
              <img src={preview.image} alt={preview.title || 'Link preview'} loading="lazy" />
            </div>
          )}
          <div className={styles['preview-content']}>
            <div className={styles['preview-title']}>{preview.title || preview.domain}</div>
            {preview.description && (
              <div className={styles['preview-description']}>{preview.description}</div>
            )}
            <div className={styles['preview-domain']}>
              <ExternalLink size={12} />
              <span>{preview.domain}</span>
            </div>
          </div>
        </>
      )}
    </a>
  );
};

export default LinkPreview;
