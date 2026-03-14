import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    User,
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    ArrowLeft,
    Search,
    Phone,
    MessageCircle,
    UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { dpOptions } from '../../utils/dpOptions';
import toast from 'react-hot-toast';
import { useDialog } from '../../contexts/DialogContext';
import './ContactsPage.css';

const ContactsPage = ({ onClose, isDesktop = false }) => {
    const { supabase } = useSupabase();
    const { user } = useAuth();
    const { showConfirm } = useDialog();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const baseContacts = useLiveQuery(() => db.contacts.toArray(), []) || [];
    const refreshContacts = () => queryClient.invalidateQueries({ queryKey: ['contacts', user?.id] });

    const [showContactForm, setShowContactForm] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMenuOpen, setContactMenuOpen] = useState(null);
    const [editingContact, setEditingContact] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setContactMenuOpen(null);
            }
        };
        if (contactMenuOpen !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [contactMenuOpen]);

    const getAvatarSrc = useCallback((otherUser) => {
        if (!otherUser?.avatar) {
            return 'https://ionicframework.com/docs/img/demos/avatar.svg';
        }
        const avatarId = parseInt(otherUser.avatar);
        if (!isNaN(avatarId)) {
            const dp = dpOptions.find(d => d.id === avatarId);
            return dp?.path || 'https://ionicframework.com/docs/img/demos/avatar.svg';
        }
        return otherUser.avatar;
    }, []);

    const handleSaveContact = async () => {
        const trimmedName = contactName.trim();
        const trimmedPhone = contactPhone.trim();

        if (!trimmedName || !trimmedPhone) {
            return toast.error('Name and phone are required.');
        }
        if (!/^\d{10}$/.test(trimmedPhone)) {
            return toast.error('Enter a valid 10-digit phone number.');
        }

        setSaving(true);
        try {
            const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('phone', trimmedPhone)
                .single();

            if (userError || !existingUser) {
                setSaving(false);
                return toast.error('No user found with this phone number.');
            }

            if (existingUser.id === user.id) {
                setSaving(false);
                return toast.error("You can't add yourself as a contact.");
            }

            if (editingContact) {
                const { error } = await supabase
                    .from('contacts')
                    .update({
                        contact_name: trimmedName,
                        contact_user_id: existingUser.id
                    })
                    .eq('id', editingContact.id);

                if (error) throw error;
                toast.success('Contact updated!');
            } else {
                const { error } = await supabase
                    .from('contacts')
                    .insert([{
                        user_id: user.id,
                        contact_name: trimmedName,
                        contact_user_id: existingUser.id
                    }]);

                if (error) throw error;
                toast.success('Contact saved!');
            }

            queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
            refreshContacts();
            resetForm();
        } catch (error) {
            console.error('Error saving contact:', error);
            if (error.code === '23505') {
                toast.error('This contact is already saved.');
            } else {
                toast.error('Could not save contact.');
            }
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setContactName('');
        setContactPhone('');
        setShowContactForm(false);
        setEditingContact(null);
    };

    const handleEditContact = (contact) => {
        setEditingContact(contact);
        setContactName(contact.contactName);
        setContactPhone(contact.otherUser?.phone || '');
        setShowContactForm(true);
        setContactMenuOpen(null);
    };

    const handleDeleteContact = async (id) => {
        setContactMenuOpen(null);
        const confirmed = await showConfirm(
            'Are you sure you want to delete this contact?'
        );
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Contact deleted');
            queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
            refreshContacts();
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        }
    };

    const handleStartChatWithContact = async (contact) => {
        let contactUserId = contact.contactUserId;

        if (!contactUserId) {
            const phone = contact.otherUser?.phone || contact.contactPhone;
            if (!phone) {
                return toast.error("This contact can't be messaged.");
            }

            try {
                const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone', phone)
                    .single();

                if (existingUser) {
                    contactUserId = existingUser.id;
                    await supabase
                        .from('contacts')
                        .update({ contact_user_id: contactUserId })
                        .eq('id', contact.id);
                    queryClient.invalidateQueries({
                        queryKey: ['contacts', user.id]
                    });
                } else {
                    return toast.error(
                        `${contact.contactName} is not on Caba yet.`
                    );
                }
            } catch (err) {
                console.error('Fallback user lookup failed:', err);
                return toast.error('Could not find this user.');
            }
        }

        try {
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .or(
                    `and(user1_id.eq.${user.id},user2_id.eq.${contactUserId}),` +
                    `and(user1_id.eq.${contactUserId},user2_id.eq.${user.id})`
                )
                .single();

            if (chatError && chatError.code !== 'PGRST116') {
                throw chatError;
            }

            if (chat) {
                navigate(`/chat/${chat.id}/${contactUserId}`);
                onClose?.();
            } else {
                const { data: newChatData, error: newChatError } = await supabase
                    .from('chats')
                    .insert([{ user1_id: user.id, user2_id: contactUserId }])
                    .select()
                    .single();

                if (newChatError) throw newChatError;
                if (!newChatData) throw new Error('Failed to create chat');

                navigate(`/chat/${newChatData.id}/${contactUserId}`);
                onClose?.();
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            toast.error('Could not start chat.');
        }
    };

    const filteredContacts = baseContacts.filter((contact) => {
        const query = searchQuery.toLowerCase();
        return (
            contact.contactName?.toLowerCase().includes(query) ||
            contact.otherUser?.phone?.includes(query)
        );
    });

    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveContact();
        if (e.key === 'Escape') resetForm();
    };

    return (
        <div
            className={`contacts-page ${
                isDesktop ? 'desktop-mode' : 'mobile-mode'
            }`}
        >
            {/* ── Header ── */}
            <header className="contacts-header">
                <div className="header-left">
                    <button
                        className="icon-btn"
                        onClick={isDesktop ? onClose : () => navigate('/')}
                        title="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2>Contacts</h2>
                    <span className="contact-count">{baseContacts.length}</span>
                </div>

                <div className="header-right">
                    <button
                        className="icon-btn add-btn"
                        onClick={() => setShowContactForm(true)}
                        title="Add Contact"
                    >
                        <UserPlus size={20} />
                    </button>
                </div>
            </header>

            {/* ── Search ── */}
            <div className={`contacts-search ${searchFocused ? 'focused' : ''}`}>
                <Search size={18} className="search-icon" />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                />
                <AnimatePresence>
                    {searchQuery && (
                        <motion.button
                            className="search-clear"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            onClick={() => {
                                setSearchQuery('');
                                searchInputRef.current?.focus();
                            }}
                        >
                            ×
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Contact List ── */}
            <div className="contacts-content">
                {isDesktop && (
                    <button
                        className="add-contact-btn-desktop"
                        onClick={() => setShowContactForm(!showContactForm)}
                    >
                        <Plus size={18} />
                        <span>Add New Contact</span>
                    </button>
                )}

                <div className="saved-contacts-list">
                    <AnimatePresence mode="popLayout">
                        {filteredContacts.length > 0 ? (
                            filteredContacts.map((contact, index) => (
                                <motion.div
                                    key={contact.id}
                                    className="contact-item"
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -60 }}
                                    transition={{
                                        delay: index * 0.025,
                                        type: 'spring',
                                        stiffness: 500,
                                        damping: 35
                                    }}
                                    onClick={() =>
                                        handleStartChatWithContact(contact)
                                    }
                                >
                                    <div className="contact-main">
                                        <div className="contact-avatar">
                                            <img
                                                src={getAvatarSrc(
                                                    contact.otherUser
                                                )}
                                                alt={contact.contactName}
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="contact-info">
                                            <span className="contact-name">
                                                {contact.contactName ||
                                                    contact.otherUser?.name}
                                            </span>
                                            <span className="contact-phone">
                                                {contact.otherUser?.phone}
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        className="contact-actions"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            className="action-chat-btn"
                                            onClick={() =>
                                                handleStartChatWithContact(
                                                    contact
                                                )
                                            }
                                            title="Start Chat"
                                        >
                                            <MessageCircle size={18} />
                                        </button>

                                        <div
                                            className="menu-container"
                                            ref={
                                                contactMenuOpen === contact.id
                                                    ? menuRef
                                                    : null
                                            }
                                        >
                                            <button
                                                className="menu-btn"
                                                onClick={() =>
                                                    setContactMenuOpen(
                                                        contactMenuOpen ===
                                                            contact.id
                                                            ? null
                                                            : contact.id
                                                    )
                                                }
                                            >
                                                <MoreVertical size={18} />
                                            </button>

                                            <AnimatePresence>
                                                {contactMenuOpen ===
                                                    contact.id && (
                                                    <motion.div
                                                        className="contact-menu-popup"
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 0.85,
                                                            y: -8
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                            y: 0
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            scale: 0.85,
                                                            y: -8
                                                        }}
                                                        transition={{
                                                            duration: 0.15,
                                                            ease: 'easeOut'
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                handleEditContact(
                                                                    contact
                                                                )
                                                            }
                                                        >
                                                            <Edit size={15} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            className="delete"
                                                            onClick={() =>
                                                                handleDeleteContact(
                                                                    contact.id
                                                                )
                                                            }
                                                        >
                                                            <Trash2 size={15} />
                                                            Delete
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                className="empty-contacts"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <div className="empty-icon">
                                    {searchQuery ? (
                                        <Search size={40} />
                                    ) : (
                                        <UserPlus size={40} />
                                    )}
                                </div>
                                <h3>
                                    {searchQuery
                                        ? 'No results found'
                                        : 'No contacts yet'}
                                </h3>
                                <p>
                                    {searchQuery
                                        ? `No contacts match "${searchQuery}"`
                                        : 'Tap + to add your first contact'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── FAB (Mobile only) ── */}
            {!isDesktop && (
                <motion.button
                    className="fab-add"
                    onClick={() => setShowContactForm(true)}
                    whileTap={{ scale: 0.9 }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 20,
                        delay: 0.3
                    }}
                >
                    <Plus size={24} />
                </motion.button>
            )}

            {/* ── Add/Edit Form Modal ── */}
            <AnimatePresence>
                {showContactForm && (
                    <motion.div
                        className="contact-form-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={resetForm}
                    >
                        <motion.div
                            className="contact-form"
                            initial={{ scale: 0.9, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 40, opacity: 0 }}
                            transition={{
                                type: 'spring',
                                damping: 28,
                                stiffness: 350
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={handleFormKeyDown}
                        >
                            <div className="form-header">
                                <h3>
                                    {editingContact
                                        ? 'Edit Contact'
                                        : 'New Contact'}
                                </h3>
                                <button
                                    className="form-close-btn"
                                    onClick={resetForm}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="form-body">
                                <div className="input-group">
                                    <User size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        placeholder="Contact name"
                                        value={contactName}
                                        onChange={(e) =>
                                            setContactName(e.target.value)
                                        }
                                        autoFocus
                                    />
                                </div>
                                <div className="input-group">
                                    <Phone size={18} className="input-icon" />
                                    <input
                                        type="tel"
                                        placeholder="10-digit phone number"
                                        value={contactPhone}
                                        onChange={(e) =>
                                            setContactPhone(
                                                e.target.value
                                                    .replace(/\D/g, '')
                                                    .slice(0, 10)
                                            )
                                        }
                                    />
                                    {contactPhone.length > 0 && (
                                        <span
                                            className={`phone-counter ${
                                                contactPhone.length === 10
                                                    ? 'valid'
                                                    : ''
                                            }`}
                                        >
                                            {contactPhone.length}/10
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    className="btn-cancel"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-save"
                                    onClick={handleSaveContact}
                                    disabled={saving}
                                >
                                    {saving
                                        ? 'Saving...'
                                        : editingContact
                                        ? 'Update'
                                        : 'Save Contact'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ContactsPage;