package com.b0d.asistencia;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Administrative access only. Photos never leave the app's private encrypted database. */
final class FaceProfiles {
    private static final String ALIAS = "b0d_face_photos_v1";
    static final class Profile {
        final byte[] photo;
        final long capturedAt;
        final boolean unreadable;
        Profile(byte[] photo, long time, boolean unreadable) {
            this.photo = photo; this.capturedAt = time; this.unreadable = unreadable;
        }
    }
    private static synchronized SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        if (!create) throw new java.security.GeneralSecurityException("Missing face key");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }
    static Profile read(SQLiteDatabase db, String worker) {
        try (Cursor c = db.rawQuery("SELECT encrypted_photo, captured_at FROM face_profiles WHERE worker_id = ?", new String[]{worker})) {
            if (!c.moveToFirst()) return null;
            try { return new Profile(FacePhotoCipher.decrypt(key(false), worker, c.getBlob(0)), c.getLong(1), false); }
            catch (Exception e) { return new Profile(null, c.getLong(1), true); }
        }
    }
    static void save(SQLiteDatabase db, String worker, byte[] photo, android.content.Context context) {
        if (photo == null || photo.length == 0 || photo.length > 1_000_000) throw new IllegalArgumentException("Invalid photo");
        float[] feature;
        try { feature = FaceEngine.get(context).feature(photo); }
        catch (IllegalArgumentException e) { throw new WorkersDb.RuleError(R.string.face_quality_error); }
        for (String id : ids(db)) {
            if (!id.equals(worker) && FaceMatchRules.cosine(feature, template(db, id, context)) >= FaceMatchRules.MIN_SCORE)
                throw new WorkersDb.RuleError(R.string.face_duplicate);
        }
        ContentValues values = new ContentValues();
        try { values.put("encrypted_photo", FacePhotoCipher.encrypt(key(true), worker, photo)); }
        catch (Exception e) { throw new IllegalStateException("Cannot encrypt face photo", e); }
        putTemplate(values, worker, feature);
        values.put("worker_id", worker);
        values.put("captured_at", System.currentTimeMillis());
        values.put("format_version", 1);
        db.beginTransaction();
        try {
            if (db.update("face_profiles", values, "worker_id = ?", new String[]{worker}) == 0)
                db.insertOrThrow("face_profiles", null, values);
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
    static void delete(SQLiteDatabase db, String worker) {
        db.delete("face_profiles", "worker_id = ?", new String[]{worker});
    }
    private static java.util.List<String> ids(SQLiteDatabase db) {
        java.util.List<String> ids = new java.util.ArrayList<>();
        try (Cursor c = db.rawQuery("SELECT worker_id FROM face_profiles ORDER BY worker_id", null)) {
            while (c.moveToNext()) ids.add(c.getString(0));
        }
        return ids;
    }
    private static void putTemplate(ContentValues values, String worker, float[] vector) {
        byte[] bytes = new byte[128 * 4];
        java.nio.ByteBuffer.wrap(bytes).asFloatBuffer().put(vector);
        try { values.put("encrypted_template", FacePhotoCipher.encrypt(key(true), worker + FaceEngine.MODEL, bytes)); }
        catch (Exception e) { throw new IllegalStateException("Cannot encrypt template", e); }
        finally { java.util.Arrays.fill(bytes, (byte) 0); }
        values.put("template_model", FaceEngine.MODEL);
    }
    private static float[] template(SQLiteDatabase db, String worker, android.content.Context context) {
        try (Cursor c = db.rawQuery("SELECT encrypted_template, template_model FROM face_profiles WHERE worker_id=?", new String[]{worker})) {
            if (!c.moveToFirst()) throw new IllegalStateException("Missing profile");
            if (!c.isNull(0) && FaceEngine.MODEL.equals(c.getString(1))) {
                byte[] bytes = null;
                try {
                    bytes = FacePhotoCipher.decrypt(key(false), worker + FaceEngine.MODEL, c.getBlob(0));
                    if (bytes.length != 512) throw new IllegalStateException("Invalid template");
                    float[] vector = new float[128]; java.nio.ByteBuffer.wrap(bytes).asFloatBuffer().get(vector);
                    if (!Double.isFinite(FaceMatchRules.cosine(vector, vector))) throw new IllegalStateException("Invalid template");
                    return vector;
                } catch (Exception e) { throw new WorkersDb.RuleError(R.string.face_profile_repair); }
                finally { if (bytes != null) java.util.Arrays.fill(bytes, (byte) 0); }
            }
        }
        Profile profile = read(db, worker);
        if (profile == null || profile.unreadable) throw new WorkersDb.RuleError(R.string.face_profile_repair);
        try {
            float[] vector = FaceEngine.get(context).feature(profile.photo);
            ContentValues values = new ContentValues(); putTemplate(values, worker, vector);
            db.update("face_profiles", values, "worker_id=?", new String[]{worker});
            return vector;
        } catch (IllegalArgumentException e) { throw new WorkersDb.RuleError(R.string.face_profile_repair); }
        finally { java.util.Arrays.fill(profile.photo, (byte) 0); }
    }
    static final class Match {
        final String worker;
        final double score;
        Match(String worker, double score) { this.worker = worker; this.score = score; }
    }
    static Match identify(SQLiteDatabase db, byte[] photo, android.content.Context context) {
        java.util.List<String> ids = ids(db);
        if (ids.isEmpty()) throw new WorkersDb.RuleError(R.string.face_no_profiles);
        float[] query;
        try { query = FaceEngine.get(context).feature(photo); }
        catch (IllegalArgumentException e) { throw new WorkersDb.RuleError(R.string.face_quality_error); }
        String winner = null; double best = -1, second = -1;
        for (String id : ids) {
            double score = FaceMatchRules.cosine(query, template(db, id, context));
            if (!Double.isFinite(score)) throw new WorkersDb.RuleError(R.string.face_profile_repair);
            if (score > best) { second = best; best = score; winner = id; }
            else if (score > second) second = score;
        }
        java.util.Arrays.fill(query, 0);
        if (winner == null || !FaceMatchRules.accepted(best, second)) throw new WorkersDb.RuleError(R.string.face_unknown);
        return new Match(winner, best);
    }
}
