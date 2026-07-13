package pl.user.daymenu;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mostek JS -> widżet. Aplikacja (DayMenu.html) po każdej zmianie danych woła
 * Capacitor.Plugins.DayMenuWidget.update({data: "...json..."}); my zapisujemy
 * JSON do SharedPreferences i każemy widżetowi się przerysować. Dzięki temu
 * widżet działa bez sieci i bez budzenia WebView.
 */
@CapacitorPlugin(name = "DayMenuWidget")
public class WidgetPlugin extends Plugin {

    static final String PREFS = "daymenu_widget";
    static final String KEY_DATA = "data";

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "");
        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_DATA, data).apply();
        DayMenuWidgetProvider.refresh(ctx);
        call.resolve();
    }
}
