package com.b0d.asistencia;

import android.content.Context;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.net.ssl.HttpsURLConnection;
import java.security.KeyStore;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import org.json.JSONObject;
import org.json.JSONArray;

/** PostgreSQL is canonical; local immutable events remain until explicit remote acknowledgement. */
final class CloudSync {
    private static final String BASE = "https://b0d-control-web.onrender.com";
    private final Context context;
    private final SharedPreferences prefs;
    CloudSync(Context context) { this.context = context.getApplicationContext(); prefs = this.context.getSharedPreferences("cloud", Context.MODE_PRIVATE); }
    boolean linked() { return prefs.contains("credential"); }
    String status() { return prefs.getString("status", "Tablet sin vincular"); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias("b0d_cloud")) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder("b0d_cloud", KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); generator.generateKey();
        }
        return (SecretKey) store.getKey("b0d_cloud", null);
    }
    private String token() throws Exception { return new String(FacePhotoCipher.decrypt(key(), "cloud", Base64.decode(prefs.getString("credential", ""), Base64.NO_WRAP)), StandardCharsets.UTF_8); }
    void link(String value) throws Exception {
        String token = value.trim();
        JSONObject remote = null;
        if (token.replace(" ", "").replace("-", "").matches("[0-9]{8}")) {
            remote = request("/api/device/pair", new JSONObject().put("code", token), "");
            token = remote.getString("token");
        }
        if (!token.matches("[a-f0-9]{64}")) throw new Exception("Copia la clave de vinculación de la web");
        if (remote == null) remote = request("/api/device/workers", null, token);
        String encrypted = Base64.encodeToString(FacePhotoCipher.encrypt(key(), "cloud", token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        // A replacement credential may refer to another device; rebuild mappings, never remove punches.
        try (WorkersDb helper = new WorkersDb(context)) {
            SQLiteDatabase db = helper.getWritableDatabase(); db.beginTransaction();
            try { db.delete("cloud_workers", null, null); db.delete("cloud_receipts", null, null); db.setTransactionSuccessful(); } finally { db.endTransaction(); }
        }
        if (!prefs.edit().putString("credential", encrypted).putString("device", remote.getString("deviceId")).commit()) throw new Exception("No se pudo guardar la vinculación");
    }
    void sync() {
        if (!linked()) return;
        try (WorkersDb helper = new WorkersDb(context)) {
            SQLiteDatabase db = helper.getWritableDatabase(); String credential = token();
            // Import existing local workers once; server owns their names and active state thereafter.
            try (Cursor c = db.rawQuery("SELECT id,code,name,active FROM workers ORDER BY code", null)) {
                while (c.moveToNext()) {
                    JSONObject local = new JSONObject().put("id", c.getString(0)).put("code", c.getString(1)).put("name", c.getString(2)).put("active", c.getInt(3)==1);
                    JSONObject remote = request("/api/device/worker", local, credential);
                    ContentValues map = new ContentValues(); map.put("local_id", c.getString(0)); map.put("remote_id", remote.getString("id"));
                    db.insertWithOnConflict("cloud_workers", null, map, SQLiteDatabase.CONFLICT_REPLACE);
                }
            }
            // Unacknowledged old and new events are the durable outbox, sent in original sequence.
            int sent = 0;
            try (Cursor c = db.rawQuery("SELECT p.event_id,p.worker_id,p.worker_code,p.worker_name,p.kind,p.occurred_at,p.zone_id,p.method,f.action FROM punches p LEFT JOIN facial_punch_details f ON f.seq=p.seq WHERE NOT EXISTS(SELECT 1 FROM cloud_receipts r WHERE r.event_id=p.event_id) ORDER BY p.seq LIMIT 200", null)) {
                while (c.moveToNext()) {
                    JSONObject event = new JSONObject().put("eventId", c.getString(0)).put("workerId", c.getString(1)).put("code", c.getString(2)).put("name", c.getString(3)).put("kind", c.getString(4)).put("time", c.getLong(5)).put("zone", c.getString(6)).put("method", c.getString(7)).put("action", c.isNull(8) ? JSONObject.NULL : c.getString(8));
                    JSONObject ack = request("/api/device/punch", event, credential);
                    if (!ack.getBoolean("stored") || !c.getString(0).equals(ack.getString("eventId"))) throw new Exception("Confirmación remota inválida");
                    ContentValues receipt = new ContentValues(); receipt.put("event_id", c.getString(0)); receipt.put("confirmed_at", System.currentTimeMillis());
                    db.insertWithOnConflict("cloud_receipts", null, receipt, SQLiteDatabase.CONFLICT_IGNORE); sent++;
                }
            }
            JSONArray catalog = request("/api/device/workers", null, credential).getJSONArray("workers");
            db.beginTransaction();
            try {
                for (int i=0;i<catalog.length();i++) {
                    JSONObject worker = catalog.getJSONObject(i); String remoteId = worker.getString("id"); String localId = null;
                    try (Cursor c = db.rawQuery("SELECT local_id FROM cloud_workers WHERE remote_id=?", new String[]{remoteId})) { if (c.moveToFirst()) localId = c.getString(0); }
                    ContentValues values = new ContentValues(); values.put("code", worker.getString("code")); values.put("name", worker.getString("name")); values.put("active", worker.getBoolean("active")?1:0); values.put("updated_at", System.currentTimeMillis());
                    if (localId == null) {
                        // A local record created during this sync is imported on the next cycle, not merged silently.
                        try (Cursor c = db.rawQuery("SELECT 1 FROM workers WHERE code=?", new String[]{worker.getString("code")})) { if (c.moveToFirst()) continue; }
                        localId = remoteId; values.put("id", localId); values.put("created_at", System.currentTimeMillis()); db.insertOrThrow("workers", null, values);
                        ContentValues map = new ContentValues(); map.put("local_id", localId); map.put("remote_id", remoteId); db.insertOrThrow("cloud_workers", null, map);
                    } else db.update("workers", values, "id=?", new String[]{localId});
                }
                db.setTransactionSuccessful();
            } finally { db.endTransaction(); }
            CloudSchedules.apply(db, request("/api/device/schedules", null, credential));
            long pending;
            try (Cursor c = db.rawQuery("SELECT count(*) FROM punches p WHERE NOT EXISTS(SELECT 1 FROM cloud_receipts r WHERE r.event_id=p.event_id)", null)) { c.moveToFirst(); pending = c.getLong(0); }
            prefs.edit().putString("status", "Última sincronización: " + java.time.LocalTime.now().withNano(0) + " · Pendientes: " + pending).apply();
        } catch (Exception error) {
            String message = error instanceof RemoteError ? error.getMessage() : "Sin conexión o sincronización interrumpida";
            prefs.edit().putString("status", message + ". Los registros locales se conservan.").apply();
        }
    }
    private static final class RemoteError extends Exception { RemoteError(String message) { super(message); } }
    private JSONObject request(String path, JSONObject data, String token) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(BASE + path).openConnection();
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(20000); connection.setReadTimeout(70000);
        if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (data != null) { connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json"); try (java.io.OutputStream out = connection.getOutputStream()) { out.write(data.toString().getBytes(StandardCharsets.UTF_8)); } }
            int status = connection.getResponseCode(); InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw new Exception("No response");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream in = stream) { byte[] buffer = new byte[8192]; int count; while ((count = in.read(buffer)) != -1) { bytes.write(buffer,0,count); if (bytes.size() > 4*1024*1024) throw new Exception("Response limit"); } }
            JSONObject response = new JSONObject(bytes.toString("UTF-8"));
            if (status != 200) throw new RemoteError(response.optString("error", "No se pudo sincronizar"));
            return response;
        } finally { connection.disconnect(); }
    }
}
