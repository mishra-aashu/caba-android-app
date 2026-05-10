package com.caba.app;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CabaNative")
public class CabaNativePlugin extends Plugin {
    private static CabaNativePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void sendEventToJS(String eventName, String data) {
        if (instance != null) {
            JSObject ret = new JSObject();
            ret.put("value", data);
            instance.notifyListeners(eventName, ret);
        }
    }

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        String title = call.getString("title", "CABA Music");
        String artist = call.getString("artist", "Playing...");
        
        Intent intent = new Intent(getContext(), MediaService.class);
        intent.setAction("START");
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title");
        String artist = call.getString("artist");
        
        Intent intent = new Intent(getContext(), MediaService.class);
        intent.setAction("UPDATE");
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve();
    }
}
