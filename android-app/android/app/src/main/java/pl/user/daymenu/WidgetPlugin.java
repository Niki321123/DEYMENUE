package pl.user.daymenu;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mostek JS <-> widżet.
 *
 * JS -> widżet: aplikacja (DayMenu.html, widgetPush()) po każdej zmianie danych woła
 * Capacitor.Plugins.DayMenuWidget.update({data: "...json..."}); zapisujemy JSON + czas zapisu do
 * SharedPreferences i każemy widżetowi się przerysować. Działa bez sieci i bez budzenia WebView.
 *
 * Widżet -> JS: tap w pole widżetu startuje MainActivity z ekstra „dm_tab" (matura/time/exams).
 * Capacitor przekazuje intent do handleOnNewIntent zarówno przy zimnym starcie (BridgeActivity.load
 * woła onNewIntent(getIntent())), jak i gdy apka już działa (singleTask → onNewIntent). Zakładkę
 * trzymamy w pendingTab (JS odpyta getLaunchTab() po załadowaniu) i dodatkowo emitujemy zdarzenie
 * „launchTab" z retainUntilConsumed — obojętnie, kto pierwszy nasłuchuje, sygnał nie ginie, a
 * podwójne przełączenie tej samej zakładki jest po stronie JS nieszkodliwe (show() idempotentne).
 */
@CapacitorPlugin(name = "DayMenuWidget")
public class WidgetPlugin extends Plugin {

    static final String PREFS = "daymenu_widget";
    static final String KEY_DATA = "data";
    static final String KEY_SAVED_AT = "savedAt";
    static final String EXTRA_TAB = "dm_tab";

    private static volatile String pendingTab;

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "");
        Context ctx = getContext();
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_DATA, data)
                .putLong(KEY_SAVED_AT, System.currentTimeMillis())
                .apply();
        DayMenuWidgetProvider.refresh(ctx);
        call.resolve();
    }

    /** Zakładka z ostatniego tapu w widżet (pusty string, gdy apkę otwarto normalnie). Zeruje po odczycie. */
    @PluginMethod
    public void getLaunchTab(PluginCall call) {
        String tab = pendingTab;
        pendingTab = null;
        JSObject r = new JSObject();
        r.put("tab", tab == null ? "" : tab);
        call.resolve(r);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;
        String tab = intent.getStringExtra(EXTRA_TAB);
        if (tab == null || tab.isEmpty()) return;
        intent.removeExtra(EXTRA_TAB);   // żeby obrót ekranu / ponowne dostarczenie nie przełączało znów
        pendingTab = tab;
        JSObject data = new JSObject();
        data.put("tab", tab);
        notifyListeners("launchTab", data, true);
    }
}
