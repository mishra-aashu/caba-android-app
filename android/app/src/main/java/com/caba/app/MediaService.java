package com.caba.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class MediaService extends Service implements AudioManager.OnAudioFocusChangeListener {
    private static final String CHANNEL_ID = "CABA_MUSIC_CHANNEL";
    private static final int NOTIFICATION_ID = 101;
    
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean isPlaying = false;

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent.getAction();
        if (action != null) {
            if (action.equals("START")) {
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                requestAudioFocus();
                startForeground(NOTIFICATION_ID, buildNotification(title, artist));
                isPlaying = true;
            } else if (action.equals("STOP")) {
                stopForeground(true);
                abandonAudioFocus();
                isPlaying = false;
                stopSelf();
            } else if (action.equals("UPDATE")) {
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                manager.notify(NOTIFICATION_ID, buildNotification(title, artist));
            }
        }
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background music playback controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String artist) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon) // Use app's own icon
            .setContentTitle(title != null ? title : "CABA Music")
            .setContentText(artist != null ? artist : "Playing in background")
            .setPriority(NotificationCompat.PRIORITY_MAX) // Increased priority for better visibility
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT) // Important for media handling
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColorized(true)
            .setColor(0xFF00A884); // CABA Green

        return builder.build();
    }

    private void requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(this)
                .build();
            audioManager.requestAudioFocus(focusRequest);
        } else {
            audioManager.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest);
            }
        } else {
            audioManager.abandonAudioFocus(this);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        // Send event to JS bridge to handle pause/resume
        String event = "";
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                event = "pause";
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                event = "resume";
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                event = "duck";
                break;
        }
        
        if (!event.isEmpty()) {
            CabaNativePlugin.sendEventToJS("audioFocusChange", event);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        abandonAudioFocus();
        super.onDestroy();
    }
}
