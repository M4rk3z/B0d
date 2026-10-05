package com.b0d.asistencia;

/** Conservative pilot thresholds, not an accuracy guarantee. Validate on the target tablet. */
final class FaceMatchRules {
    static final double MIN_SCORE = 0.55, MIN_MARGIN = 0.10;
    static double cosine(float[] a, float[] b) {
        if (a.length != 128 || b.length != 128) return Double.NaN;
        double dot = 0, aa = 0, bb = 0;
        for (int i = 0; i < a.length; i++) { dot += (double) a[i]*b[i]; aa += (double)a[i]*a[i]; bb += (double)b[i]*b[i]; }
        if (aa == 0 || bb == 0) return Double.NaN;
        return Math.max(-1, Math.min(1, dot / Math.sqrt(aa*bb)));
    }
    static boolean accepted(double best, double second) {
        return Double.isFinite(best) && Double.isFinite(second) && best >= MIN_SCORE
                && best <= 1 && best - second >= MIN_MARGIN;
    }
    static String kind(String action, String previous, String previousAction) {
        if ("IN".equals(action) || "OUT".equals(action)) return action;
        if (!"MEAL".equals(action) && !"REST".equals(action)) throw new IllegalArgumentException("Action");
        if ("BREAK_START".equals(previous)) {
            if (previousAction != null && !action.equals(previousAction)) throw new IllegalArgumentException("Different break");
            return "BREAK_END";
        }
        return "BREAK_START";
    }
}
