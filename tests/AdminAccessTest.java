package com.b0d.asistencia;

public final class AdminAccessTest {
    private static int checks;
    private static final class MemoryStore implements AdminAccess.Store {
        AdminAccess.State state;
        public AdminAccess.State read() { return state; }
        public void write(AdminAccess.State value) { state = value; }
    }
    private static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
        checks++;
    }
    public static void main(String[] args) throws Exception {
        MemoryStore store = new MemoryStore();
        AdminAccess access = new AdminAccess(store);
        check(!access.configured(), "Fresh install is unconfigured");
        check(access.authenticate("123456", 1000) == AdminAccess.Result.NOT_CONFIGURED, "No default credential");
        check(!AdminAccess.validPin("12345"), "Reject short PIN");
        check(!AdminAccess.validPin("1234567"), "Reject long PIN");
        check(!AdminAccess.validPin("12a456"), "Reject non-digits");
        try { access.setup("123456", "654321"); throw new AssertionError("Mismatch accepted"); }
        catch (IllegalArgumentException expected) { checks++; }
        check(!access.configured(), "Mismatch does not persist");
        access.setup("012345", "012345");
        check(access.configured(), "Setup persists");
        check(!store.state.hash.equals("012345"), "No plaintext PIN");
        check(java.util.Base64.getDecoder().decode(store.state.salt).length == 16, "Salt length");
        try { access.setup("654321", "654321"); throw new AssertionError("Credential overwritten"); }
        catch (IllegalStateException expected) { checks++; }
        check(access.authenticate("012345", 1000) == AdminAccess.Result.ACCEPTED, "Leading zero retained");
        for (int i = 1; i <= 4; i++) {
            access = new AdminAccess(store);
            check(access.authenticate("999999", 1000) == AdminAccess.Result.REJECTED, "Rejected attempt " + i);
        }
        check(new AdminAccess(store).authenticate("999999", 1000) == AdminAccess.Result.LOCKED, "Fifth attempt locks across instances");
        check(new AdminAccess(store).authenticate("012345", 2000) == AdminAccess.Result.LOCKED, "Correct PIN cannot bypass lock");
        check(access.authenticate("012345", 301000) == AdminAccess.Result.ACCEPTED, "Lock expires at boundary");
        check(store.state.failures == 0 && store.state.lockedUntil == 0, "Success resets failure state");
        access.authenticate("999999", 302000);
        check(access.authenticate("012345", 302001) == AdminAccess.Result.ACCEPTED && store.state.failures == 0, "Success clears earlier failures");
        MemoryStore another = new MemoryStore();
        new AdminAccess(another).setup("012345", "012345");
        check(!another.state.hash.equals(store.state.hash), "Independent random salts");
        AdminAccess broken = new AdminAccess(new AdminAccess.Store() {
            public AdminAccess.State read() { return store.state; }
            public void write(AdminAccess.State state) { throw new IllegalStateException("Disk failure"); }
        });
        try { broken.authenticate("012345", 400000); throw new AssertionError("Write failure authorized access"); }
        catch (IllegalStateException expected) { checks++; }
        System.out.println("PASS: " + checks + " credential policy checks");
    }
}
