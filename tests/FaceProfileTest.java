package com.b0d.asistencia;

import java.util.Arrays;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

public final class FaceProfileTest {
    private static int checks;
    private static void check(boolean condition) {
        if (!condition) throw new AssertionError("Check " + checks);
        checks++;
    }
    private static void rejects(SecretKey key, String worker, byte[] bytes) throws Exception {
        try { FacePhotoCipher.decrypt(key, worker, bytes); throw new AssertionError("Envelope accepted"); }
        catch (java.security.GeneralSecurityException expected) { checks++; }
    }
    public static void main(String[] args) throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance("AES"); generator.init(256);
        SecretKey key = generator.generateKey();
        byte[] photo = "private facial photo".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] first = FacePhotoCipher.encrypt(key, "worker-1", photo);
        check(Arrays.equals(photo, FacePhotoCipher.decrypt(key, "worker-1", first)));
        check(!Arrays.equals(first, FacePhotoCipher.encrypt(key, "worker-1", photo)));
        rejects(key, "worker-2", first);
        rejects(generator.generateKey(), "worker-1", first);
        byte[] changed = first.clone(); changed[changed.length - 1] ^= 1;
        rejects(key, "worker-1", changed);
        changed = first.clone(); changed[0] = 2; rejects(key, "worker-1", changed);
        rejects(key, "worker-1", new byte[4]); rejects(key, "worker-1", null);
        check(FaceQuality.acceptable(1,160,160,15,-15,15,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(0,160,160,0,0,0,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(2,160,160,0,0,0,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(1,159,160,0,0,0,1,1,160,161,400,400));
        check(!FaceQuality.acceptable(1,160,159,0,0,0,1,1,161,160,400,400));
        check(!FaceQuality.acceptable(1,160,160,16,0,0,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(1,160,160,0,-16,0,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(1,160,160,0,0,16,1,1,161,161,400,400));
        check(!FaceQuality.acceptable(1,160,160,0,0,0,0,1,160,161,400,400));
        check(!FaceQuality.acceptable(1,160,160,0,0,0,1,1,400,161,400,400));
        check(!FaceQuality.acceptable(1,160,160,Float.NaN,0,0,1,1,161,161,400,400));
        float[] a = new float[128], b = new float[128]; a[0] = 1; b[1] = 1;
        check(FaceMatchRules.cosine(a, a) == 1);
        check(FaceMatchRules.cosine(a, b) == 0);
        check(Double.isNaN(FaceMatchRules.cosine(a, new float[128])));
        check(Double.isNaN(FaceMatchRules.cosine(a, new float[127])));
        check(FaceMatchRules.accepted(0.8, 0.3));
        check(FaceMatchRules.accepted(0.55, -1));
        check(!FaceMatchRules.accepted(0.549, -1));
        check(!FaceMatchRules.accepted(0.8, 0.75));
        check(!FaceMatchRules.accepted(0.8, 0.8));
        check(!FaceMatchRules.accepted(Double.NaN, -1));
        check(!FaceMatchRules.accepted(0.8, Double.NaN));
        check(!FaceMatchRules.accepted(1.1, -1));
        check(FaceMatchRules.kind("IN", null, null).equals("IN"));
        check(FaceMatchRules.kind("OUT", "IN", "IN").equals("OUT"));
        check(FaceMatchRules.kind("MEAL", "IN", "IN").equals("BREAK_START"));
        check(FaceMatchRules.kind("REST", "BREAK_END", "MEAL").equals("BREAK_START"));
        check(FaceMatchRules.kind("MEAL", "BREAK_START", "MEAL").equals("BREAK_END"));
        check(FaceMatchRules.kind("REST", "BREAK_START", null).equals("BREAK_END"));
        try { FaceMatchRules.kind("REST", "BREAK_START", "MEAL"); throw new AssertionError("Wrong break allowed"); }
        catch (IllegalArgumentException expected) { checks++; }
        try { FaceMatchRules.kind("INVALID", "IN", null); throw new AssertionError("Invalid action allowed"); }
        catch (IllegalArgumentException expected) { checks++; }
        System.out.println("PASS: " + checks + " face profile checks");
    }
}
