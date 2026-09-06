package pl.user.daymenu;

import static org.junit.Assert.*;

import org.junit.Test;

import java.util.Calendar;
import java.util.TimeZone;

public class WidgetTextTest {

    private static WidgetModel model(boolean hasData, int total, int done) {
        WidgetModel m = new WidgetModel();
        m.hasData = hasData; m.total = total; m.done = done; m.left = Math.max(0, total - done);
        return m;
    }

    @Test public void hoursAndSub() {
        assertEquals("— h", WidgetText.hours(model(false, 0, 0)));
        assertEquals("Otwórz Day Menu, aby wczytać dane", WidgetText.sub(model(false, 0, 0)));
        assertEquals("0 h", WidgetText.hours(model(true, 0, 0)));
        assertEquals("Brak nauki w planie na dziś", WidgetText.sub(model(true, 0, 0)));
        assertEquals("2 h", WidgetText.hours(model(true, 3, 1)));
        assertEquals("Do zrobienia · zrobione 1/3", WidgetText.sub(model(true, 3, 1)));
        assertEquals("0 h", WidgetText.hours(model(true, 3, 3)));
        assertEquals("Zrobione 3/3 ✓", WidgetText.sub(model(true, 3, 3)));
    }

    @Test public void schoolPlural() {
        WidgetModel m = new WidgetModel();
        m.hasSchool = true; m.schoolFrom = "08:00"; m.schoolTo = "14:35";
        m.schoolCount = 1; assertEquals("Szkoła 8:00–14:35 · 1 lekcja", WidgetText.school(m));
        m.schoolCount = 3; assertEquals("Szkoła 8:00–14:35 · 3 lekcje", WidgetText.school(m));
        m.schoolCount = 7; assertEquals("Szkoła 8:00–14:35 · 7 lekcji", WidgetText.school(m));
        m.schoolCount = 12; assertEquals("Szkoła 8:00–14:35 · 12 lekcji", WidgetText.school(m));
        m.hasSchool = false; assertEquals("", WidgetText.school(m));
    }

    @Test public void examLineAndDays() {
        assertEquals("dziś", WidgetText.daysLeft(0));
        assertEquals("jutro", WidgetText.daysLeft(1));
        assertEquals("za 5 dni", WidgetText.daysLeft(5));
        assertEquals("Matematyka · Sprawdzian · za 3 dni",
                WidgetText.examLine(new WidgetModel.Exam("Matematyka", "Sprawdzian", 3, false)));
        // typ pominięty, gdy pusty lub równy przedmiotowi
        assertEquals("Fizyka · jutro", WidgetText.examLine(new WidgetModel.Exam("Fizyka", "", 1, false)));
        assertEquals("Sprawdzian · dziś", WidgetText.examLine(new WidgetModel.Exam("Sprawdzian", "Sprawdzian", 0, false)));
    }

    @Test public void planTimeAndMore() {
        assertEquals("08:00", WidgetText.planTime(8));
        assertEquals("16:00", WidgetText.planTime(16));
        assertEquals("+2 więcej", WidgetText.more(2));
    }

    @Test public void todayLabel() {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Europe/Warsaw"));
        c.clear(); c.set(2026, Calendar.SEPTEMBER, 9, 10, 0, 0);
        assertEquals("Śr 9.09", WidgetText.today(c));
    }
}
