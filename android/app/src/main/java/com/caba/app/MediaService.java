package com.caba.app;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/**
 * Minimal MediaService to satisfy AndroidManifest declaration.
 * This ensures the app doesn't crash and provides a hook for future
 * native foreground service logic if needed.
 */
public class MediaService extends Service {
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }
}
