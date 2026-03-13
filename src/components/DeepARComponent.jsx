import React, { useEffect, useRef, useState } from 'react';

const DeepARComponent = ({ onStreamReady }) => {
  const canvasRef = useRef(null);
  const deepARRef = useRef(null); // To store the DeepAR instance
  const [currentEffect, setCurrentEffect] = useState(null);
  const isInitializing = useRef(false);

  const effects = [
    'aviators',
    'background_blur.deepar',
    'background_replacement.deepar',
    'dalmatian',
    'galaxy_background',
    'koala',
    'lion',
  ];

  useEffect(() => {
    const initializeDeepAR = async () => {
      if (!canvasRef.current || isInitializing.current) return;
      isInitializing.current = true;

      try {
        const deepar = await import('deepar');
        const deepAR = await deepar.initialize({
          licenseKey: 'ef8e3a8114ba4aef4de308c38d40deb07ba1554d052ee7fc8b07c184e6a65ea2a470efe9339fcb65',
          canvas: canvasRef.current,
          rootPath: '/deepar/',
          initializationOptions: {
            maxNumberOfFaces: 1,
          },
        });

        deepARRef.current = deepAR;
        await deepAR.startVideo();
        // Load the lion effect by default
        switchEffect('lion');
        console.log('DeepAR initialized successfully!');

        if (canvasRef.current) {
          const stream = canvasRef.current.captureStream();
          if (onStreamReady) {
            onStreamReady(stream);
          }
        }
      } catch (error) {
        console.error('Failed to initialize DeepAR:', error);
      } finally {
        isInitializing.current = false;
      }
    };

    initializeDeepAR();

    return () => {
      if (deepARRef.current) {
        console.log('Shutting down DeepAR...');
        deepARRef.current.shutdown();
        deepARRef.current = null;
      }
    };
  }, [onStreamReady]);

  const switchEffect = (effect) => {
    if (deepARRef.current) {
      const effectPath = `/deepar/effects/${effect}`;
      deepARRef.current.switchEffect(effectPath);
      setCurrentEffect(effect);
    }
  };

  const removeEffect = () => {
    if (deepARRef.current) {
      deepARRef.current.switchEffect(null);
      setCurrentEffect(null);
    }
  };

  return (
    <div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 'auto' }}></canvas>
      <div>
        {effects.map((effect) => (
          <button key={effect} onClick={() => switchEffect(effect)}>
            {effect.replace('.deepar', '')}
          </button>
        ))}
        <button onClick={removeEffect} disabled={!currentEffect}>
          Remove Effect
        </button>
      </div>
    </div>
  );
};

export default DeepARComponent;
