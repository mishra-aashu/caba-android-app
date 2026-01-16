import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as deepar from 'deepar';

const ARCamera = forwardRef(({ licenseKey, effect }, ref) => {
  const canvasRef = useRef(null);
  const deepARRef = useRef(null);

  useEffect(() => {
    const startAR = async () => {
      if (canvasRef.current && !deepARRef.current) {
        try {
          const deepAR = await deepar.initialize({
            licenseKey: licenseKey,
            canvas: canvasRef.current,
            effect: effect,
          });
          deepARRef.current = deepAR;

          await deepAR.startVideo(true);
        } catch (error) {
          console.error('Failed to initialize DeepAR:', error);
        }
      }
    };

    startAR();

    return () => {
      if (deepARRef.current) {
        deepARRef.current.shutdown();
        deepARRef.current = null;
      }
    };
  }, [licenseKey, effect]);

  useImperativeHandle(ref, () => ({
    captureStream: () => {
      if (canvasRef.current) {
        return canvasRef.current.captureStream();
      }
      return null;
    }
  }));

  return <canvas ref={canvasRef} width="100%" height="100%" />;
});

export default ARCamera;
