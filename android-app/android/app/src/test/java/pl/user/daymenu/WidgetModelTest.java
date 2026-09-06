package pl.user.daymenu;

import static org.junit.Assert.*;

import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

public class WidgetModelTest {

    private static final TimeZone TZ = TimeZone.getTimeZone("Europe/Warsaw");

    /** Środa 2026-09-09 10:00 (poniedziałek tego tygodnia = 2026-09-07, dowNow=2). */
    private static Calendar now() {
        Calendar c = Calendar.getInstance(TZ);
        c.clear(); c.set(2026, Calendar.SEPTEMBER, 9, 10, 0, 0);
        return c;
    }
    private static long ms(int y, int mo, int d) {
        Calendar c = Calendar.getInstance(TZ);
        c.clear(); c.set(y, mo, d, 10, 0, 0);
        return c.getTimeInMillis();
    }

    @Test public void emptyAndMalformed() {
        WidgetModel a = WidgetModel.parse("", 0, now());
        assertFalse(a.hasData);
        assertEquals(7, a.chart.size());
        for (WidgetModel.Bar b : a.chart) assertEquals(-1, b.v);
        assertFalse(WidgetModel.parse("{nie json", 0, now()).hasData);
        assertEquals("Śr", a.chart.get(6).label);   // ostatni słupek to dziś (środa)
    }

    @Test public void legacyV1() {
        String js = "{\"total\":3,\"done\":1,\"days\":["
                + "{\"l\":\"Cz\",\"v\":10},{\"l\":\"Pt\",\"v\":20},{\"l\":\"So\",\"v\":30},"
                + "{\"l\":\"Nd\",\"v\":40},{\"l\":\"Pn\",\"v\":50},{\"l\":\"Wt\",\"v\":60},{\"l\":\"Śr\",\"v\":70}]}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertTrue(m.hasData);
        assertTrue(m.legacyOnly);
        assertEquals(3, m.total); assertEquals(1, m.done); assertEquals(2, m.left);
        assertTrue(m.today.isEmpty());
        assertEquals(70, m.chart.get(6).v);   // push=dziś → ostatni słupek = 70
    }

    @Test public void v2SameWeekKeepsDone() {
        String js = "{\"v\":2,\"weekStart\":\"2026-09-07\",\"plan\":{\"2\":["
                + "{\"h\":16,\"name\":\"Matematyka\",\"done\":true},{\"h\":8,\"name\":\"\",\"done\":false}]}}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertFalse(m.legacyOnly);
        assertEquals(2, m.today.size());
        assertEquals(8, m.today.get(0).h);          // posortowane po godzinie
        assertEquals("Nauka", m.today.get(0).name); // pusta nazwa → fallback
        assertEquals(16, m.today.get(1).h);
        assertTrue(m.today.get(1).done);
        assertEquals(2, m.total); assertEquals(1, m.done); assertEquals(1, m.left);
    }

    @Test public void v2StaleWeekResetsDone() {
        String js = "{\"v\":2,\"weekStart\":\"2026-08-31\",\"plan\":{\"2\":["
                + "{\"h\":16,\"name\":\"Matematyka\",\"done\":true}]}}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertEquals(1, m.today.size());
        assertFalse("znaczniki z innego tygodnia muszą zostać wyzerowane", m.today.get(0).done);
        assertEquals(0, m.done);
    }

    @Test public void chartByDate() {
        String js = "{\"v\":2,\"weekStart\":\"2026-09-07\",\"plan\":{},\"days\":["
                + "{\"l\":\"Wt\",\"v\":55,\"d\":\"2026-09-08\"},{\"l\":\"Śr\",\"v\":80,\"d\":\"2026-09-09\"}]}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertEquals(80, m.chart.get(6).v);   // dziś
        assertEquals(55, m.chart.get(5).v);   // wczoraj
        assertEquals(-1, m.chart.get(0).v);   // brak danych 6 dni temu
    }

    @Test public void chartRolloverV1NoDates() {
        // payload zapisany WCZORAJ (2026-09-08), 7 słupków bez pola "d"
        String js = "{\"total\":0,\"done\":0,\"days\":["
                + "{\"l\":\"Śr\",\"v\":10},{\"l\":\"Cz\",\"v\":20},{\"l\":\"Pt\",\"v\":30},"
                + "{\"l\":\"So\",\"v\":40},{\"l\":\"Nd\",\"v\":50},{\"l\":\"Pn\",\"v\":60},{\"l\":\"Wt\",\"v\":70}]}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 8), now());
        assertEquals(-1, m.chart.get(6).v);   // dziś (2026-09-09) nie ma jeszcze danych
        assertEquals(70, m.chart.get(5).v);   // wczoraj (2026-09-08) = ostatni słupek payloadu
        assertEquals("Śr", m.chart.get(6).label);
    }

    @Test public void examsCountdownSortDropPast() {
        String js = "{\"v\":2,\"exams\":["
                + "{\"date\":\"2026-09-12\",\"subject\":\"Matematyka\",\"type\":\"Sprawdzian\"},"
                + "{\"date\":\"2026-09-09\",\"subject\":\"Fizyka\",\"type\":\"Kartkówka\"},"
                + "{\"date\":\"2026-09-10\",\"subject\":\"WOS\",\"type\":\"Poprawa\",\"retake\":true},"
                + "{\"date\":\"2026-09-01\",\"subject\":\"Historia\",\"type\":\"Sprawdzian\"},"
                + "{\"date\":\"bzdura\",\"subject\":\"X\"}]}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertEquals(3, m.exams.size());                 // przeszłe i zły format odrzucone
        assertEquals("Fizyka", m.exams.get(0).subject);  // dziś
        assertEquals(0, m.exams.get(0).daysLeft);
        assertEquals(1, m.exams.get(1).daysLeft);        // jutro
        assertTrue(m.exams.get(1).retake);
        assertEquals(3, m.exams.get(2).daysLeft);
    }

    @Test public void schoolSpan() {
        String js = "{\"v\":2,\"school\":{\"2\":{\"from\":\"08:00\",\"to\":\"14:35\"}},"
                + "\"lessons\":{\"2\":[{\"from\":\"08:00\",\"to\":\"08:45\"},{\"from\":\"12:00\",\"to\":\"14:35\"}]}}";
        WidgetModel m = WidgetModel.parse(js, ms(2026, Calendar.SEPTEMBER, 9), now());
        assertTrue(m.hasSchool);
        assertEquals("08:00", m.schoolFrom);
        assertEquals("14:35", m.schoolTo);
        assertEquals(2, m.schoolCount);
    }
}
