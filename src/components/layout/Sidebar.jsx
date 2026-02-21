import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatListPanel from '../ChatListPanel';
import ContactsPage from '../contacts/ContactsPage';
import Profile from '../profile/Profile';

const Sidebar = ({
    isDesktop,
    isContactsRoute,
    isProfileRoute,
    chatListPanelProps,
    onCloseContacts
}) => {
    return (
        <div className="sidebar-root" style={{
            position: 'relative',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <AnimatePresence mode="wait">
                {isDesktop && isContactsRoute ? (
                    <motion.div
                        key="contacts"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 2,
                            backgroundColor: 'var(--surface-color)',
                            willChange: 'transform, opacity'
                        }}
                    >
                        <ContactsPage isDesktop={true} onClose={onCloseContacts} />
                    </motion.div>
                ) : isDesktop && isProfileRoute ? (
                    <motion.div
                        key="profile"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 3,
                            backgroundColor: 'var(--surface-color)',
                            willChange: 'transform, opacity'
                        }}
                    >
                        <Profile isSidebar={true} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="chatlist"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 1,
                            backgroundColor: 'var(--surface-color)',
                            willChange: 'opacity'
                        }}
                    >
                        <ChatListPanel {...chatListPanelProps} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Sidebar;
