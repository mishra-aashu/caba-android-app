/**
 * AddMembers - Standalone component for searching & adding new people to group
 * Used in both Modal and Sidebar views
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../contexts/DataContext';
import { useGroupActions } from '../../hooks/useGroupActions';
import { Search, Check, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import './AddMembers.css';

const AddMembers = ({ 
    groupId, 
    existingMemberIds = [], 
    onSuccess, 
    onClose,
    isSidebar = false,
    title = "Add Members"
}) => {
    const { user } = useAuth();
    const { useAddMembers } = useGroupActions();
    const { contacts: cachedContacts } = useData();
    const addMembersMutation = useAddMembers();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Derived contacts list from cache, filtering out existing members
    const contacts = useMemo(() => {
        return (cachedContacts || [])
            .map(c => ({
                id: c.contactUserId,
                name: c.contactName || c.otherUser?.name || 'Unknown',
                avatar: c.otherUser?.avatar,
                phone: c.otherUser?.phone,
            }))
            .filter(c => c.id && !existingMemberIds.includes(c.id));
    }, [cachedContacts, existingMemberIds]);

    // Filter contacts by search
    const filteredContacts = contacts.filter(contact =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.includes(searchQuery)
    );

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

    // Add members
    const handleAddMembers = async () => {
        if (selectedContacts.length === 0) {
            toast.error('Please select at least one member');
            return;
        }

        setLoading(true);

        try {
            const memberIds = selectedContacts.map(c => c.id);

            await addMembersMutation.mutateAsync({
                groupId,
                memberIds,
            });

            toast.success(`${selectedContacts.length} member(s) added successfully`);

            // Reset and callbacks
            setSearchQuery('');
            setSelectedContacts([]);
            onSuccess?.();
            onClose?.();
        } catch (error) {
            console.error('Error adding members:', error);
            toast.error('Failed to add members');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`add-members-container ${isSidebar ? 'sidebar-mode' : ''}`}>
            {isSidebar && (
                <div className="add-members-header">
                    <button className="back-btn" onClick={onClose}>
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
                />
            </div>

            {/* Selected Preview */}
            {selectedContacts.length > 0 && (
                <div className="selected-preview">
                    <div className="selected-chips">
                        {selectedContacts.map(contact => (
                            <div key={contact.id} className="selected-chip">
                                <span>{contact.name}</span>
                                <button onClick={() => toggleContact(contact)}>
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="clear-btn" onClick={() => setSelectedContacts([])}>
                        Clear all
                    </button>
                </div>
            )}

            {/* Contacts List */}
            <div className="contacts-list scrollbar-hidden">
                {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => {
                        const isSelected = selectedContacts.some(c => c.id === contact.id);
                        return (
                            <div
                                key={contact.id}
                                className={`contact-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleContact(contact)}
                            >
                                <div className="contact-avatar">
                                    {contact.avatar ? (
                                        <img src={contact.avatar} alt={contact.name} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {contact.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div className="check-icon">
                                            <Check size={14} />
                                        </div>
                                    )}
                                </div>
                                <div className="contact-info">
                                    <div className="contact-name">{contact.name}</div>
                                    <div className="contact-phone">{contact.phone}</div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="no-contacts">
                        {searchQuery
                            ? 'No contacts found'
                            : 'All contacts are already members'}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="add-members-actions">
                {!isSidebar && (
                    <button className="btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                )}
                <button
                    className="btn-primary add-confirm-btn"
                    onClick={handleAddMembers}
                    disabled={loading || selectedContacts.length === 0}
                >
                    {loading
                        ? 'Adding...'
                        : `Add ${selectedContacts.length} Member${selectedContacts.length !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
};

export default AddMembers;
