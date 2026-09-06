package pl.user.daymenu;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/** Tylko czysta część renderera (wybór wierszy) — RemoteViews wymaga urządzenia. */
public class WidgetRendererTest {

    private static List<WidgetModel.Row> rows(String spec) {
        // "8d 10 12d 14" → godzina + opcjonalne 'd' = zrobione
        Calendar now = Calendar.getInstance(TimeZone.getTimeZone("Europe/Warsaw"));
        now.set(2026, Calendar.SEPTEMBER, 9, 10, 0, 0);
        StringBuilder plan = new StringBuilder("[");
        for (String p : spec.split(" ")) {
            boolean d = p.endsWith("d");
            int h = Integer.parseInt(d ? p.substring(0, p.length() - 1) : p);
            if (plan.length() > 1) plan.append(",");
            plan.append("{\"h\":").append(h).append(",\"name\":\"B").append(h).append("\",\"done\":").append(d).append("}");
        }
        plan.append("]");
        String json = "{\"v\":2,\"weekStart\":\"2026-09-07\",\"plan\":{\"2\":" + plan + "}}";
        return WidgetModel.parse(json, 0, now).today;
    }

    private static String hours(List<WidgetModel.Row> l) {
        StringBuilder b = new StringBuilder();
        for (WidgetModel.Row r : l) { if (b.length() > 0) b.append(" "); b.append(r.h); }
        return b.toString();
    }

    @Test public void allFit_returnsSameListUnchanged() {
        List<WidgetModel.Row> r = rows("8d 10 12");
        assertSame(r, WidgetRenderer.pickRows(r, 3));
        assertSame(r, WidgetRenderer.pickRows(r, 6));
    }

    @Test public void overflow_dropsDoneFirst_keepsChronology_leavesSlotForMore() {
        List<WidgetModel.Row> r = rows("8d 9d 10 12 14 16");
        // cap 4 → 3 sloty + „+N więcej"; wypadają zrobione 8 i 9, zostaje 10 12 14, ucięte 16
        assertEquals("10 12 14", hours(WidgetRenderer.pickRows(r, 4)));
        // cap 5 → 4 sloty: po zrzuceniu 8 i 9 mamy dokładnie 4 niezrobione
        assertEquals("10 12 14 16", hours(WidgetRenderer.pickRows(r, 5)));
    }

    @Test public void overflow_onlyUndone_truncatesTail() {
        List<WidgetModel.Row> r = rows("8 10 12 14 16");
        assertEquals("8 10", hours(WidgetRenderer.pickRows(r, 3)));
    }

    @Test public void capOne_stillShowsOneRow() {
        List<WidgetModel.Row> r = rows("8d 10 12");
        assertEquals("10", hours(WidgetRenderer.pickRows(r, 1)));
    }

    @Test public void doneDroppedOnlyAsNeeded_keepsLaterDone() {
        List<WidgetModel.Row> r = rows("8d 10d 12 14");
        // cap 3 → 2 sloty: wypada 8 (najwcześniejsze zrobione), potem 10; zostaje 12 14
        assertEquals("12 14", hours(WidgetRenderer.pickRows(r, 3)));
        List<WidgetModel.Row> r2 = rows("8d 9d 10 12d 14");
        // cap 4 → 3 sloty: wystarczy zrzucić 8 i 9 → 10 12d 14 (12 zrobione zostaje, chronologia zachowana)
        assertEquals("10 12 14", hours(WidgetRenderer.pickRows(r2, 4)));
        assertEquals(true, new ArrayList<>(WidgetRenderer.pickRows(r2, 4)).get(1).done);
    }
}
