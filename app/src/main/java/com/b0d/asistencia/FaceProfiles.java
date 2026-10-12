package com.b0d.asistencia;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Administrative access only. Tablet photos stay encrypted locally; web captures are imported over authenticated HTTPS. */
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
    static void validateSample(byte[] first,byte[] photo,android.content.Context context){
        float[] current=null,reference=null;
        try{
            current=FaceEngine.get(context).feature(photo);
            if(first!=null){
                reference=FaceEngine.get(context).feature(first);
                if(FaceMatchRules.cosine(reference,current)<0.45)throw new IllegalArgumentException("Inconsistent sample");
            }
        }finally{
            if(current!=null)java.util.Arrays.fill(current,0);
            if(reference!=null)java.util.Arrays.fill(reference,0);
        }
    }
    static void save(SQLiteDatabase db,String worker,byte[] photo,android.content.Context context){
        saveMulti(db,worker,java.util.Collections.singletonList(photo),context);
    }
    static synchronized void saveMulti(SQLiteDatabase db,String worker,java.util.List<byte[]> photos,android.content.Context context){
        if(photos.size()!=1&&photos.size()!=5)throw new IllegalArgumentException("Capture incomplete");
        float[][] features=new float[photos.size()][];
        try{
            for(int i=0;i<photos.size();i++){
                byte[] photo=photos.get(i);if(photo==null||photo.length==0||photo.length>1000000)throw new IllegalArgumentException("Invalid photo");
                features[i]=FaceEngine.get(context).feature(photo);
                if(i>0&&FaceMatchRules.cosine(features[0],features[i])<0.45)throw new WorkersDb.RuleError(R.string.face_quality_error);
            }
            for(String id:ids(db))if(!id.equals(worker)){
                float[][] other=templates(db,id,context);
                try{for(float[] feature:features)for(float[] reference:other)
                    if(FaceMatchRules.cosine(feature,reference)>=FaceMatchRules.MIN_SCORE)throw new WorkersDb.RuleError(R.string.face_duplicate);}
                finally{for(float[] reference:other)java.util.Arrays.fill(reference,0);}
            }
            ContentValues values=new ContentValues();
            try{values.put("encrypted_photo",FacePhotoCipher.encrypt(key(true),worker,photos.get(0)));}
            catch(Exception e){throw new IllegalStateException("Cannot encrypt photo",e);}
            putTemplates(values,worker,features);values.put("worker_id",worker);values.put("captured_at",System.currentTimeMillis());values.put("format_version",1);
            db.beginTransaction();try{
                if(db.update("face_profiles",values,"worker_id=?",new String[]{worker})==0)db.insertOrThrow("face_profiles",null,values);
                db.setTransactionSuccessful();
            }finally{db.endTransaction();}
        }catch(IllegalArgumentException e){throw new WorkersDb.RuleError(R.string.face_quality_error);}
        finally{for(float[] f:features)if(f!=null)java.util.Arrays.fill(f,0);}
    }
    static synchronized void delete(SQLiteDatabase db, String worker) {
        db.delete("face_profiles", "worker_id = ?", new String[]{worker});
    }
    private static java.util.List<String> ids(SQLiteDatabase db) {
        java.util.List<String> ids = new java.util.ArrayList<>();
        try (Cursor c = db.rawQuery("SELECT worker_id FROM face_profiles ORDER BY worker_id", null)) {
            while (c.moveToNext()) ids.add(c.getString(0));
        }
        return ids;
    }
    private static void putTemplates(ContentValues values,String worker,float[][] vectors){
        byte[] bytes=new byte[vectors.length*512];java.nio.FloatBuffer buffer=java.nio.ByteBuffer.wrap(bytes).asFloatBuffer();
        for(float[] vector:vectors)buffer.put(vector);
        try{values.put("encrypted_template",FacePhotoCipher.encrypt(key(true),worker+FaceEngine.MODEL,bytes));}
        catch(Exception e){throw new IllegalStateException("Cannot encrypt template",e);}
        finally{java.util.Arrays.fill(bytes,(byte)0);}
        values.put("template_model",FaceEngine.MODEL);
    }
    private static float[][] templates(SQLiteDatabase db,String worker,android.content.Context context){
        try(Cursor c=db.rawQuery("SELECT encrypted_template,template_model FROM face_profiles WHERE worker_id=?",new String[]{worker})){
            if(!c.moveToFirst())throw new IllegalStateException("Missing profile");
            if(!c.isNull(0)&&FaceEngine.MODEL.equals(c.getString(1))){
                byte[] bytes=null;
                try{
                    bytes=FacePhotoCipher.decrypt(key(false),worker+FaceEngine.MODEL,c.getBlob(0));
                    if(bytes.length!=512&&bytes.length!=2560)throw new IllegalStateException("Invalid template");
                    float[][] vectors=new float[bytes.length/512][128];java.nio.FloatBuffer buffer=java.nio.ByteBuffer.wrap(bytes).asFloatBuffer();
                    for(float[] vector:vectors){buffer.get(vector);if(!Double.isFinite(FaceMatchRules.cosine(vector,vector)))throw new IllegalStateException("Invalid vector");}return vectors;
                }catch(Exception e){throw new WorkersDb.RuleError(R.string.face_profile_repair);}
                finally{if(bytes!=null)java.util.Arrays.fill(bytes,(byte)0);}
            }
        }
        Profile profile=read(db,worker);if(profile==null||profile.unreadable)throw new WorkersDb.RuleError(R.string.face_profile_repair);
        try{float[][] vectors={FaceEngine.get(context).feature(profile.photo)};ContentValues values=new ContentValues();putTemplates(values,worker,vectors);db.update("face_profiles",values,"worker_id=?",new String[]{worker});return vectors;}
        finally{java.util.Arrays.fill(profile.photo,(byte)0);}
    }
    static int sampleCount(SQLiteDatabase db,String worker,android.content.Context context){
        float[][] vectors=templates(db,worker,context);int count=vectors.length;for(float[] v:vectors)java.util.Arrays.fill(v,0);return count;
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
            float[][] references=templates(db,id,context);double first=-1,next=-1;
            for(float[] reference:references){double value=FaceMatchRules.cosine(query,reference);if(value>first){next=first;first=value;}else if(value>next)next=value;java.util.Arrays.fill(reference,0);}
            double score=references.length==1?first:(first+next)/2;
            if (!Double.isFinite(score)) throw new WorkersDb.RuleError(R.string.face_profile_repair);
            if (score > best) { second = best; best = score; winner = id; }
            else if (score > second) second = score;
        }
        java.util.Arrays.fill(query, 0);
        if (winner == null || !FaceMatchRules.accepted(best, second)) throw new WorkersDb.RuleError(R.string.face_unknown);
        return new Match(winner, best);
    }    static Match identifySeries(SQLiteDatabase db,java.util.List<byte[]> photos,android.content.Context context){
        if(photos.size()!=3)throw new WorkersDb.RuleError(R.string.face_quality_error);
        Match first=identify(db,photos.get(0),context),last=identify(db,photos.get(2),context);
        if(!first.worker.equals(last.worker))throw new WorkersDb.RuleError(R.string.face_unknown);
        float[] a=FaceEngine.get(context).feature(photos.get(0)),b=FaceEngine.get(context).feature(photos.get(1));
        try{if(FaceMatchRules.cosine(a,b)<0.45)throw new WorkersDb.RuleError(R.string.face_unknown);}
        finally{java.util.Arrays.fill(a,0);java.util.Arrays.fill(b,0);}
        return new Match(first.worker,Math.min(first.score,last.score));
    }

}
