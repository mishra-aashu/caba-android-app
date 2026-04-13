import React from 'react';
import { User } from 'lucide-react';
import { getAvatarPath, getInitials } from '../../utils/stringUtils';

/**
 * Reusable Player Avatar component
 * Handles image avatars via ID/URL or fallback initials
 * 
 * @param {Object} props
 * @param {string|number} props.avatar - Avatar ID or URL
 * @param {string} props.name - Player name for initials fallback
 * @param {number} props.size - Icon size if no image
 * @param {string} props.className - Custom container class
 * @param {string} props.imgClassName - Custom image class
 */
const PlayerAvatar = ({ 
    avatar, 
    name, 
    size = 40, 
    className = "", 
    imgClassName = "" 
}) => {
    console.log("DEBUG: PlayerAvatar Rendered", { name, avatar });
    const avatarPath = getAvatarPath(avatar);
    const sizePx = typeof size === 'number' ? `${size}px` : size;

    return (
        <div 
            className={`player-avatar-container ${className}`}
            style={{ 
                width: sizePx, 
                height: sizePx, 
                minWidth: sizePx,
                minHeight: sizePx,
                flexShrink: 0,
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
            }}
        >
            {avatarPath ? (
                <img 
                    src={avatarPath} 
                    alt={name || "User"} 
                    className={`player-avatar-img ${imgClassName}`}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                    }}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.player-avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
                    }}
                />
            ) : null}
            
            <div 
                className="player-avatar-fallback"
                style={{ 
                    display: avatarPath ? 'none' : 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--input-bg, rgba(128, 128, 128, 0.1))'
                }}
            >
                {name ? (
                    <span 
                        className="avatar-initials"
                        style={{ fontSize: `calc(${sizePx} * 0.4)`, fontWeight: '700' }}
                    >
                        {getInitials(name)}
                    </span>
                ) : (
                    <User size={size * 0.6} />
                )}
            </div>
        </div>
    );
};

export default PlayerAvatar;
