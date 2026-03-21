import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from './platformCheck';

/**
 * HapticsManager
 * 
 * Centralized utility for triggering tactile feedback.
 * Works only on native platforms (Android/iOS).
 */
export const hapticsManager = {
    /**
     * Impact feedback (light/medium/heavy)
     * Good for button clicks, message sends, etc.
     */
    async impact(style = ImpactStyle.Light) {
        if (!isNativeWithPlugins()) return;
        try {
            await Haptics.impact({ style });
        } catch (e) {
            console.warn('Haptics impact failed', e);
        }
    },

    /**
     * Notification feedback (Success/Warning/Error)
     * Good for form submissions, errors, etc.
     */
    async notification(type = NotificationType.Success) {
        if (!isNativeWithPlugins()) return;
        try {
            await Haptics.notification({ type });
        } catch (e) {
            console.warn('Haptics notification failed', e);
        }
    },

    /**
     * Success feedback shorthand
     */
    async success() {
        await this.notification(NotificationType.Success);
    },

    /**
     * Error feedback shorthand
     */
    async error() {
        await this.notification(NotificationType.Error);
    },

    /**
     * Warning feedback shorthand
     */
    async warning() {
        await this.notification(NotificationType.Warning);
    },

    /**
     * Selection feedback
     * Good for scrolling through a picker or toggling a switch.
     */
    async selectionChanged() {
        if (!isNativeWithPlugins()) return;
        try {
            await Haptics.selectionChanged();
        } catch (e) {
            console.warn('Haptics selectionChanged failed', e);
        }
    }
};

export default hapticsManager;
