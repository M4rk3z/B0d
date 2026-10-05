package com.b0d.asistencia;

/** Overtime of one worker cannot compensate the unworked target of another. */
final class DashboardProgress {
    long fulfilled, target;
    void add(long effective, long planned) {
        if (planned <= 0) return;
        target += planned;
        fulfilled += Math.min(planned, Math.max(0, effective));
    }
    int percent() { return target == 0 ? -1 : (int)Math.round(100.0 * fulfilled / target); }
}
