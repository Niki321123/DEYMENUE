package pl.user.daymenu;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Przypinanie ekranu (Android Screen Pinning) na czas sesji pomodoro.
// Wymaga jednorazowego włączenia "Przypinania ekranu" w Ustawieniach Androida
// (Bezpieczeństwo -> Przypinanie ekranu) — apka nie może włączyć tego sama.
@CapacitorPlugin(name = "LockTask")
public class LockTaskPlugin extends Plugin {

    @PluginMethod
    public void startPin(PluginCall call) {
        try {
            getActivity().startLockTask();
            call.resolve();
        } catch (Exception e) {
            call.reject("Nie udało się przypiąć ekranu: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPin(PluginCall call) {
        try {
            getActivity().stopLockTask();
            call.resolve();
        } catch (Exception e) {
            call.reject("Nie udało się odpiąć ekranu: " + e.getMessage());
        }
    }
}
