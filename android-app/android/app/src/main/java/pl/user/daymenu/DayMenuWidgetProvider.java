package pl.user.daymenu;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widżet ekranu głównego (4 kolumny x 3 rzędy): ile godzin nauki zostało dzisiaj
 * + wykres słupkowy produktywności z ostatnich 7 dni (ta sama metryka co linia
 * "Produktywność" w zakładce Analiza czasu: sen 50% + nauka 50%).
 *
 * Dane przychodzą z aplikacji przez WidgetPlugin (SharedPreferences), więc widżet
 * pokazuje stan z ostatniego uruchomienia apki — kliknięcie otwiera aplikację.
 * Wykres rysujemy na bitmapie, bo RemoteViews nie obsługuje własnych widoków.
 */
public class DayMenuWidgetProvider extends AppWidgetProvider {

    /* kolory zgodne z ciemnym motywem aplikacji */
    private static final int COL_BAR    = 0xFF2D6CDF; // linia "Produktywność" w apce
    private static final int COL_TODAY  = 0xFFE8743B; // akcent (dzisiejszy słupek)
    private static final int COL_EMPTY  = 0xFF3A4150; // dzień bez danych
    private static final int COL_LABEL  = 0xFF9AA3B2;

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    /** Woła WidgetPlugin po każdym zapisie danych w aplikacji. */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, DayMenuWidgetProvider.class));
        if (ids.length > 0) mgr.updateAppWidget(ids, build(ctx));
    }

    private static RemoteViews build(Context ctx) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_daymenu);

        String raw = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE)
                .getString(WidgetPlugin.KEY_DATA, "");
        try {
            JSONObject j = new JSONObject(raw);
            int total = j.optInt("total", 0);
            int done = j.optInt("done", 0);
            int left = Math.max(0, total - done);
            if (total == 0) {
                rv.setTextViewText(R.id.widget_hours, "0 h");
                rv.setTextViewText(R.id.widget_sub, "Brak nauki w planie na dziś");
            } else {
                rv.setTextViewText(R.id.widget_hours, left + " h");
                rv.setTextViewText(R.id.widget_sub,
                        left == 0 ? "Cała nauka na dziś zrobiona (" + done + "/" + total + ") ✓"
                                  : "nauki do zrobienia dziś · zrobione " + done + "/" + total);
            }
            rv.setImageViewBitmap(R.id.widget_chart, chart(j.optJSONArray("days")));
        } catch (Exception e) {
            // brak danych (widżet dodany przed pierwszym uruchomieniem apki) lub zły JSON
            rv.setTextViewText(R.id.widget_hours, "— h");
            rv.setTextViewText(R.id.widget_sub, "Otwórz Day Menu, aby wczytać dane");
            rv.setImageViewBitmap(R.id.widget_chart, chart(null));
        }

        Intent open = new Intent(ctx, MainActivity.class);
        rv.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(
                ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return rv;
    }

    /** Słupkowy wykres produktywności (7 dni). value -1 = brak danych tego dnia. */
    private static Bitmap chart(JSONArray days) {
        final int W = 640, H = 300, LBL = 44, TOP = 34;
        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);

        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint txt = new Paint(Paint.ANTI_ALIAS_FLAG);
        txt.setTextAlign(Paint.Align.CENTER);
        txt.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        int n = days == null ? 7 : days.length();
        if (n == 0) n = 7;
        float slot = (float) W / n;
        float bw = slot * 0.56f;

        // skala: co najmniej 100%, ale rośnie gdy któryś dzień przekracza 100
        float max = 100f;
        if (days != null) for (int i = 0; i < days.length(); i++) {
            float v = (float) days.optJSONObject(i).optDouble("v", -1);
            if (v > max) max = v;
        }

        float chartH = H - LBL - TOP;
        for (int i = 0; i < n; i++) {
            float cx = slot * i + slot / 2f;
            float v = -1; String label = "";
            if (days != null && i < days.length()) {
                JSONObject d = days.optJSONObject(i);
                v = (float) d.optDouble("v", -1);
                label = d.optString("l", "");
            }
            boolean isToday = (i == n - 1);
            if (v < 0) {
                // brak danych — niski "pieniek", żeby oś była ciągła
                bar.setColor(COL_EMPTY);
                c.drawRoundRect(new RectF(cx - bw / 2, H - LBL - 8, cx + bw / 2, H - LBL), 6, 6, bar);
            } else {
                float h = Math.max(8f, v / max * chartH);
                bar.setColor(isToday ? COL_TODAY : COL_BAR);
                c.drawRoundRect(new RectF(cx - bw / 2, H - LBL - h, cx + bw / 2, H - LBL), 10, 10, bar);
                txt.setColor(isToday ? COL_TODAY : COL_LABEL);
                txt.setTextSize(24);
                c.drawText(Math.round(v) + "%", cx, H - LBL - h - 10, txt);
            }
            txt.setColor(isToday ? 0xFFECEFF4 : COL_LABEL);
            txt.setTextSize(26);
            c.drawText(label, cx, H - 12, txt);
        }
        return bmp;
    }
}
