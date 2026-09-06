package pl.user.daymenu;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/**
 * Widżet ekranu głównego o zmiennym rozmiarze: mały = plan nauki na dziś, średni = + wykres
 * produktywności z 7 dni, duży = + najbliższe sprawdziany. Tap w pole otwiera właściwą zakładkę.
 *
 * Dane przychodzą z aplikacji przez WidgetPlugin (SharedPreferences: JSON + czas zapisu), a to,
 * co zależy od CZASU (który dzień jest „dziś", ile dni do sprawdzianu, przesunięcie słupków),
 * liczymy tu przy każdym rysowaniu — widżet jest poprawny rano bez otwierania apki. Do tego
 * służy niedokładny alarm tuż po północy (bez uprawnień) plus updatePeriodMillis co 30 min.
 */
public class DayMenuWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "DayMenuWidget";
    static final String ACTION_MIDNIGHT = "pl.user.daymenu.WIDGET_MIDNIGHT";
    private static final int RC_MIDNIGHT = 100;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent != null && ACTION_MIDNIGHT.equals(intent.getAction())) {
            refresh(ctx);   // refresh() uzbraja alarm na kolejną noc
            return;
        }
        super.onReceive(ctx, intent);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
        armMidnight(ctx);
    }

    /** Launcher zmienił rozmiar → dobierz wariant na nowo. */
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle newOptions) {
        render(ctx, mgr, new int[]{ id });
    }

    @Override public void onEnabled(Context ctx) { armMidnight(ctx); }
    @Override public void onDisabled(Context ctx) { cancelMidnight(ctx); }

    /** Woła WidgetPlugin po każdym zapisie danych w aplikacji i alarm po północy. */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, DayMenuWidgetProvider.class));
        if (ids.length == 0) return;
        render(ctx, mgr, ids);
        armMidnight(ctx);
    }

    private static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        WidgetModel model = loadModel(ctx);
        Calendar now = Calendar.getInstance();
        for (int id : ids) {
            try {
                mgr.updateAppWidget(id, buildFor(ctx, mgr, id, model, now));
            } catch (Exception e) {
                // np. przekroczony limit pamięci bitmap w hoście — widżet nie może wywalić apki
                Log.w(TAG, "updateAppWidget(" + id + ") failed", e);
            }
        }
    }

    static WidgetModel loadModel(Context ctx) {
        android.content.SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
        return WidgetModel.parse(sp.getString(WidgetPlugin.KEY_DATA, ""), sp.getLong(WidgetPlugin.KEY_SAVED_AT, 0L),
                Calendar.getInstance());
    }

    /**
     * API 31+: mapa rozmiar→RemoteViews dla wszystkich rozmiarów zgłoszonych przez launcher (pion/poziom),
     * host sam wybiera pasujący. Starsze: jeden układ z opcji min/max (pion: minW×maxH, poziom: maxW×minH).
     */
    private static RemoteViews buildFor(Context ctx, AppWidgetManager mgr, int id, WidgetModel m, Calendar now) {
        Bundle opts = mgr.getAppWidgetOptions(id);
        float fontScale = ctx.getResources().getConfiguration().fontScale;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && opts != null) {
            ArrayList<SizeF> sizes = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? opts.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF.class)
                    : opts.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty() && sizes.size() <= 16) {
                Map<SizeF, RemoteViews> map = new HashMap<>();
                for (SizeF s : sizes) {
                    int w = Math.round(s.getWidth()), h = Math.round(s.getHeight());
                    if (w <= 0 || h <= 0) continue;
                    map.put(s, WidgetRenderer.build(ctx, m, WidgetSpec.forSize(w, h, fontScale), w, h, now));
                }
                if (!map.isEmpty()) return new RemoteViews(map);
            }
        }

        int minW = 0, maxW = 0, minH = 0, maxH = 0;
        if (opts != null) {
            minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
            maxW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
            minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            maxH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        }
        boolean landscape = ctx.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int w = landscape ? maxW : minW;
        int h = landscape ? minH : maxH;
        if (w <= 0 || h <= 0) { w = 250; h = 180; }   // = minWidth/minHeight z widget_daymenu_info.xml
        return WidgetRenderer.build(ctx, m, WidgetSpec.forSize(w, h, fontScale), w, h, now);
    }

    // ---- alarm „po północy": przerysuj, żeby „dziś" i odliczanie były aktualne bez otwierania apki ----

    private static PendingIntent midnightIntent(Context ctx) {
        Intent i = new Intent(ctx, DayMenuWidgetProvider.class).setAction(ACTION_MIDNIGHT);
        return PendingIntent.getBroadcast(ctx, RC_MIDNIGHT, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void armMidnight(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, 1);
            c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 2);
            c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            // niedokładny (bez SCHEDULE_EXACT_ALARM); w Doze może się przesunąć o kilka minut — nie szkodzi
            am.setAndAllowWhileIdle(AlarmManager.RTC, c.getTimeInMillis(), midnightIntent(ctx));
        } catch (Exception e) {
            Log.w(TAG, "armMidnight failed", e);
        }
    }

    static void cancelMidnight(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(midnightIntent(ctx));
        } catch (Exception e) {
            Log.w(TAG, "cancelMidnight failed", e);
        }
    }
}
