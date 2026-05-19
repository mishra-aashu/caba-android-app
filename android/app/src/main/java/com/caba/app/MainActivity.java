package com.caba.app;

import android.content.Intent;
import android.database.Cursor;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.os.Parcelable;
import android.provider.OpenableColumns;
import android.util.Log;
import android.view.View;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ElevengramShare";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CabaNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Detect keyboard open/close and send event to JS
        final View activityRoot = getWindow().getDecorView().findViewById(android.R.id.content);
        activityRoot.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            Rect r = new Rect();
            activityRoot.getWindowVisibleDisplayFrame(r);
            int screenHeight = activityRoot.getRootView().getHeight();
            int keypadHeight = screenHeight - r.bottom;

            if (keypadHeight > screenHeight * 0.15) {
                JSObject data = new JSObject();
                data.put("height", keypadHeight);
                CabaNativePlugin.sendEventToJS("keyboardOpened", data.toString());
            } else {
                CabaNativePlugin.sendEventToJS("keyboardClosed", null);
            }
        });

        // Handle share intent when app is launched fresh via share
        handleIncomingShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle share intent when app is already running (singleTask)
        handleIncomingShareIntent(intent);
    }

    /**
     * Extracts file URI(s) from an incoming share intent and sends them to the JS layer
     * via the CabaNativePlugin event bridge.
     */
    private void handleIncomingShareIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String type = intent.getType();

        if (type == null) return;

        if (Intent.ACTION_SEND.equals(action)) {
            // Single file share
            Uri fileUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (fileUri != null) {
                sendShareEventToJS(fileUri, type);
            }

        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            // Multiple files — we take the first one for now
            ArrayList<Parcelable> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (uris != null && !uris.isEmpty()) {
                Uri fileUri = (Uri) uris.get(0);
                sendShareEventToJS(fileUri, type);
            }
        }
    }

    /**
     * Resolve the content URI to get real file name and size, then fire the JS event.
     */
    private void sendShareEventToJS(Uri fileUri, String mimeType) {
        try {
            // Grant temporary read permission for content URIs
            getContentResolver().takePersistableUriPermission(
                fileUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception e) {
            // Some providers don't support persistable permissions, that's ok
            Log.d(TAG, "takePersistableUriPermission skipped: " + e.getMessage());
        }

        String fileName = resolveFileName(fileUri);
        long fileSize = resolveFileSize(fileUri);

        JSObject payload = new JSObject();
        payload.put("uri", fileUri.toString());
        payload.put("name", fileName != null ? fileName : "shared_file");
        payload.put("mimeType", mimeType != null ? mimeType : "application/octet-stream");
        payload.put("size", fileSize);

        Log.d(TAG, "Share intent received → " + payload.toString());

        // Fire event to JS — this triggers useShareIntent hook in the React layer
        CabaNativePlugin.sendEventToJS("incomingShareIntent", payload.toString());
    }

    /** Queries ContentResolver to get a human-readable file name from a content URI */
    private String resolveFileName(Uri uri) {
        String result = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (idx >= 0) result = cursor.getString(idx);
                }
            } catch (Exception e) {
                Log.e(TAG, "resolveFileName failed: " + e.getMessage());
            }
        }
        if (result == null) {
            result = uri.getLastPathSegment();
        }
        return result;
    }

    /** Queries ContentResolver to get file size from a content URI */
    private long resolveFileSize(Uri uri) {
        long size = 0;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (idx >= 0 && !cursor.isNull(idx)) size = cursor.getLong(idx);
                }
            } catch (Exception e) {
                Log.e(TAG, "resolveFileSize failed: " + e.getMessage());
            }
        }
        return size;
    }
}
