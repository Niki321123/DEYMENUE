# ===== Day Menu — reguły R8 dla wydania =====
# Aplikacja to WebView (Capacitor) z mostem JS <-> Kotlin/Java. R8 nie widzi wywołań
# idących z JavaScriptu, więc bez poniższych reguł wyciąłby klasy i metody, które
# są używane WYŁĄCZNIE przez most — apka zbudowałaby się, a wywróciła dopiero w locie.

# --- rdzeń Capacitora ---
# Bridge tworzy instancje pluginów refleksją i czyta ich adnotacje.
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Każda klasa pluginu (nasza i z wtyczek zewnętrznych) razem z metodami wołanymi z JS.
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.PluginMethod <methods>;
    public <init>(...);
}
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# --- most WebView -> Java ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- wtyczki Cordovy pakowane przez Capacitora ---
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- kod własny aplikacji ---
# WidgetPlugin i LockTaskPlugin są rejestrowane w MainActivity przez registerPlugin(),
# a DayMenuWidgetProvider wskazuje manifest — wszystkie trzy muszą przetrwać w całości.
-keep class pl.user.daymenu.** { *; }

# --- czytelne stack trace z wydania ---
# Bez tego zgłoszenie błędu od użytkownika jest bezużyteczne (zaciemnione nazwy klas).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- adnotacje i sygnatury generyczne, z których korzysta refleksja Capacitora ---
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
