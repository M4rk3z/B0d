package com.b0d.asistencia;

import java.util.Locale;

public final class WorkerFields {
    public final String code, name;
    public WorkerFields(String code, String name) {
        this.code = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        this.name = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (!this.code.matches("[A-Z0-9][A-Z0-9_-]{0,19}")) {
            throw new IllegalArgumentException("code");
        }
        if (this.name.isEmpty() || this.name.length() > 100 ||
                this.name.codePoints().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("name");
        }
    }
}
