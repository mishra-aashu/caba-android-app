package com.caba.app;

import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
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

            if (keypadHeight > screenHeight * 0.15) { // 15% threshold
                JSObject data = new JSObject();
                data.put("height", keypadHeight);
                CabaNativePlugin.sendEventToJS("keyboardOpened", data.toString());
            } else {
                CabaNativePlugin.sendEventToJS("keyboardClosed", null);
            }
        });
    }
}
