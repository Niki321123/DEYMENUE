package pl.user.daymenu;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Model + wariant rozmiaru → RemoteViews. Jedyne miejsce, które zna id widoków z układów.
 *
 * Zasady RemoteViews, których się tu trzymamy:
 *  - host NAKŁADA nowe akcje na już wyświetlone drzewo (reapply), więc każdy przełączany widok
 *    ustawiamy przy KAŻDYM przerysowaniu (widoczność, tekst), nigdy „tylko gdy się zmieniło";
 *  - akcja na id, którego nie ma w układzie, może rzucić w hoście — każdy wariant zawiera
 *    nagłówek + wiersze planu, wykres tylko MEDIUM/LARGE, sprawdziany tylko LARGE, i tylko tych
 *    id dotykamy;
 *  - własnych widoków nie ma → wykres to bitmapa, odhaczone wiersze to SpannableString
 *    (przekreślenie + kolor), a nie osobne widoki.
 */
final class WidgetRenderer {

    private static final int[] PLAN_IDS = {
            R.id.widget_plan_0, R.id.widget_plan_1, R.id.widget_plan_2,
            R.id.widget_plan_3, R.id.widget_plan_4, R.id.widget_plan_5 };
    private static final int[] EXAM_IDS = { R.id.widget_exam_0, R.id.widget_exam_1, R.id.widget_exam_2 };

    /** Zakładki apki (prawdziwe id widoków z data-view) i kody żądań PendingIntentów. */
    static final String TAB_PLAN = "matura", TAB_CHART = "time", TAB_EXAMS = "exams";
    private static final int RC_PLAN = 1, RC_CHART = 2, RC_EXAMS = 3;

    static RemoteViews build(Context ctx, WidgetModel m, WidgetSpec spec, int wDp, int hDp, Calendar now) {
        int layout;
        switch (spec.tier) {
            case LARGE:  layout = R.layout.widget_daymenu_large; break;
            case MEDIUM: layout = R.layout.widget_daymenu_medium; break;
            default:     layout = R.layout.widget_daymenu_small;
        }
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layout);
        float fs = Math.max(1f, ctx.getResources().getConfiguration().fontScale);

        // ---- nagłówek ----
        rv.setTextViewText(R.id.widget_hours, WidgetText.hours(m));
        String sub = WidgetText.sub(m);
        if (m.hasData) sub += " · " + WidgetText.today(now);
        rv.setTextViewText(R.id.widget_sub, sub);

        boolean school = spec.showSchool && m.hasSchool;
        rv.setViewVisibility(R.id.widget_school, school ? View.VISIBLE : View.GONE);
        rv.setTextViewText(R.id.widget_school, school ? WidgetText.school(m) : "");

        // ---- plan na dziś (stałe wiersze) ----
        List<WidgetModel.Row> shown = pickRows(m.today, spec.planRows);
        int hidden = m.today.size() - shown.size();
        int doneColor = ctx.getColor(R.color.widget_done);
        for (int i = 0; i < PLAN_IDS.length; i++) {
            if (i < shown.size()) {
                rv.setTextViewText(PLAN_IDS[i], rowText(shown.get(i), doneColor));
                rv.setViewVisibility(PLAN_IDS[i], View.VISIBLE);
            } else {
                rv.setTextViewText(PLAN_IDS[i], "");
                rv.setViewVisibility(PLAN_IDS[i], View.GONE);
            }
        }
        rv.setTextViewText(R.id.widget_plan_more, hidden > 0 ? WidgetText.more(hidden) : "");
        rv.setViewVisibility(R.id.widget_plan_more, hidden > 0 ? View.VISIBLE : View.GONE);

        // ---- wykres (tylko układy, które go mają) ----
        int examsShown = 0;
        if (spec.tier == WidgetSpec.Tier.LARGE) examsShown = Math.min(spec.examRows, m.exams.size());
        if (spec.showChart) {
            int usedDp = estimateUsedDp(spec, fs, school, shown.size(), hidden > 0, examsShown, m.exams.isEmpty());
            int chartHdp = Math.max(36, hDp - usedDp);
            int chartWdp = Math.max(120, wDp - 24);
            rv.setImageViewBitmap(R.id.widget_chart, chart(ctx, m.chart, chartWdp, chartHdp));
        }

        // ---- sprawdziany (tylko LARGE) ----
        if (spec.tier == WidgetSpec.Tier.LARGE) {
            String label = ctx.getString(R.string.widget_exams_title);
            if (m.exams.size() > examsShown) label += " · " + m.exams.size();
            rv.setTextViewText(R.id.widget_exams_label, label);
            for (int i = 0; i < EXAM_IDS.length; i++) {
                if (i < examsShown) {
                    rv.setTextViewText(EXAM_IDS[i], WidgetText.examLine(m.exams.get(i)));
                    rv.setViewVisibility(EXAM_IDS[i], View.VISIBLE);
                } else {
                    rv.setTextViewText(EXAM_IDS[i], "");
                    rv.setViewVisibility(EXAM_IDS[i], View.GONE);
                }
            }
            rv.setViewVisibility(R.id.widget_exams_empty,
                    (m.hasData && m.exams.isEmpty()) ? View.VISIBLE : View.GONE);
        }

        // ---- tapy: każde pole otwiera swoją zakładkę; tło → plan ----
        rv.setOnClickPendingIntent(R.id.widget_root, open(ctx, TAB_PLAN, RC_PLAN));
        rv.setOnClickPendingIntent(R.id.widget_plan_box, open(ctx, TAB_PLAN, RC_PLAN));
        if (spec.showChart) rv.setOnClickPendingIntent(R.id.widget_chart_box, open(ctx, TAB_CHART, RC_CHART));
        if (spec.tier == WidgetSpec.Tier.LARGE) rv.setOnClickPendingIntent(R.id.widget_exams_box, open(ctx, TAB_EXAMS, RC_EXAMS));
        return rv;
    }

    /**
     * Które wiersze pokazać, gdy nie wszystkie się mieszczą: chronologicznie, ale najpierw
     * wypadają ZROBIONE (od najwcześniejszych — one są już nieistotne, a licznik w nagłówku
     * i tak je zlicza), potem ucinamy ogon. Przy nadmiarze jeden slot idzie na „+N więcej".
     */
    static List<WidgetModel.Row> pickRows(List<WidgetModel.Row> rows, int cap) {
        if (rows.size() <= cap) return rows;
        int slots = Math.max(1, cap - 1);
        List<WidgetModel.Row> pick = new ArrayList<>(rows);
        for (int i = 0; i < pick.size() && pick.size() > slots; ) {
            if (pick.get(i).done) pick.remove(i); else i++;
        }
        if (pick.size() > slots) pick = new ArrayList<>(pick.subList(0, slots));
        return pick;
    }

    private static CharSequence rowText(WidgetModel.Row r, int doneColor) {
        String base = WidgetText.planTime(r.h) + "  " + r.name;
        if (!r.done) return base;
        SpannableString s = new SpannableString("✓ " + base);
        s.setSpan(new StrikethroughSpan(), 2, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new ForegroundColorSpan(doneColor), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    /** Szacunek (dp) wysokości zajętej przez wszystko poza wykresem — żeby bitmapa miała
     *  proporcje zbliżone do pudełka (fitCenter i tak domknie resztę). */
    private static int estimateUsedDp(WidgetSpec spec, float fs, boolean school, int rows, boolean more,
                                      int examsShown, boolean examsEmpty) {
        float used = 24 /* padding */ + 40 * fs /* nagłówek */ + 6 + 16 * fs + 2 /* etykieta wykresu */;
        if (school) used += 18 * fs;
        used += rows * 19 * fs;
        if (more) used += 18 * fs;
        if (spec.tier == WidgetSpec.Tier.LARGE) {
            used += 8 + 20 + 16 * fs;                         // margines + padding + etykieta
            used += (examsShown > 0 ? examsShown : (examsEmpty ? 1 : 0)) * 18 * fs;
        }
        return Math.round(used);
    }

    /** Słupkowy wykres produktywności (7 dni, ostatni = dziś). v = -1 → brak danych tego dnia. */
    static Bitmap chart(Context ctx, List<WidgetModel.Bar> bars, int wDp, int hDp) {
        DisplayMetrics dm = ctx.getResources().getDisplayMetrics();
        float d = dm.density;
        float sp = d * Math.max(1f, ctx.getResources().getConfiguration().fontScale);
        // limit pamięci bitmapy (host liczy wszystkie warianty razem) — skalujemy w dół, nie w górę
        float scale = Math.min(1f, 900f / (wDp * d));
        int W = Math.max(64, Math.round(wDp * d * scale));
        int H = Math.max(32, Math.round(hDp * d * scale));
        d *= scale; sp *= scale;

        Bitmap bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint txt = new Paint(Paint.ANTI_ALIAS_FLAG);
        txt.setTextAlign(Paint.Align.CENTER);
        txt.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        int colBar = ctx.getColor(R.color.widget_bar), colToday = ctx.getColor(R.color.widget_accent);
        int colEmpty = ctx.getColor(R.color.widget_bar_empty), colLabel = ctx.getColor(R.color.widget_text_3);
        int colText = ctx.getColor(R.color.widget_text);

        int n = bars.size() == 0 ? 7 : bars.size();
        float slot = (float) W / n;
        float bw = slot * 0.56f;
        float lblSize = 11 * sp, valSize = 10 * sp;
        boolean showVals = H >= 60 * d;
        float lblH = lblSize + 6 * d;
        float top = showVals ? valSize + 6 * d : 3 * d;
        float base = H - lblH;
        float chartH = Math.max(8 * d, base - top);

        float max = 100f;
        for (WidgetModel.Bar b : bars) if (b.v > max) max = b.v;

        for (int i = 0; i < n; i++) {
            float cx = slot * i + slot / 2f;
            WidgetModel.Bar b = i < bars.size() ? bars.get(i) : null;
            int v = b == null ? -1 : b.v;
            String label = b == null ? "" : b.label;
            boolean isToday = (i == n - 1);
            if (v < 0) {
                bar.setColor(colEmpty);
                c.drawRoundRect(new RectF(cx - bw / 2, base - 3 * d, cx + bw / 2, base), 2 * d, 2 * d, bar);
            } else {
                float h = Math.max(3 * d, v / max * chartH);
                bar.setColor(isToday ? colToday : colBar);
                c.drawRoundRect(new RectF(cx - bw / 2, base - h, cx + bw / 2, base), 4 * d, 4 * d, bar);
                if (showVals) {
                    txt.setColor(isToday ? colToday : colLabel);
                    txt.setTextSize(valSize);
                    c.drawText(v + "%", cx, base - h - 3 * d, txt);
                }
            }
            txt.setColor(isToday ? colText : colLabel);
            txt.setTextSize(lblSize);
            c.drawText(label, cx, H - 3 * d, txt);
        }
        return bmp;
    }

    /**
     * Osobny PendingIntent na zakładkę: inny requestCode I inna akcja — FLAG_UPDATE_CURRENT scala
     * intenty równe wg filterEquals (ekstra się nie liczą), więc bez własnej akcji wszystkie trzy
     * tapy dostałyby ekstra ostatniego z nich.
     */
    private static PendingIntent open(Context ctx, String tab, int rc) {
        Intent i = new Intent(ctx, MainActivity.class)
                .setAction("pl.user.daymenu.OPEN_TAB." + tab)
                .putExtra(WidgetPlugin.EXTRA_TAB, tab)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, rc, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private WidgetRenderer() {}
}
