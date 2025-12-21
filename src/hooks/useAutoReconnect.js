import { useEffect } from 'react';
import { supabase } from '../config/supabase.js';

const useAutoReconnect = (onReconnect) => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Jab user app wapas kholta hai (Visible state)
      if (document.visibilityState === 'visible') {
        console.log('App is back in foreground. Refreshing connection...');

        // 1. Check if Supabase is disconnected
        const { data: { session } } = await supabase.auth.getSession();

        // 2. Realtime subscription ko restart karo
        // Agar tumne koi channel subscribe kiya hai, usko remove karke wapas add kro
        supabase.removeAllChannels().then(() => {
           // Call the provided callback to resubscribe
           if (onReconnect) {
             onReconnect();
           }
           console.log('Channels re-subscribed');
        });

        // 3. Data bhi re-fetch kar lo (Safety ke liye) - TanStack Query handles this automatically
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onReconnect]);
};

export default useAutoReconnect;