package pl.user.daymenu;

import static org.junit.Assert.*;

import org.junit.Test;

public class WidgetSpecTest {

    @Test public void tiers() {
        assertEquals(WidgetSpec.Tier.SMALL, WidgetSpec.forSize(110, 110, 1f).tier);   // 1x1/2x1
        assertFalse(WidgetSpec.forSize(110, 110, 1f).showChart);
        assertEquals(WidgetSpec.Tier.SMALL, WidgetSpec.forSize(250, 110, 1f).tier);   // 4x1 pasek — bez wykresu
        assertFalse(WidgetSpec.forSize(250, 110, 1f).showChart);

        WidgetSpec med = WidgetSpec.forSize(250, 180, 1f);                              // 4x2
        assertEquals(WidgetSpec.Tier.MEDIUM, med.tier);
        assertTrue(med.showChart);
        assertEquals(0, med.examRows);
        assertTrue(med.planRows >= 1);

        WidgetSpec lg = WidgetSpec.forSize(250, 260, 1f);                               // 4x3 (siatka 9-rzędowa)
        assertEquals(WidgetSpec.Tier.LARGE, lg.tier);
        assertTrue(lg.showChart);
        assertEquals(2, lg.examRows);

        WidgetSpec big = WidgetSpec.forSize(300, 320, 1f);                              // 4x4
        assertEquals(WidgetSpec.Tier.LARGE, big.tier);
        assertEquals(3, big.examRows);
        assertTrue(big.showSchool);
    }

    @Test public void narrowNeverGetsChart() {
        assertEquals(WidgetSpec.Tier.SMALL, WidgetSpec.forSize(150, 300, 1f).tier);
        assertFalse(WidgetSpec.forSize(150, 300, 1f).showChart);
    }

    @Test public void largeFontReducesRows() {
        int normal = WidgetSpec.forSize(300, 320, 1f).planRows;
        int big = WidgetSpec.forSize(300, 320, 1.3f).planRows;
        assertTrue("większa czcionka nie może zwiększać liczby wierszy", big <= normal);
    }
}
