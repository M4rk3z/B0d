package com.b0d.asistencia;

public final class WorkerFieldsTest {
    private static int checks;
    private static void check(boolean condition, String name) {
        if (!condition) throw new AssertionError(name);
        checks++;
    }
    private static void rejects(String code, String name) {
        try { new WorkerFields(code, name); throw new AssertionError("Invalid fields accepted"); }
        catch (IllegalArgumentException expected) { checks++; }
    }
    public static void main(String[] args) {
        WorkerFields fields = new WorkerFields(" emp-001 ", "  María   Pérez ");
        check(fields.code.equals("EMP-001"), "Canonical code");
        check(fields.name.equals("María Pérez"), "Preserves accents and trims spacing");
        check(new WorkerFields("001", "O'Connor").code.equals("001"), "Leading zero");
        rejects(null, "Valid"); rejects("", "Valid"); rejects("A B", "Valid");
        rejects("A';DROP", "Valid"); rejects("-001", "Valid"); rejects("Á001", "Valid");
        rejects("A".repeat(21), "Valid"); rejects("A1", null); rejects("A1", "   ");
        rejects("A1", "n".repeat(101)); rejects("A1", "a\u0000b");
        check(new WorkerFields("A".repeat(20), "n".repeat(100)).name.length() == 100, "Boundary accepted");
        java.util.Locale previous = java.util.Locale.getDefault();
        try {
            java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr-TR"));
            check(new WorkerFields("i1", "Ipek").code.equals("I1"), "Locale independent code");
        } finally { java.util.Locale.setDefault(previous); }
        System.out.println("PASS: " + checks + " worker field checks");
    }
}
