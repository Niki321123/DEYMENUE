package pl.user.daymenu;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Dyktowanie pytań do asystenta.
 *
 * Przeglądarkowe API mowy (webkitSpeechRecognition) NIE działa w Android WebView, więc w APK
 * korzystamy z systemowego okna rozpoznawania mowy (RecognizerIntent). Nagrywaniem zajmuje się
 * aplikacja systemowa, nie my — dzięki temu NIE potrzebujemy uprawnienia RECORD_AUDIO ani
 * własnego interfejsu nagrywania. JS sam wybiera: jest plugin → plugin, nie ma → Web Speech API.
 */
@CapacitorPlugin(name = "DayMenuSpeech")
public class SpeechPlugin extends Plugin {

    /** Czy na urządzeniu w ogóle jest aplikacja rozpoznająca mowę (wymaga <queries> w manifeście). */
    @PluginMethod
    public void available(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        JSObject res = new JSObject();
        res.put("available", intent.resolveActivity(getContext().getPackageManager()) != null);
        call.resolve(res);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pl-PL");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        String prompt = call.getString("prompt");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt == null ? "Mów…" : prompt);
        try {
            startActivityForResult(call, intent, "wynikMowy");
        } catch (ActivityNotFoundException e) {
            call.reject("no_speech_app");
        }
    }

    @ActivityCallback
    private void wynikMowy(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject res = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            res.put("text", "");
            res.put("cancelled", true);
            call.resolve(res);
            return;
        }
        ArrayList<String> lista = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        res.put("text", (lista != null && !lista.isEmpty()) ? lista.get(0) : "");
        res.put("cancelled", false);
        call.resolve(res);
    }
}
