package pl.user.daymenu;

/**
 * Wybór wariantu widżetu wg rozmiaru pudełka (dp). Czyste — testowalne bez Androida.
 * SMALL = tylko plan na dziś; MEDIUM = wykres + plan; LARGE = wykres + plan + sprawdziany.
 * Progi w dp odnoszą się do rozmiaru przydzielonego widżetowi przez launcher.
 */
public final class WidgetSpec {

    public enum Tier { SMALL, MEDIUM, LARGE }

    public final Tier tier;
    public final int planRows;     // ile wierszy planu zmieścić (reszta → „+N więcej")
    public final int examRows;     // ile sprawdzianów (0 poza LARGE)
    public final boolean showChart;
    public final boolean showSchool;

    private WidgetSpec(Tier t, int planRows, int examRows, boolean chart, boolean school) {
        this.tier = t; this.planRows = planRows; this.examRows = examRows; this.showChart = chart; this.showSchool = school;
    }

    private static int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }

    public static WidgetSpec forSize(int wDp, int hDp, float fontScale) {
        int rowDp = Math.round(20 * Math.max(1f, fontScale));   // wysokość jednego wiersza planu ze światłem

        // < ~2 kolumn: nigdy wykresu (7 słupków nieczytelne), tylko plan
        if (wDp < 200) {
            int rows = clamp((hDp - 60) / rowDp, 1, 6);
            return new WidgetSpec(Tier.SMALL, rows, 0, false, hDp >= 150);
        }
        if (hDp >= 250) {  // LARGE
            int examRows = hDp >= 300 ? 3 : 2;
            int rows = clamp((hDp - 250) / rowDp + 2, 2, 6);
            return new WidgetSpec(Tier.LARGE, rows, examRows, true, hDp >= 300);
        }
        if (hDp >= 160) {  // MEDIUM
            int rows = clamp((hDp - 160) / rowDp + 1, 1, 4);
            return new WidgetSpec(Tier.MEDIUM, rows, 0, true, false);
        }
        // niska i szeroka → SMALL, ale bez wykresu
        int rows = clamp((hDp - 60) / rowDp, 1, 4);
        return new WidgetSpec(Tier.SMALL, rows, 0, false, hDp >= 150);
    }

    @Override public String toString() {
        return tier + " plan=" + planRows + " exams=" + examRows + " chart=" + showChart + " school=" + showSchool;
    }
}
