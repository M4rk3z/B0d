package com.b0d.asistencia;

import android.content.Context;
import android.content.SharedPreferences;

final class PreferenceCredentialStore implements AdminAccess.Store {
    private final SharedPreferences preferences;
    PreferenceCredentialStore(Context context) {
        preferences = context.getSharedPreferences("admin_credentials_v1", Context.MODE_PRIVATE);
    }
    @Override public AdminAccess.State read() {
        if (!preferences.contains("hash")) return null;
        return new AdminAccess.State(preferences.getString("salt", ""),
                preferences.getString("hash", ""), preferences.getInt("failures", 0),
                preferences.getLong("locked_until", 0));
    }
    @Override public void write(AdminAccess.State state) {
        if (!preferences.edit().putString("salt", state.salt).putString("hash", state.hash)
                .putInt("failures", state.failures).putLong("locked_until", state.lockedUntil).commit()) {
            throw new IllegalStateException("Credential storage failed");
        }
    }
}
