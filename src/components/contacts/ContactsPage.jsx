import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Plus,
    MessageSquarePlus,
    MoreVertical,
    Edit,
    Trash2,
    ArrowLeft,
    X,
    Search,
    Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import toast from 'react-hot-toast';
import { useDialog } from '../../contexts/DialogContext';
import './ContactsPage.css';

const ContactsPage = ({ onClose, isDesktop = false }) => {
    const { supabase } = useSupabase();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useDialog();
    const { contacts: savedContacts, refreshContacts } = useData();
    const navigate = useNavigate();

    const [showContactForm, setShowContactForm] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMenuOpen, setContactMenuOpen] = useState(null);
    const [editingContact, setEditingContact] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSaveContact = async () => {
        if (!contactName.trim() || !contactPhone.trim()) {
            return toast.error('Name and phone are required.');
        }
        if (!/^\d{10}$/.test(contactPhone)) {
            return toast.error('Please enter a valid 10-digit phone number.');
        }

        try {
            const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('phone', contactPhone)
                .single();

            if (userError || !existingUser) {
                return toast.error('No user found with this phone number.');
            }

            if (editingContact) {
                const { error } = await supabase
                    .from('contacts')
                    .update({
                        contact_name: contactName,
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
                        contact_name: contactName,
                        contact_user_id: existingUser.id
                    }]);

                if (error) throw error;
                toast.success('Contact saved!');
            }

            refreshContacts();
            resetForm();
        } catch (error) {
            console.error('Error saving contact:', error);
            if (error.code === '23505') {
                toast.error('You have already saved this contact.');
            } else {
                toast.error('Could not save contact.');
            }
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
        setContactName(contact.contact_name);
        setContactPhone(contact.otherUser?.phone || '');
        setShowContactForm(true);
        setContactMenuOpen(null);
    };

    const handleDeleteContact = async (id) => {
        const confirmed = await showConfirm('Are you sure you want to delete this contact?');
        if (!confirmed) return;
        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Contact deleted');
            refreshContacts();
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        }
    };

    const handleStartChatWithContact = async (contact) => {
        if (!contact.contact_user_id) {
            return toast.error("This contact can't be messaged.");
        }

        try {
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${contact.contact_user_id}),and(user1_id.eq.${contact.contact_user_id},user2_id.eq.${user.id})`)
                .single();

            if (chatError && chatError.code !== 'PGRST116') {
                throw chatError;
            }

            if (chat) {
                navigate(`/chat/${chat.id}/${contact.contact_user_id}`);
                if (onClose) onClose();
            } else {
                const newChat = { user1_id: user.id, user2_id: contact.contact_user_id };
                const { data: newChatData, error: newChatError } = await supabase
                    .from('chats')
                    .insert([newChat])
                    .select()
                    .single();

                if (newChatError) throw newChatError;

                if (newChatData) {
                    navigate(`/chat/${newChatData.id}/${contact.contact_user_id}`);
                    if (onClose) onClose();
                } else {
                    throw new Error('Failed to create chat');
                }
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            toast.error('Could not start chat.');
        }
    };

    const filteredContacts = savedContacts.filter(contact =>
        contact.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.otherUser?.phone?.includes(searchQuery)
    );

    return (
        <div className={`contacts-page ${isDesktop ? 'desktop-mode' : 'mobile-mode'}`}>
            <header className="contacts-header">
                <div className="header-left">
                    {isDesktop ? (
                        <button className="icon-btn" onClick={onClose} title="Back to Chats">
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <button className="icon-btn" onClick={() => navigate('/')} title="Back">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2>Contacts</h2>
                </div>
                {!isDesktop && (
                    <div className="header-right">
                        <button className="icon-btn" onClick={() => setShowContactForm(true)}>
                            <Plus size={20} />
                        </button>
                    </div>
                )}
            </header>

            <div className="contacts-search">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>


            <div className="contacts-content">
                {isDesktop && (
                    <button
                        className="add-contact-btn"
                        onClick={() => setShowContactForm(!showContactForm)}
                    >
                        <Plus size={20} />
                        Add New Contact
                    </button>
                )}

                <AnimatePresence>
                    {showContactForm && (
                        <motion.div
                            className="contact-form-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <motion.div
                                className="contact-form"
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            >
                                <h3>{editingContact ? 'Edit Contact' : 'New Contact'}</h3>
                                <div className="input-group">
                                    <User size={18} />
                                    <input
                                        type="text"
                                        placeholder="Contact name"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="input-group">
                                    <Phone size={18} />
                                    <input
                                        type="tel"
                                        placeholder="Phone number"
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    />
                                </div>
                                <div className="contact-form-actions">
                                    <button className="btn-secondary" onClick={resetForm}>Cancel</button>
                                    <button className="btn-primary" onClick={handleSaveContact}>
                                        {editingContact ? 'Update' : 'Save'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="saved-contacts-list">
                    {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact, index) => (
                            <motion.div
                                key={contact.id}
                                className="contact-item"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => handleStartChatWithContact(contact)}
                            >
                                <div className="contact-main">
                                    <div className="contact-avatar">
                                        <img
                                            src={contact.otherUser?.avatar && parseInt(contact.otherUser.avatar)
                                                ? dpOptions.find(dp => dp.id === parseInt(contact.otherUser.avatar))?.path
                                                : (contact.otherUser?.avatar || "https://ionicframework.com/docs/img/demos/avatar.svg")}
                                            alt={contact.contact_name}
                                        />
                                    </div>
                                    <div className="contact-info">
                                        <div className="contact-name">{contact.contact_name || contact.otherUser?.name}</div>
                                        <div className="contact-phone">{contact.otherUser?.phone}</div>
                                    </div>
                                </div>

                                <div className="contact-actions" onClick={(e) => e.stopPropagation()}>
                                    <div className="menu-container">
                                        <button
                                            className="menu-btn"
                                            onClick={() => setContactMenuOpen(contactMenuOpen === contact.id ? null : contact.id)}
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                        <AnimatePresence>
                                            {contactMenuOpen === contact.id && (
                                                <motion.div
                                                    className="contact-menu-popup"
                                                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                                    transition={{ duration: 0.15 }}
                                                >
                                                    <button onClick={() => handleEditContact(contact)}>
                                                        <Edit size={16} /> Edit
                                                    </button>
                                                    <button className="delete" onClick={() => handleDeleteContact(contact.id)}>
                                                        <Trash2 size={16} /> Delete
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="empty-contacts">
                            <User size={48} />
                            <p>{searchQuery ? 'No matching contacts found' : 'No saved contacts yet'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
