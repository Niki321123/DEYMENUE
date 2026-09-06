package pl.user.daymenu;

import java.util.Calendar;

/** Polskie napisy widżetu. Czyste (bez android.*) — testowalne i wspólne dla wszystkich rozmiarów. */
public final class WidgetText {

    /** Duża liczba w nagłówku. */
    public static String hours(WidgetModel m) {
        if (!m.hasData) return "— h";
        if (m.total == 0) return "0 h";
        return m.left + " h";
    }

    /** Zdanie pod nagłówkiem. */
    public static String sub(WidgetModel m) {
        if (!m.hasData) return "Otwórz Day Menu, aby wczytać dane";
        if (m.total == 0) return "Brak nauki w planie na dziś";
        if (m.left == 0) return "Zrobione " + m.done + "/" + m.total + " ✓";
        return "Do zrobienia · zrobione " + m.done + "/" + m.total;
    }

    private static String noLead(String hhmm) {
        return hhmm != null && hhmm.startsWith("0") ? hhmm.substring(1) : (hhmm == null ? "" : hhmm);
    }
    private static String lekcje(int n) {
        if (n == 1) return "lekcja";
        int last = n % 10, last2 = n % 100;
        if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return "lekcje";
        return "lekcji";
    }
    public static String school(WidgetModel m) {
        if (!m.hasSchool) return "";
        String s = "Szkoła " + noLead(m.schoolFrom) + "–" + noLead(m.schoolTo);
        if (m.schoolCount > 0) s += " · " + m.schoolCount + " " + lekcje(m.schoolCount);
        return s;
    }

    public static String planTime(int h) { return (h < 10 ? "0" + h : String.valueOf(h)) + ":00"; }

    public static String daysLeft(int d) {
        if (d <= 0) return "dziś";
        if (d == 1) return "jutro";
        return "za " + d + " dni";
    }
    public static String examLine(WidgetModel.Exam e) {
        StringBuilder b = new StringBuilder(e.subject);
        if (e.type != null && !e.type.isEmpty() && !e.type.equalsIgnoreCase(e.subject)) b.append(" · ").append(e.type);
        b.append(" · ").append(daysLeft(e.daysLeft));
        return b.toString();
    }

    public static String more(int n) { return "+" + n + " więcej"; }

    /** „Pn 6.09" dla dzisiejszej daty. */
    public static String today(Calendar now) {
        return WidgetModel.WD[WidgetModel.dow(now)] + " " + now.get(Calendar.DAY_OF_MONTH) + "." +
                String.format("%02d", now.get(Calendar.MONTH) + 1);
    }

    private WidgetText() {}
}
