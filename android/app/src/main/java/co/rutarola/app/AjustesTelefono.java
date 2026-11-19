package co.rutarola.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Lo que la guía "Prepara tu teléfono" necesita saber y abrir (ruta-del-dia/gps/ajustes-telefono.ts):
 * permiso de notificaciones (Android 13+), si la app está fuera del ahorro de batería y la marca del teléfono, y
 * accesos directos a los ajustes. No pide REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (Google Play lo restringe): abre la
 * lista de optimización de batería para que el usuario elija "No optimizar".
 */
@CapacitorPlugin(
    name = "AjustesTelefono",
    permissions = { @Permission(alias = "notificaciones", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class AjustesTelefono extends Plugin {

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("notificaciones", notificacionesPermitidas());
        r.put("sinOptimizacionBateria", sinOptimizacionBateria());
        r.put("fabricante", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
        r.put("version", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void solicitarNotificaciones(PluginCall call) {
        if (notificacionesPermitidas()) {
            responder(call, true);
            return;
        }
        requestPermissionForAlias("notificaciones", call, "alResponder");
    }

    @PermissionCallback
    private void alResponder(PluginCall call) {
        responder(call, notificacionesPermitidas());
    }

    /** Lista "Optimización de batería" del sistema (ahí se elige "No optimizar" para RutaRola). */
    @PluginMethod
    public void abrirOptimizacionBateria(PluginCall call) {
        if (!abrir(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) abrir(detalleApp());
        call.resolve();
    }

    /** Información de RutaRola (Batería, permisos, inicio automático según la marca). */
    @PluginMethod
    public void abrirAjustesApp(PluginCall call) {
        abrir(detalleApp());
        call.resolve();
    }

    private boolean notificacionesPermitidas() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notificaciones") == PermissionState.GRANTED;
    }

    private boolean sinOptimizacionBateria() {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    private Intent detalleApp() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    }

    private boolean abrir(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    private void responder(PluginCall call, boolean concedido) {
        JSObject r = new JSObject();
        r.put("concedido", concedido);
        call.resolve(r);
    }
}
