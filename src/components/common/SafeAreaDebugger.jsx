/* src/components/common/SafeAreaDebugger.jsx */
import React from 'react';
import { useSafeArea } from '../../utils/safeAreaDetector';
import { useKeyboard } from '../../utils/keyboardHandler';

/**
 * Debugger component to visualize safe area insets and keyboard state.
 * Only renders in development mode.
 */
const SafeAreaDebugger = () => {
    const insets = useSafeArea();
    const keyboard = useKeyboard();
    const [isVisible, setIsVisible] = React.useState(false);

    // Only show in development
    if (process.env.NODE_ENV === 'production' && !window.DEBUG_SAFE_AREA) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            right: isVisible ? '10px' : '-180px',
            transform: 'translateY(-50%)',
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#00ff00',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '10px',
            fontFamily: 'monospace',
            transition: 'right 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'auto'
        }}>
            <div
                onClick={() => setIsVisible(!isVisible)}
                style={{
                    position: 'absolute',
                    left: '-30px',
                    top: '0',
                    background: '#333',
                    padding: '5px',
                    borderRadius: '4px 0 0 4px',
                    cursor: 'pointer'
                }}
            >
                {isVisible ? '→' : '⚡'}
            </div>

            <h4 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #444' }}>SAFE AREA DEBUG</h4>
            <div>TOP: {insets.top}px</div>
            <div>BOTTOM: {insets.bottom}px</div>
            <div>LEFT: {insets.left}px</div>
            <div>RIGHT: {insets.right}px</div>

            <h4 style={{ margin: '10px 0 5px 0', borderBottom: '1px solid #444' }}>KEYBOARD</h4>
            <div>OPEN: {keyboard.isOpen ? 'YES' : 'NO'}</div>
            <div>HEIGHT: {keyboard.height}px</div>

            <h4 style={{ margin: '10px 0 5px 0', borderBottom: '1px solid #444' }}>VIEWPORT</h4>
            <div>W: {window.innerWidth}px</div>
            <div>H: {window.innerHeight}px</div>
        </div>
    );
};

export default SafeAreaDebugger;
