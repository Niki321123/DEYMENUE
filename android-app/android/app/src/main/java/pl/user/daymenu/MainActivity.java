package pl.user.daymenu;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // rejestracja PRZED super.onCreate — inaczej Capacitor nie wystawi pluginu do JS
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
