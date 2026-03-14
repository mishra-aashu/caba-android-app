import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, lazy } from 'react';

const ChatListPanel = lazy(() => import('../ChatListPanel'));
const ContactsPage = lazy(() => import('../contacts/ContactsPage'));
const Profile = lazy(() => import('../profile/Profile'));
const Settings = lazy(() => import('../settings/Settings'));
const SecuritySettings = lazy(() => import('../settings/SecuritySettings'));
const HelpCenter = lazy(() => import('../settings/HelpCenter'));
const EmojiSettings = lazy(() => import('../settings/EmojiSettings'));
const History = lazy(() => import('../History'));
const Terms = lazy(() => import('../legal/Terms'));
const Privacy = lazy(() => import('../legal/Privacy'));
const Blocked = lazy(() => import('../blocked/Blocked'));
const SupportChat = lazy(() => import('../SupportChat'));

const Sidebar = ({
    isDesktop,
    isContactsRoute,
    isProfileRoute,
    isSettingsRoute,
    isSecuritySettingsRoute,
    isHelpCenterRoute,
    isTermsRoute,
    isPrivacyRoute,
    isBlockedRoute,
    isSupportRoute,
    isEmojiSettingsRoute,
    isHistoryRoute,
    chatListPanelProps,
    onCloseSidebar
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
            <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
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
                            <ContactsPage isDesktop={true} onClose={onCloseSidebar} />
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
                    ) : isDesktop && isSettingsRoute ? (
                        <motion.div
                            key="settings"
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
                                zIndex: 4,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            {isSecuritySettingsRoute ? (
                                <SecuritySettings isSidebar={true} />
                            ) : isHelpCenterRoute ? (
                                <HelpCenter isSidebar={true} />
                            ) : (
                                <Settings isSidebar={true} />
                            )}
                        </motion.div>
                    ) : isDesktop && isTermsRoute ? (
                        <motion.div
                            key="terms"
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
                                zIndex: 6,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Terms isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isPrivacyRoute ? (
                        <motion.div
                            key="privacy"
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
                                zIndex: 7,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Privacy isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isBlockedRoute ? (
                        <motion.div
                            key="blocked"
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
                                zIndex: 8,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Blocked isSidebar={true} onBack={() => {}} />
                        </motion.div>
                    ) : isDesktop && isSupportRoute ? (
                        <motion.div
                            key="support"
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
                                zIndex: 9,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <SupportChat isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isEmojiSettingsRoute ? (
                        <motion.div
                            key="emoji-settings"
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
                                zIndex: 5,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <EmojiSettings isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isHistoryRoute ? (
                        <motion.div
                            key="history"
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
                                zIndex: 6,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <History isSidebar={true} />
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
            </Suspense>
        </div>
    );
};

export default Sidebar;
