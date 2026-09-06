package pl.user.daymenu;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Czysta logika widżetu — BEZ importów android.* (żeby dała się testować JUnitem na zwykłej JVM).
 * Zamienia payload z apki (JSON, patrz widgetPayload() w DayMenu.html) na gotowy do narysowania
 * model, LICZĄC „dziś" i „za N dni" względem przekazanego `now` — dzięki temu widżet jest poprawny
 * rano bez otwierania apki (rollover doby, odliczanie sprawdzianów).
 *
 * Zgodność wstecz: payload sprzed wersji 2 ma tylko total/done/days — wtedy legacyOnly=true.
 */
public final class WidgetModel {

    public static final String[] WD = {"Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"};

    public static final class Row {
        public final int h; public final String name; public final boolean done;
        Row(int h, String name, boolean done) { this.h = h; this.name = name; this.done = done; }
    }
    public static final class Bar {
        public final String label; public final int v;   // v = -1 → brak danych tego dnia
        Bar(String label, int v) { this.label = label; this.v = v; }
    }
    public static final class Exam {
        public final String subject, type; public final int daysLeft; public final boolean retake;
        Exam(String s, String t, int d, boolean r) { subject = s; type = t; daysLeft = d; retake = r; }
    }

    public boolean hasData;
    public boolean legacyOnly;                 // payload v1 (brak pola plan) → tylko nagłówek + wykres
    public int total, done, left;
    public final List<Row> today = new ArrayList<>();
    public final List<Bar> chart = new ArrayList<>();   // zawsze 7, ostatni = dziś
    public final List<Exam> exams = new ArrayList<>();
    public boolean hasSchool;
    public String schoolFrom = "", schoolTo = "";
    public int schoolCount;

    /** dow 0=poniedziałek..6=niedziela z Calendar (Calendar.SUNDAY==1). */
    public static int dow(Calendar c) { return (c.get(Calendar.DAY_OF_WEEK) + 5) % 7; }

    private static Calendar midnight(Calendar c) {
        Calendar x = (Calendar) c.clone();
        x.set(Calendar.HOUR_OF_DAY, 0); x.set(Calendar.MINUTE, 0);
        x.set(Calendar.SECOND, 0); x.set(Calendar.MILLISECOND, 0);
        return x;
    }
    private static String ymd(Calendar c) {
        return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }
    private static Calendar plusDays(Calendar c, int d) {
        Calendar x = (Calendar) c.clone(); x.add(Calendar.DAY_OF_MONTH, d); return x;
    }
    /** Data "yyyy-MM-dd" → północ lokalna w strefie `now`; null gdy format zły. */
    private static Calendar fromYmd(String s, Calendar now) {
        if (s == null || s.length() < 10) return null;
        try {
            int y = Integer.parseInt(s.substring(0, 4));
            int mo = Integer.parseInt(s.substring(5, 7));
            int d = Integer.parseInt(s.substring(8, 10));
            Calendar c = Calendar.getInstance(now.getTimeZone());
            c.clear(); c.set(y, mo - 1, d, 0, 0, 0);
            return c;
        } catch (Exception e) { return null; }
    }
    /** Pełne doby między dwiema północami (odporne na DST przez zaokrąglenie). */
    private static int daysBetween(Calendar fromMidnight, Calendar toMidnight) {
        double diff = toMidnight.getTimeInMillis() - fromMidnight.getTimeInMillis();
        return (int) Math.round(diff / 86400000.0);
    }
    private static String mondayYmd(Calendar now) {
        Calendar m = midnight(now);
        return ymd(plusDays(m, -dow(m)));
    }

    public static WidgetModel parse(String json, long savedAtMs, Calendar now) {
        WidgetModel m = new WidgetModel();
        Calendar mid = midnight(now);
        // Pusty wykres na wypadek braku/awarii danych — oś zawsze 7-slotowa.
        for (int j = 0; j < 7; j++) {
            Calendar dj = plusDays(mid, j - 6);
            m.chart.add(new Bar(WD[dow(dj)], -1));
        }
        if (json == null || json.trim().isEmpty()) return m;

        JSONObject j;
        try { j = new JSONObject(json); } catch (Exception e) { return m; }
        m.hasData = true;

        JSONObject plan = j.optJSONObject("plan");
        m.legacyOnly = (plan == null);

        // ---- wykres: mapujemy każdy dzień payloadu na jego DATĘ, potem czytamy dla dat now-6..now ----
        JSONArray days = j.optJSONArray("days");
        Map<String, Integer> byDate = new LinkedHashMap<>();
        if (days != null && days.length() > 0) {
            Calendar pushMid = savedAtMs > 0
                    ? midnight(calAt(savedAtMs, now))
                    : mid;   // brak savedAt → zakładamy, że ostatni słupek to dziś
            int len = days.length();
            for (int k = 0; k < len; k++) {
                JSONObject d = days.optJSONObject(k);
                if (d == null) continue;
                String ds = d.optString("d", null);
                if (ds == null || ds.length() < 10)
                    ds = ymd(plusDays(pushMid, -(len - 1 - k)));   // v1: brak "d" → licz od daty pushu
                byDate.put(ds, (int) Math.round(d.optDouble("v", -1)));
            }
            for (int slot = 0; slot < 7; slot++) {
                Calendar dj = plusDays(mid, slot - 6);
                Integer v = byDate.get(ymd(dj));
                m.chart.set(slot, new Bar(WD[dow(dj)], v == null ? -1 : v));
            }
        }

        // ---- „done" jest ważne tylko w bieżącym tygodniu ISO (znaczniki resetują się w poniedziałek) ----
        String weekStart = j.optString("weekStart", "");
        boolean doneValid = !weekStart.isEmpty() && weekStart.equals(mondayYmd(now));

        int dowNow = dow(now);
        if (plan != null) {
            JSONArray arr = plan.optJSONArray(String.valueOf(dowNow));
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject b = arr.optJSONObject(i);
                    if (b == null) continue;
                    String name = b.optString("name", "").trim();
                    if (name.isEmpty()) name = "Nauka";
                    m.today.add(new Row(b.optInt("h", 0), name, b.optBoolean("done", false) && doneValid));
                }
            }
            m.today.sort((a, b) -> a.h - b.h);
            m.total = m.today.size();
            int dn = 0; for (Row r : m.today) if (r.done) dn++;
            m.done = dn;
        } else {
            m.total = j.optInt("total", 0);
            m.done = j.optInt("done", 0);
        }
        m.left = Math.max(0, m.total - m.done);

        // ---- pasmo szkoły z lekcji na dziś ----
        JSONObject school = j.optJSONObject("school");
        if (school != null) {
            JSONObject s = school.optJSONObject(String.valueOf(dowNow));
            if (s != null) {
                m.hasSchool = true;
                m.schoolFrom = s.optString("from", "");
                m.schoolTo = s.optString("to", "");
            }
        }
        JSONObject lessons = j.optJSONObject("lessons");
        if (lessons != null) {
            JSONArray l = lessons.optJSONArray(String.valueOf(dowNow));
            if (l != null) m.schoolCount = l.length();
        }

        // ---- sprawdziany: przelicz „za N dni" TERAZ, odrzuć przeszłe, posortuj ----
        JSONArray ex = j.optJSONArray("exams");
        if (ex != null) {
            for (int i = 0; i < ex.length(); i++) {
                JSONObject e = ex.optJSONObject(i);
                if (e == null) continue;
                Calendar ed = fromYmd(e.optString("date", ""), now);
                if (ed == null) continue;
                int dl = daysBetween(mid, ed);
                if (dl < 0) continue;
                String subj = e.optString("subject", "").trim();
                String type = e.optString("type", "").trim();
                if (subj.isEmpty()) subj = type.isEmpty() ? "Sprawdzian" : type;
                m.exams.add(new Exam(subj, type, dl, e.optBoolean("retake", false)));
            }
            m.exams.sort((a, b) -> a.daysLeft - b.daysLeft);
        }
        return m;
    }

    private static Calendar calAt(long ms, Calendar now) {
        Calendar c = Calendar.getInstance(now.getTimeZone());
        c.setTimeInMillis(ms);
        return c;
    }
}
