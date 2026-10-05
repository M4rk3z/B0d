package com.b0d.asistencia;

public final class PunchRulesTest {
    private static int checks;
    private static void test(boolean active, String previous, long before, String requested, long now, PunchRules.Result expected) {
        if (PunchRules.validate(active, previous, before, requested, now) != expected) throw new AssertionError("Unexpected attendance decision");
        checks++;
    }
    public static void main(String[] args) {
        test(true, null, 0, "IN", 1000, PunchRules.Result.OK);
        test(true, null, 0, "OUT", 1000, PunchRules.Result.SEQUENCE);
        test(true, "IN", 1000, "IN", 2000, PunchRules.Result.SEQUENCE);
        test(true, "OUT", 1000, "OUT", 2000, PunchRules.Result.SEQUENCE);
        test(true, "IN", 1000, "OUT", 2000, PunchRules.Result.OK);
        test(true, "OUT", 1000, "IN", 2000, PunchRules.Result.OK);
        test(false, null, 0, "IN", 2000, PunchRules.Result.INACTIVE);
        test(false, "IN", 1000, "OUT", 2000, PunchRules.Result.INACTIVE);
        test(true, "IN", 2000, "OUT", 1000, PunchRules.Result.CLOCK);
        test(true, "IN", 2000, "OUT", 2000, PunchRules.Result.OK);
        test(true, "IN", 1000, "OUT", 86_401_000, PunchRules.Result.OK);
        test(true, null, 0, "OTHER", 1000, PunchRules.Result.INVALID_TYPE);
        test(true, "CORRUPT", 1000, "IN", 2000, PunchRules.Result.SEQUENCE);
        System.out.println("PASS: " + checks + " attendance policy checks");
    }
}
