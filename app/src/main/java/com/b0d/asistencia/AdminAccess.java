package com.b0d.asistencia;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Local credential policy, independent of Android for deterministic tests. */
public final class AdminAccess {
    public static final long LOCK_MILLIS = 300_000L;
    private static final int ITERATIONS = 210_000;
    public interface Store {
        State read();
        void write(State state);
    }
    public static final class State {
        public final String salt, hash;
        public final int failures;
        public final long lockedUntil;
        public State(String salt, String hash, int failures, long lockedUntil) {
            this.salt = salt; this.hash = hash;
            this.failures = failures; this.lockedUntil = lockedUntil;
        }
    }
    public enum Result { ACCEPTED, REJECTED, LOCKED, NOT_CONFIGURED }
    private final Store store;
    public AdminAccess(Store store) { this.store = store; }
    public synchronized boolean configured() { return store.read() != null; }
    public static boolean validPin(String pin) { return pin != null && pin.matches("[0-9]{6}"); }
    public synchronized void setup(String pin, String confirmation) throws Exception {
        if (configured()) throw new IllegalStateException("Already configured");
        if (!validPin(pin) || !pin.equals(confirmation)) throw new IllegalArgumentException("Invalid PIN");
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        store.write(new State(Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(derive(pin, salt)), 0, 0));
    }
    public synchronized Result authenticate(String pin, long now) throws Exception {
        State state = store.read();
        if (state == null) return Result.NOT_CONFIGURED;
        if (state.lockedUntil > now) {
            if (state.lockedUntil - now > LOCK_MILLIS) {
                store.write(new State(state.salt, state.hash, state.failures, now + LOCK_MILLIS));
            }
            return Result.LOCKED;
        }
        boolean matches = validPin(pin) && MessageDigest.isEqual(
                Base64.getDecoder().decode(state.hash),
                derive(pin, Base64.getDecoder().decode(state.salt)));
        if (matches) {
            store.write(new State(state.salt, state.hash, 0, 0));
            return Result.ACCEPTED;
        }
        int failures = (state.lockedUntil > 0 ? 0 : state.failures) + 1;
        long until = failures >= 5 ? now + LOCK_MILLIS : 0;
        store.write(new State(state.salt, state.hash, failures, until));
        return until > 0 ? Result.LOCKED : Result.REJECTED;
    }
    private static byte[] derive(String pin, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, ITERATIONS, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        finally { spec.clearPassword(); }
    }
}
