package com.b0d.asistencia;

public final class DashboardProgressTest {
    private static int checks;
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); checks++; }
    public static void main(String[] args) {
        DashboardProgress p = new DashboardProgress();
        check(p.percent() == -1);
        // A worker doing ten hours cannot cover the other worker's absence.
        p.add(600,480); p.add(0,480); check(p.percent() == 50);
        // A person without a scheduled target is excluded from this denominator.
        p.add(300,0); check(p.percent() == 50);
        p = new DashboardProgress(); p.add(120,240); p.add(480,480);
        check(p.percent() == 83); // Weighted by scheduled time, not employee count.
        p = new DashboardProgress(); p.add(0,480); check(p.percent() == 0);
        p = new DashboardProgress(); p.add(600,480); check(p.percent() == 100);
        p = new DashboardProgress(); p.add(-10,480); check(p.percent() == 0);
        System.out.println("PASS: " + checks + " dashboard scenarios");
    }
}
