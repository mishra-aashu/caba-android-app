import React, { useEffect, useRef } from 'react';
import { particleManager } from '../../utils/particleManager';

const ParticleOverlay = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        // Connect manager to this canvas
        particleManager.setCanvas(canvas);

        return () => {
            window.removeEventListener('resize', handleResize);
            particleManager.setCanvas(null);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999,
                // Ensure GPU acceleration
                willChange: 'transform',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
            }}
        />
    );
};

export default ParticleOverlay;
