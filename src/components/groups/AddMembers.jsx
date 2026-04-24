/**
 * AddMembers - Standalone component for searching & adding new people to group
 * Used in both Modal and Sidebar views
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAddMembers } from '../../hooks/useGroupActions';
import { useContacts } from '../../hooks/useCommonQueries';
import { useSupabase } from '../../contexts/SupabaseContext';
import { Search, Check, X, ArrowLeft, Users, UserPlus, LoaderCircle, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveAvatarUrl } from '../../utils/avatarHelpers';
import { getInitials } from '../../utils/stringUtils';
import { dpOptions } from '../../utils/dpOptions';
import { safeDbConversion } from '../../utils/dbFieldMapping';
import './AddMembers.css';

const AddMembers = ({ 
    groupId, 
    existingMemberIds = [], 
    onSuccess, 
    onClose,
    isSidebar = false,
    title = "Add Participants"
}) => {
    useEffect(() => {
        console.log(`[AddMembers] Component mounted for groupId: ${groupId}`);
    }, [groupId]);

    const { user } = useAuth();
    const { supabase } = useSupabase();
    const { data: supabaseContacts } = useContacts(user?.id);
    const cachedContacts = useLiveQuery(() => db.contacts.toArray()) || [];
    const addMembersMutation = useAddMembers();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [globalResults, setGlobalResults] = useState([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

    // Sync contacts to Dexie in background
    useEffect(() => {
        if (supabaseContacts && supabaseContacts.length > 0) {
            const syncToDexie = async () => {
                try {
                    const formatted = supabaseContacts.map((c) => {
                        const userObj = c.contactUser || c.contact_user || c.otherUser || c.other_user;
                        return {
                            id: c.id,
                            contactName: c.contactName || c.contact_name,
                            otherUser: userObj,
                            avatar: userObj?.avatar,
                            contactUserId: c.contactUserId || c.contact_user_id,
                            userId: c.userId || c.user_id,
                            isFavorite: c.isFavorite || c.is_favorite,
                        };
                    });
                    await db.transaction('rw', db.contacts, async () => {
                        await db.contacts.clear();
                        await db.contacts.bulkPut(formatted);
                    });
                } catch (err) {
                    console.error('[AddMembers] Sync failed:', err);
                }
            };
            syncToDexie();
        }
    }, [supabaseContacts]);

    // Derived contacts list from cache, filtering out existing members and current user
    const contacts = useMemo(() => {
        return (cachedContacts || [])
            .map(c => {
                const userData = c.otherUser || c.contact_user || c.contactUser || {};
                
                // Handle avatar mapping
                let avatarUrl = userData?.avatar || userData?.avatar_url || null;
                if (avatarUrl && !isNaN(parseInt(avatarUrl)) && parseInt(avatarUrl) < 100) {
                    const dp = dpOptions.find(dp => dp.id === parseInt(avatarUrl));
                    avatarUrl = dp?.path || avatarUrl;
                }

                const phone = userData?.phone || 
                              userData?.phone_number || 
                              userData?.phoneNumber || 
                              '';

                const about = userData?.about || 
                              userData?.status || 
                              (phone ? '' : 'Hey there! I am using ELEVENGRAM');

                const userId = c.contactUserId || userData?.id;

                return {
                    id: userId, // This must be the actual user UUID
                    name: c.contactName || userData?.name || phone || 'Unknown',
                    avatar: avatarUrl,
                    phone: phone || about,
                    is_online: userData?.is_online || false,
                };
            })
            .filter(c => 
                c.id && 
                c.id !== user?.id && 
                !existingMemberIds.includes(c.id)
            );
    }, [cachedContacts, existingMemberIds, user?.id]);

    // Filter contacts by search
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        
        const query = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name?.toLowerCase().includes(query) ||
            contact.phone?.toLowerCase().includes(query)
        );
    }, [contacts, searchQuery]);

    // Global User Search Logic (Fallback for empty results)
    useEffect(() => {
        const query = searchQuery.trim();
        // Only search globally if:
        // 1. We have no local matches
        // 2. Query looks like a phone number (at least 6 digits) OR a name (at least 3 chars)
        // 3. We aren't already searching
        if (filteredContacts.length > 0 || query.length < 3) {
            setGlobalResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearchingGlobal(true);
            try {
                // Search users table
                let dbQuery = supabase.from('users').select('id, name, phone, avatar, is_online');
                
                if (/^\d+$/.test(query)) {
                    dbQuery = dbQuery.ilike('phone', `%${query}%`);
                } else {
                    dbQuery = dbQuery.ilike('name', `%${query}%`);
                }

                const { data, error } = await dbQuery.limit(5);

                if (error) throw error;

                if (data) {
                    const formatted = data
                        .filter(u => u.id !== user?.id && !existingMemberIds.includes(u.id))
                        .map(u => ({
                            id: u.id,
                            name: u.name || 'Unknown',
                            avatar: u.avatar,
                            phone: u.phone || 'ELEVENGRAM User',
                            is_online: u.is_online || false,
                            isGlobal: true // Flag to show "Global result" badge
                        }));
                    setGlobalResults(formatted);
                }
            } catch (err) {
                console.error('[AddMembers] Global search failed:', err);
            } finally {
                setIsSearchingGlobal(false);
            }
        }, 600); // Debounce

        return () => clearTimeout(timer);
    }, [searchQuery, filteredContacts.length, supabase, user?.id, existingMemberIds]);

    const displayResults = useMemo(() => {
        // Combine local filtered contacts and global results
        // Use a Set to avoid duplicates (though global results are filtered for non-contacts)
        const localIds = new Set(filteredContacts.map(c => c.id));
        const uniqueGlobal = globalResults.filter(g => !localIds.has(g.id));
        
        return [...filteredContacts, ...uniqueGlobal];
    }, [filteredContacts, globalResults]);

    // Toggle contact selection
    const toggleContact = (contact) => {
        setSelectedContacts(prev => {
            const isSelected = prev.some(c => c.id === contact.id);
            if (isSelected) {
                return prev.filter(c => c.id !== contact.id);
            } else {
                return [...prev, contact];
            }
        });
    };

    // Remove selected contact from chips
    const removeContact = (contactId) => {
        setSelectedContacts(prev => prev.filter(c => c.id !== contactId));
    };

    // Clear all selections
    const clearAllSelections = () => {
        setSelectedContacts([]);
    };

    // Add members
    const handleAddMembers = async () => {
        console.log(`[AddMembers] handleAddMembers triggered`, { groupId, selectedCount: selectedContacts.length });
        if (selectedContacts.length === 0) {
            toast.error('Please select at least one member');
            return;
        }

        setLoading(true);

        try {
            const memberIds = selectedContacts.map(c => c.id);
            console.log(`[AddMembers] Adding ${memberIds.length} members to group ${groupId}:`, memberIds);

            await addMembersMutation.mutateAsync({
                groupId,
                memberIds,
            });

            const count = selectedContacts.length;
            toast.success(
                `${count} ${count === 1 ? 'member' : 'members'} added successfully!`,
                { icon: '✅' }
            );

            // Reset state
            setSearchQuery('');
            setSelectedContacts([]);
            
            // Callbacks
            onSuccess?.();
            
            // Close after short delay to show success
            setTimeout(() => {
                onClose?.();
            }, 300);
        } catch (error) {
            console.error('Error adding members:', error);
            toast.error(error.message || 'Failed to add members');
        } finally {
            setLoading(false);
        }
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // ESC to close
            if (e.key === 'Escape' && !loading) {
                onClose?.();
            }
            // Enter to confirm if members selected
            if (e.key === 'Enter' && selectedContacts.length > 0 && !loading) {
                handleAddMembers();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedContacts, loading]);

    // Render contact avatar
    const renderAvatar = (contact) => {
        if (contact.avatar) {
            return <img src={contact.avatar} alt={contact.name} />;
        }
        return (
            <div className="avatar-placeholder">
                {getInitials(contact.name) || '?'}
            </div>
        );
    };

    return (
        <div className={`add-members-container ${isSidebar ? 'sidebar-mode' : ''}`}>
            {/* Header (Sidebar only) */}
            {isSidebar && (
                <div className="add-members-header">
                    <button 
                        className="back-btn" 
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h3>{title}</h3>
                </div>
            )}

            {/* Search */}
            <div className="search-container">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    autoFocus={isSidebar}
                    disabled={loading}
                />
            </div>

            {/* Selected Preview */}
            {selectedContacts.length > 0 && (
                <div className="selected-preview">
                    <div className="selected-count">
                        <Users size={14} />
                        <span>{selectedContacts.length} selected</span>
                    </div>
                    <div className="selected-chips">
                        {selectedContacts.map(contact => (
                            <div key={contact.id} className="selected-chip">
                                <span>{contact.name}</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContact(contact.id);
                                    }}
                                    disabled={loading}
                                    aria-label={`Remove ${contact.name}`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    {selectedContacts.length > 1 && (
                        <button 
                            className="clear-btn" 
                            onClick={clearAllSelections}
                            disabled={loading}
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {/* Contacts List */}
            <div className="contacts-list scrollbar-hidden">
                {displayResults.length === 0 && !isSearchingGlobal ? (
                    <div className="no-contacts">
                        {searchQuery ? (
                            <>
                                <Search size={48} />
                                <p>No users found matching "{searchQuery}"</p>
                            </>
                        ) : (
                            <>
                                <UserPlus size={48} />
                                <p>{contacts.length === 0 ? "You've added all your contacts to this group" : "No participants to show"}</p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {displayResults.map((contact, index) => {
                            const isSelected = selectedContacts.some(c => c.id === contact.id);
                            return (
                                <div
                                    key={contact.id}
                                    className={`contact-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => !loading && toggleContact(contact)}
                                    style={{ animationDelay: `${index * 0.03}s` }}
                                >
                                    <div className="contact-avatar">
                                        {renderAvatar(contact)}
                                        {isSelected && (
                                            <div className="check-icon">
                                                <Check size={12} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="contact-info">
                                        <div className="contact-name">
                                            {contact.name}
                                            {contact.isGlobal && (
                                                <span className="global-badge">
                                                    <Globe size={10} />
                                                    Global
                                                </span>
                                            )}
                                        </div>
                                        <div className="contact-phone">{contact.phone}</div>
                                    </div>
                                    {contact.is_online && (
                                        <div className="online-indicator" />
                                    )}
                                </div>
                            );
                        })}
                        {isSearchingGlobal && (
                            <div className="searching-global">
                                <LoaderCircle className="animate-spin" size={16} />
                                <span>Searching for more users...</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="add-members-actions">
                {!isSidebar && (
                    <button 
                        className="btn-secondary" 
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
                <button
                    className={`btn-primary add-confirm-btn ${loading ? 'loading' : ''}`}
                    onClick={handleAddMembers}
                    disabled={loading || selectedContacts.length === 0}
                >
                    {loading ? (
                        <>
                            <LoaderCircle className="animate-spin" size={16} />
                            Adding...
                        </>
                    ) : (
                        <>
                            <UserPlus size={16} />
                            Add {selectedContacts.length > 0 ? `${selectedContacts.length} ` : ''}
                            Member{selectedContacts.length !== 1 ? 's' : ''}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AddMembers;