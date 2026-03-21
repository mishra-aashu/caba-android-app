import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from './platformCheck';

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
    async impact(styleName = 'Light') {
        if (!isNativeWithPlugins()) return;
        
        await safePluginCall(
            () => import('@capacitor/haptics'),
            (mod, { ImpactStyle }) => mod.Haptics.impact({ 
                style: ImpactStyle[styleName] || ImpactStyle.Light 
            })
        ).catch(() => {
            // Silently fail or fallback if needed
        });
    },

    /**
     * Notification feedback (Success/Warning/Error)
     * Good for form submissions, errors, etc.
     */
    async notification(typeName = 'Success') {
        if (!isNativeWithPlugins()) return;
        
        await safePluginCall(
            () => import('@capacitor/haptics'),
            (mod, { NotificationType }) => mod.Haptics.notification({ 
                type: NotificationType[typeName] || NotificationType.Success 
            })
        ).catch(() => {
            // Silently fail
        });
    },

    /**
     * Success feedback shorthand
     */
    async success() {
        await this.notification('Success');
    },

    /**
     * Error feedback shorthand
     */
    async error() {
        await this.notification('Error');
    },

    /**
     * Warning feedback shorthand
     */
    async warning() {
        await this.notification('Warning');
    },

    /**
     * Selection feedback
     * Good for scrolling through a picker or toggling a switch.
     */
    async selectionChanged() {
        if (!isNativeWithPlugins()) return;
        
        await safePluginCall(
            () => import('@capacitor/haptics'),
            (mod) => mod.Haptics.selectionChanged()
        ).catch(() => {
            // Silently fail
        });
    }
};

export default hapticsManager;
/* SAFE */
