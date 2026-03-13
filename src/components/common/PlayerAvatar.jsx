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

    return (
        <div className={`player-avatar-container ${className}`}>
            {avatarPath ? (
                <img 
                    src={avatarPath} 
                    alt={name || "User"} 
                    className={`player-avatar-img ${imgClassName}`}
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
            ) : null}
            
            <div 
                className="player-avatar-fallback"
                style={{ display: avatarPath ? 'none' : 'flex' }}
            >
                {name ? (
                    <span className="avatar-initials">{getInitials(name)}</span>
                ) : (
                    <User size={size} />
                )}
            </div>
        </div>
    );
};

export default PlayerAvatar;
