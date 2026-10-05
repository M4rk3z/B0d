package com.b0d.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.database.sqlite.SQLiteConstraintException;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.view.Gravity;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.List;

public final class MainActivity extends Activity implements androidx.lifecycle.LifecycleOwner {
    private final androidx.lifecycle.LifecycleRegistry lifecycle = new androidx.lifecycle.LifecycleRegistry(this);
    private FaceCamera faceCamera;
    private android.widget.ImageView faceImage;
    private byte[] pendingFace;
    @Override public androidx.lifecycle.Lifecycle getLifecycle() { return lifecycle; }
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private static final ExecutorService CLOUD = Executors.newSingleThreadExecutor();
    private static final java.util.concurrent.atomic.AtomicBoolean CLOUD_BUSY = new java.util.concurrent.atomic.AtomicBoolean();
    private TextView cloudStatus;
    private final Runnable cloudTick = new Runnable() {
        @Override public void run() {
            if (!foreground) return;
            if (CLOUD_BUSY.compareAndSet(false, true)) {
                android.content.Context context = getApplicationContext();
                CLOUD.execute(() -> {
                    try { new CloudSync(context).sync(); }
                    finally { CLOUD_BUSY.set(false); handler.post(() -> { if (foreground && cloudStatus != null) cloudStatus.setText(new CloudSync(context).status()); }); }
                });
            }
            handler.postDelayed(this, 60000);
        }
    };
    private final Handler handler = new Handler(Looper.getMainLooper());
    private AdminAccess access;
    private LinearLayout panel;
    private ScrollView screenScroll;
    private boolean authenticated, busy, foreground;
    private int generation;
    private AlertDialog confirmationDialog;
    private final Runnable expire = () -> { authenticated = false; showHome(); };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_CREATE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        access = new AdminAccess(new PreferenceCredentialStore(this));
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    () -> { if (!busy) showHome(); });
        }
    }
    @Override protected void onResume() {
        super.onResume();
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_RESUME);
        foreground = true;
        authenticated = false;
        showHome();
        handler.removeCallbacks(cloudTick); handler.post(cloudTick);
    }
    @Override protected void onPause() {
        clearFace();
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_PAUSE);
        foreground = false;
        authenticated = false;
        generation++;
        handler.removeCallbacks(expire);
        handler.removeCallbacks(cloudTick); cloudStatus = null;
        dismissConfirmation();
        super.onPause();
    }
    @Override protected void onStart() {
        super.onStart();
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_START);
    }
    @Override protected void onStop() {
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_STOP);
        super.onStop();
    }
    @Override protected void onDestroy() {
        clearFace();
        lifecycle.handleLifecycleEvent(androidx.lifecycle.Lifecycle.Event.ON_DESTROY);
        super.onDestroy();
    }
    private void clearFace() {
        if (faceCamera != null) { faceCamera.close(); faceCamera = null; }
        if (pendingFace != null) { java.util.Arrays.fill(pendingFace, (byte) 0); pendingFace = null; }
        if (faceImage != null) { faceImage.setImageDrawable(null); faceImage = null; }
    }
    @Override public void onUserInteraction() {
        super.onUserInteraction();
        if (authenticated) scheduleExpiry();
    }
    private void scheduleExpiry() {
        handler.removeCallbacks(expire);
        handler.postDelayed(expire, 120_000);
    }
    private void screen(int title) {
        clearFace();
        dismissConfirmation();
        generation++;
        ScrollView scroll = new ScrollView(this);
        screenScroll = scroll;
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(0xffeef2f7);
        scroll.setClipToPadding(false);
        scroll.setPadding(dp(16), dp(24), dp(16), dp(24));
        FrameLayout canvas = new FrameLayout(this);
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(28), dp(24), dp(24));
        panel.setBackground(surface(0xffffffff, 0xffe3e9f1, 28));
        panel.setElevation(dp(2));
        int availableWidth = getResources().getDisplayMetrics().widthPixels - dp(32);
        FrameLayout.LayoutParams card = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        canvas.addView(panel, card);
        scroll.addView(canvas);
        if (authenticated) {
            LinearLayout shell = new LinearLayout(this); shell.setOrientation(LinearLayout.VERTICAL);
            shell.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
            shell.addView(adminNavigation(title)); setContentView(shell);
        } else setContentView(scroll);
        View content = findViewById(android.R.id.content);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        content.requestApplyInsets();
        TextView badge = text(R.string.station_label, 12);
        badge.setTextColor(0xff2457a7);
        badge.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        badge.setLetterSpacing(0.12f);
        badge.setPadding(dp(14), dp(10), dp(14), dp(10));
        badge.setBackground(surface(0xffedf3ff, 0xffedf3ff, 12));
        text(title, 30);
    }
    private void showHome() {
        authenticated = false;
        handler.removeCallbacks(expire);
        showKiosk();
    }
    private void showKiosk() {
        clearFace(); dismissConfirmation(); generation++;
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xffeef2f7);
        panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(20), dp(16), dp(20), dp(16));
        panel.setBackground(surface(0xffffffff, 0xffe3e9f1, 28));
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(
                -1, -1, Gravity.CENTER);
        layout.setMargins(dp(12), dp(8), dp(12), dp(8)); root.addView(panel, layout); setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        }); root.requestApplyInsets();
        TextView brand = new TextView(this); brand.setText(R.string.kiosk_brand); brand.setTextSize(23);
        brand.setTypeface(null, Typeface.BOLD); brand.setTextColor(0xff172b42);
        panel.addView(brand, new LinearLayout.LayoutParams(-1, dp(40)));
        cloudStatus = text(new CloudSync(this).status(), 12);
        FrameLayout cameraBox = new FrameLayout(this);
        cameraBox.setBackground(surface(0xffe3eaf3, 0xffd8e1ed, 20)); cameraBox.setClipToOutline(true);
        panel.addView(cameraBox, new LinearLayout.LayoutParams(-1, 0, 1));
        android.widget.ImageView placeholder = new android.widget.ImageView(this);
        placeholder.setImageResource(R.drawable.ic_person);
        cameraBox.addView(placeholder, new FrameLayout.LayoutParams(dp(150), dp(150), Gravity.CENTER));
        TextView status = new TextView(this); status.setTextColor(0xff2457a7); status.setTextSize(17);
        status.setGravity(Gravity.CENTER); status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        panel.addView(status, new LinearLayout.LayoutParams(-1, dp(66)));
        LinearLayout controls = new LinearLayout(this); panel.addView(controls);
        LinearLayout mainActions = new LinearLayout(this); mainActions.setOrientation(LinearLayout.VERTICAL);
        controls.addView(mainActions, new LinearLayout.LayoutParams(0, -2, 1.6f));
        LinearLayout smallActions = new LinearLayout(this); smallActions.setOrientation(LinearLayout.VERTICAL);
        controls.addView(smallActions, new LinearLayout.LayoutParams(0, -2, 1f));
        LinearLayout top = new LinearLayout(this), bottom = new LinearLayout(this);
        smallActions.addView(top); smallActions.addView(bottom);
        Button entry = kioskButton(mainActions, R.string.kiosk_entry, 0, false);
        Button exit = kioskButton(mainActions, R.string.kiosk_exit, 0, false);
        Button meal = kioskButton(top, R.string.kiosk_meal, R.drawable.ic_meal, true);
        Button rest = kioskButton(top, R.string.kiosk_break, R.drawable.ic_break, true);
        bottom.setGravity(Gravity.CENTER);
        android.widget.ImageButton settings = new android.widget.ImageButton(this);
        settings.setImageResource(R.drawable.ic_settings);
        settings.setContentDescription(getString(R.string.admin_access));
        settings.setBackground(new RippleDrawable(ColorStateList.valueOf(0x222457a7),surface(0xffedf3ff,0xffedf3ff,16),null));
        settings.setPadding(dp(12),dp(12),dp(12),dp(12)); settings.setElevation(dp(3));
        LinearLayout.LayoutParams gear = new LinearLayout.LayoutParams(dp(48),dp(48)); gear.setMargins(dp(4),dp(12),dp(4),dp(4));
        bottom.addView(settings,gear);
        settings.setOnClickListener(v -> { if (!busy) showPin(!access.configured()); });
        Button[] actions = {entry, exit, meal, rest};
        for (Button action : actions) action.setEnabled(false);
        if (busy) { status.setText(R.string.working); return; }
        if (!access.configured()) return;
        if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            status.setText(R.string.kiosk_camera_permission);
            cameraBox.setOnClickListener(v -> requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 42));
            for (Button action : actions) {
                action.setEnabled(true);
                action.setOnClickListener(v -> requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 42));
            }
            return;
        }
        androidx.camera.view.PreviewView preview = new androidx.camera.view.PreviewView(this);
        preview.setImplementationMode(androidx.camera.view.PreviewView.ImplementationMode.COMPATIBLE);
        preview.setScaleType(androidx.camera.view.PreviewView.ScaleType.FIT_CENTER);
        cameraBox.addView(preview, new FrameLayout.LayoutParams(-1, -1));
        int token = generation;
        String[] chosen = {null};
        String[] kinds = {"IN", "OUT", "MEAL", "REST"};
        for (int i = 0; i < actions.length; i++) {
            String kind = kinds[i];
            actions[i].setOnClickListener(v -> {
                if (busy || chosen[0] != null || faceCamera == null) return;
                chosen[0] = kind;
                for (Button action : actions) action.setEnabled(false);
                status.setText(R.string.kiosk_look);
                handler.postDelayed(() -> {
                    if (foreground && generation == token && faceCamera != null) faceCamera.capture();
                }, 700);
            });
        }
        faceCamera = new FaceCamera(preview, this, WORKER, new FaceCamera.Listener() {
            private boolean current() { return foreground && token == generation; }
            @Override public void status(int message) {
                if (!current()) return;
                if (message != R.string.face_ready && message != R.string.face_back_camera) status.setText(message);
            }
            @Override public void ready() {
                if (!current()) return;
                chosen[0] = null;
                for (Button action : actions) action.setEnabled(true);
            }
            @Override public void captured(byte[] jpeg) {
                if (!current() || chosen[0] == null) { java.util.Arrays.fill(jpeg, (byte) 0); return; }
                String action = chosen[0]; busy = true;
                status.setText(R.string.kiosk_identifying);
                long captured = android.os.SystemClock.elapsedRealtime();
                WORKER.execute(() -> {
                    FaceProfiles.Match match = null; int error = 0;
                    try (WorkersDb db = new WorkersDb(getApplicationContext())) {
                        match = FaceProfiles.identify(db.getWritableDatabase(), jpeg, getApplicationContext());
                    } catch (WorkersDb.RuleError e) { error = e.message; }
                    catch (RuntimeException | LinkageError e) { error = R.string.face_detection_error; }
                    finally { java.util.Arrays.fill(jpeg, (byte) 0); }
                    FaceProfiles.Match found = match; int failure = error;
                    handler.post(() -> {
                        if (!current()) { busy = false; if (foreground) showHome(); return; }
                        if (failure != 0 || android.os.SystemClock.elapsedRealtime() - captured > 20000) {
                            finish(failure == 0 ? getString(R.string.kiosk_retry) : getString(failure), false); return;
                        }
                        WORKER.execute(() -> {
                            WorkersDb.Punch punch = null; int saveError = 0;
                            try (WorkersDb db = new WorkersDb(getApplicationContext())) { punch = db.punchFace(found.worker, action, found.score); }
                            catch (WorkersDb.RuleError e) { saveError = e.message; }
                            catch (RuntimeException e) { saveError = R.string.attendance_error; }
                            WorkersDb.Punch saved = punch; int issue = saveError;
                            handler.post(() -> {
                                if (!current()) { busy = false; if (foreground) showHome(); return; }
                                finish(issue == 0 ? saved.name + "\n" + getString(R.string.kiosk_saved,
                                        getString("IN".equals(saved.kind) ? R.string.kiosk_entry : "OUT".equals(saved.kind) ? R.string.kiosk_exit
                                                : "BREAK_END".equals(saved.kind) ? R.string.kiosk_return : "MEAL".equals(action) ? R.string.kiosk_meal : R.string.kiosk_break))
                                        : getString(issue), issue == 0);
                            });
                        });
                    });
                });
            }
            private void finish(String message, boolean success) {
                busy = false; status.setText(message); status.setTextColor(success ? 0xff28694b : 0xffa42c35);
                handler.postDelayed(() -> {
                    if (!current()) return;
                    status.setText(""); status.setTextColor(0xff2457a7);
                    if (faceCamera != null) faceCamera.resetCapture();
                }, 4000);
            }
        });
    }
    private Button kioskButton(LinearLayout parent, int label, int icon, boolean small) {
        Button button = new Button(this); button.setGravity(Gravity.CENTER); button.setElevation(dp(3)); button.setAllCaps(false); button.setText(label);
        button.setTextSize(small ? 12 : 21); button.setTypeface(null, Typeface.BOLD);
        button.setTextColor(small ? 0xff2457a7 : 0xffffffff);
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x222457a7),
                surface(small ? 0xffedf3ff : 0xff2457a7, small ? 0xffedf3ff : 0xff2457a7, 14), null));
        button.setPadding(dp(3), dp(4), dp(3), dp(4)); button.setMinWidth(0); button.setMinimumWidth(0);
        button.setTooltipText(getString(label)); button.setContentDescription(getString(label));
        if (icon != 0) button.setCompoundDrawablesWithIntrinsicBounds(0, icon, 0, 0);
        LinearLayout.LayoutParams p = parent.getOrientation() == LinearLayout.VERTICAL
                ? new LinearLayout.LayoutParams(-1, dp(64)) : new LinearLayout.LayoutParams(0, dp(64), 1);
        p.setMargins(dp(4), dp(4), dp(4), dp(4)); parent.addView(button, p); return button;
    }
    private void showPin(boolean setup) {
        authenticated = false;
        screen(setup ? R.string.setup_admin : R.string.admin_access);

        EditText pin = pinField(R.string.pin_hint);
        EditText confirmation = setup ? pinField(R.string.confirm_hint) : null;
        TextView status = text(R.string.empty, 16);
        Button submit = button(setup ? R.string.save_pin : R.string.enter, () -> {});
        Button cancel = button(R.string.back_home, this::showHome);
        submit.setOnClickListener(view -> {
            String value = pin.getText().toString();
            String repeated = confirmation == null ? "" : confirmation.getText().toString();
            if (!AdminAccess.validPin(value)) { status.setText(R.string.invalid_pin); return; }
            if (setup && !value.equals(repeated)) { status.setText(R.string.pin_mismatch); return; }
            int request = generation;
            busy = true;
            submit.setEnabled(false); cancel.setEnabled(false);
            pin.setText(""); pin.setEnabled(false);
            if (confirmation != null) { confirmation.setText(""); confirmation.setEnabled(false); }
            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE))
                    .hideSoftInputFromWindow(pin.getWindowToken(), 0);
            status.setText(R.string.working);
            WORKER.execute(() -> {
                AdminAccess.Result outcome = AdminAccess.Result.REJECTED;
                boolean failed = false;
                try {
                    if (setup) { access.setup(value, repeated); outcome = AdminAccess.Result.ACCEPTED; }
                    else { outcome = access.authenticate(value, System.currentTimeMillis()); }
                } catch (Exception exception) { failed = true; }
                final AdminAccess.Result result = outcome;
                final boolean error = failed;
                handler.post(() -> {
                    busy = false;
                    if (isDestroyed() || !foreground) return;
                    if (request != generation) { showHome(); return; }
                    if (!error && result == AdminAccess.Result.ACCEPTED) {
                        authenticated = true;
                        showAdmin();
                    } else {
                        submit.setEnabled(true); cancel.setEnabled(true); pin.setEnabled(true);
                        if (confirmation != null) confirmation.setEnabled(true);
                        status.setText(error ? R.string.storage_error :
                                result == AdminAccess.Result.LOCKED ? R.string.locked : R.string.wrong_pin);
                    }
                });
            });
        });
    }
    private void showAdmin() {
        if (!authenticated || !foreground) { showHome(); return; }
        scheduleExpiry();
        runAttendanceTask(true, R.string.admin_title, R.string.attendance_error,
                AdminDashboard::load, this::renderAdminDashboard);
    }
    private LinearLayout adminNavigation(int title) {
        LinearLayout outer = new LinearLayout(this);
        outer.setPadding(dp(16),dp(12),dp(16),dp(16)); outer.setBackgroundColor(0xffeef2f7);
        outer.setClipChildren(false); outer.setClipToPadding(false);
        LinearLayout nav = new LinearLayout(this); nav.setGravity(Gravity.CENTER_VERTICAL);
        nav.setPadding(dp(6),dp(8),dp(6),dp(8));
        nav.setBackground(surface(0xffffffff,0xffe8edf5,32)); nav.setElevation(dp(8));
        outer.addView(nav,new LinearLayout.LayoutParams(-1,dp(80)));
        String[] labels = {"Personal", "Horarios", "Inicio", "Historial", "Salir"};
        int[] icons = {R.drawable.ic_person,R.drawable.ic_nav_clock,R.drawable.ic_nav_home,R.drawable.ic_nav_folder,android.R.drawable.ic_lock_power_off};
        int[] pages = {R.string.workers_title,R.string.schedules_title,R.string.admin_title,R.string.punch_history,0};
        Runnable[] actions = {this::showWorkers,this::showSchedules,this::showAdmin,this::showHistory,this::showHome};
        for (int i=0;i<labels.length;i++) {
            LinearLayout item = new LinearLayout(this); item.setOrientation(LinearLayout.VERTICAL); item.setGravity(Gravity.CENTER);
            boolean selected = title == pages[i]; boolean home = i == 2;
            android.widget.ImageView icon = new android.widget.ImageView(this); icon.setImageResource(icons[i]);
            icon.setColorFilter(home ? 0xffffffff : selected ? 0xff2457a7 : 0xff7c8ba0);
            int size = home ? 42 : 24;
            if (home) { icon.setPadding(dp(10),dp(10),dp(10),dp(10)); icon.setBackground(surface(0xff2457a7,0xff2457a7,24)); icon.setElevation(dp(4)); }
            item.addView(icon,new LinearLayout.LayoutParams(dp(size),dp(size)));
            TextView label = new TextView(this); label.setText(labels[i]); label.setTextSize(11); label.setGravity(Gravity.CENTER);
            label.setTextColor(selected ? 0xff2457a7 : 0xff7c8ba0); label.setTypeface(null,selected ? Typeface.BOLD : Typeface.NORMAL);
            item.addView(label); item.setContentDescription(labels[i]); item.setFocusable(true);
            item.setBackground(new RippleDrawable(ColorStateList.valueOf(0x152457a7),null,null));
            Runnable action = actions[i]; item.setOnClickListener(v -> { if (!busy && requireAdmin()) action.run(); });
            nav.addView(item,new LinearLayout.LayoutParams(0,-1,1));
        }
        return outer;
    }
    private LinearLayout dashboardCard(LinearLayout parent) {
        LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        card.setBackground(surface(0xfff8faff, 0xffe8edf5, 22));
        card.setElevation(dp(4));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2); p.setMargins(dp(5),dp(5),dp(5),dp(10));
        parent.addView(card,p); return card;
    }
    private String dashboardTime(long millis) {
        long minutes = millis / 60000; return (minutes / 60) + " h " + (minutes % 60) + " min";
    }
    private void renderAdminDashboard(AdminDashboard data) {
        if (!requireAdmin()) return;
        screen(R.string.admin_title);
        Button cloudButton = button(R.string.back_admin, this::showCloud);
        cloudButton.setText("Conexión con la web");
        LinearLayout outer = panel;
        panel = dashboardCard(outer); text("Personal Operativo · Hoy", 23);
        if (data.rows.isEmpty()) text("Sin colaboradores activos",17);
        for (AdminDashboard.Row row : data.rows) {
            text(row.worker.name + " · " + row.state,18);
            android.widget.ProgressBar progress = new android.widget.ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
            progress.setMax(100); progress.setProgress(row.target == 0 ? 0 : (int)Math.min(100,100.0*row.effective/row.target));
            progress.setProgressTintList(ColorStateList.valueOf(0xff2457a7));
            panel.addView(progress,new LinearLayout.LayoutParams(-1,dp(14)));
            text(dashboardTime(row.effective) + (row.target == 0 ? " · Sin objetivo" : " / " + dashboardTime(row.target)),15);
        }
        panel = outer;
        LinearLayout info = new LinearLayout(this);
        boolean wide = getResources().getConfiguration().screenWidthDp >= 600;
        info.setOrientation(wide ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL); outer.addView(info);
        LinearLayout notices = dashboardCard(info);
        if (wide) notices.setLayoutParams(new LinearLayout.LayoutParams(0,-2,1));
        panel = notices; text("Avisos",22);
        if (data.notices.isEmpty()) text("Sin avisos",17);
        else for (String notice : data.notices) text(notice,16);
        LinearLayout metrics = dashboardCard(info);
        if (wide) metrics.setLayoutParams(new LinearLayout.LayoutParams(0,-2,1));
        panel = metrics; text("Horas extras acumuladas",20); text(dashboardTime(data.overtime),30);
        text(data.provisional ? "Global · Incluye jornadas provisionales" : "Global · Todo el historial",14);
        text("Cumplimiento de horario · Hoy",20);
        text(data.progress.percent() < 0 ? "Sin horarios" : data.progress.percent() + " %",30);
        text("Horas efectivas / jornada prevista",14);
        panel = outer;
        int token = generation;
        handler.postDelayed(() -> {
            if (foreground && authenticated && generation == token && !busy) {
                int scrollY = screenScroll == null ? 0 : screenScroll.getScrollY();
                runAttendanceTask(true,R.string.admin_title,R.string.attendance_error,AdminDashboard::load, next -> {
                    renderAdminDashboard(next);
                    ScrollView current = screenScroll;
                    if (current != null) current.post(() -> current.scrollTo(0,scrollY));
                });
            }
        },300000);
    }
    private void showCloud() {
        if (!requireAdmin()) return;
        screen(R.string.admin_title);
        text("Conexión con Render", 23);
        cloudStatus = text(new CloudSync(this).status(), 16);
        text("La clave se genera en la web, en Tablet. Los registros locales pendientes se enviarán al vincular.", 15);
        EditText credential = new EditText(this);
        credential.setHint("Clave de vinculación");
        credential.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        credential.setSingleLine(true); panel.addView(credential, params());
        Button link = button(R.string.back_admin, () -> {}); link.setText("Vincular y sincronizar");
        link.setOnClickListener(v -> {
            if (!requireAdmin() || !CLOUD_BUSY.compareAndSet(false, true)) return;
            String value = credential.getText().toString(); credential.setText(""); link.setEnabled(false);
            final int request = generation;
            CLOUD.execute(() -> {
                String result;
                try { CloudSync cloud = new CloudSync(getApplicationContext()); cloud.link(value); cloud.sync(); result = cloud.status(); }
                catch (Exception error) { result = "No se pudo vincular. Revisa la clave, la conexión y el despliegue web."; }
                finally { CLOUD_BUSY.set(false); }
                final String message = result;
                handler.post(() -> { if (foreground && authenticated && generation == request) { cloudStatus.setText(message); link.setEnabled(true); } });
            });
        });
        Button sync = button(R.string.back_admin, () -> { handler.removeCallbacks(cloudTick); handler.post(cloudTick); }); sync.setText("Sincronizar ahora");
        button(R.string.back_admin, this::showAdmin);
    }
    private boolean requireAdmin() {
        if (!authenticated || !foreground) { showHome(); return false; }
        return true;
    }
    private void dismissConfirmation() {
        if (confirmationDialog != null) {
            confirmationDialog.dismiss();
            confirmationDialog = null;
        }
    }
    private void showWorkers() {
        if (!requireAdmin() || busy) return;
        runWorkerTask(WorkersDb::list, false);
    }
    private void renderWorkers(List<WorkersDb.Worker> rows) {
        if (!requireAdmin()) return;
        screen(R.string.workers_title);
        LinearLayout outer = panel;
        int columns = Math.max(1, Math.min(4, (getResources().getConfiguration().screenWidthDp - 80) / 170));
        LinearLayout line = null;
        for (int i=0; i<=rows.size(); i++) {
            if (i % columns == 0) { line = new LinearLayout(this); outer.addView(line); }
            LinearLayout card = dashboardCard(line);
            LinearLayout.LayoutParams slot = new LinearLayout.LayoutParams(0,-2,1); slot.setMargins(dp(5),dp(5),dp(5),dp(10)); card.setLayoutParams(slot);
            panel = card;
            if (i == rows.size()) {
                Button add = button(R.string.add_worker,this::showAddWorker); add.setText("＋"); add.setTextSize(48); add.setMinHeight(dp(170));
                add.setContentDescription(getString(R.string.add_worker));
                for (int spare=(i % columns)+1; spare<columns; spare++) line.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));
                break;
            }
            WorkersDb.Worker row = rows.get(i);
            android.widget.ImageView avatar = new android.widget.ImageView(this);
            avatar.setImageResource(R.drawable.ic_person); avatar.setContentDescription(row.name);
            avatar.setBackground(surface(0xffe3eaf3,0xffe3eaf3,16));
            panel.addView(avatar,new LinearLayout.LayoutParams(-1,dp(110)));
            text(row.name,19); text(row.code,14);
            text(row.scheduleSummary == null ? getString(R.string.no_schedule_assigned) : row.scheduleSummary,14);
            Button face = button(row.hasFace ? R.string.face_registered : R.string.face_register, () -> showFace(row));
            face.setText(row.hasFace ? "Perfil facial ✓" : "Registrar rostro"); face.setTextSize(14);
            Button schedule = button(R.string.assign_schedule,() -> showAssignSchedule(row)); schedule.setTextSize(14);
            Button state = button(row.active ? R.string.deactivate_worker : R.string.activate_worker,() -> confirmStateChange(row));
            state.setText(row.active ? "● Activo" : "○ Inactivo"); state.setTextSize(14);
            Button delete = button(R.string.delete_worker,() -> confirmDelete(row)); delete.setTextSize(14);
        }
        panel = outer;
    }
    private void showFace(WorkersDb.Worker worker) {
        if (!requireAdmin() || busy) return;
        runFaceTask(db -> FaceProfiles.read(db.getReadableDatabase(), worker.id),
                profile -> renderFace(worker, profile, false));
    }
    private void renderFace(WorkersDb.Worker worker, FaceProfiles.Profile profile, boolean saved) {
        if (!requireAdmin()) return;
        screen(R.string.face_title);
        text(worker.name, 24);
        text(worker.code, 18);
        if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED)
            text(R.string.face_permission_help, 16);
        if (saved) text(R.string.face_saved, 18);
        if (profile == null) text(R.string.face_empty, 18);
        else {
            text(getString(R.string.face_date, java.time.Instant.ofEpochMilli(profile.capturedAt)
                    .atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))), 16);
            if (profile.unreadable) text(R.string.face_unreadable, 18);
            else { displayFace(profile.photo); java.util.Arrays.fill(profile.photo, (byte) 0); }
            button(R.string.face_delete, () -> {
                if (!requireAdmin() || busy) return;
                confirmationDialog = new AlertDialog.Builder(this).setTitle(R.string.face_delete)
                        .setMessage(getString(R.string.face_delete_confirm, worker.name))
                        .setNegativeButton(android.R.string.cancel, null)
                        .setPositiveButton(R.string.face_delete, (dialog, which) -> runFaceTask(
                                db -> { FaceProfiles.delete(db.getWritableDatabase(), worker.id); return true; },
                                result -> renderFace(worker, null, false))).show();
            });
        }
        button(profile == null ? R.string.face_capture : R.string.face_replace, () -> startFaceCamera(worker));
        button(R.string.workers_title, this::showWorkers);
    }
    private void displayFace(byte[] photo) {
        android.graphics.Bitmap bitmap = android.graphics.BitmapFactory.decodeByteArray(photo, 0, photo.length);
        if (bitmap == null) { text(R.string.face_unreadable, 18); return; }
        faceImage = new android.widget.ImageView(this);
        faceImage.setContentDescription(getString(R.string.face_preview));
        faceImage.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        faceImage.setImageBitmap(bitmap);
        panel.addView(faceImage, new LinearLayout.LayoutParams(-1, dp(280)));
    }
    private void startFaceCamera(WorkersDb.Worker worker) {
        if (!requireAdmin() || busy) return;
        if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            // Permission UI can pause the activity: always expire the administrative session.
            authenticated = false;
            showHome();
            requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 41);
            return;
        }
        screen(R.string.face_title);
        text(worker.name + " · " + worker.code, 24);

        androidx.camera.view.PreviewView preview = new androidx.camera.view.PreviewView(this);
        preview.setImplementationMode(androidx.camera.view.PreviewView.ImplementationMode.COMPATIBLE);
        preview.setScaleType(androidx.camera.view.PreviewView.ScaleType.FIT_CENTER);
        panel.addView(preview, new LinearLayout.LayoutParams(-1, dp(320)));
        TextView status = text(R.string.face_starting, 17);
        Button captureButton = button(R.string.face_capture, () -> {
            if (requireAdmin() && faceCamera != null) faceCamera.capture();
        });
        captureButton.setEnabled(false);
        button(R.string.face_cancel, () -> showFace(worker));
        int token = generation;
        faceCamera = new FaceCamera(preview, this, WORKER, new FaceCamera.Listener() {
            private boolean current() { return foreground && authenticated && generation == token; }
            @Override public void status(int message) {
                if (current()) { status.setText(message); captureButton.setEnabled(false); }
            }
            @Override public void ready() { if (current()) captureButton.setEnabled(true); }
            @Override public void captured(byte[] jpeg) {
                if (!current()) { java.util.Arrays.fill(jpeg, (byte) 0); return; }
                screen(R.string.face_title);
                text(worker.name + " · " + worker.code, 24);

                pendingFace = jpeg;
                displayFace(jpeg);
                button(R.string.face_save, () -> {
                    if (!requireAdmin() || busy || pendingFace == null) return;
                    byte[] toSave = pendingFace.clone();
                    runFaceTask(db -> {
                        try {
                            FaceProfiles.save(db.getWritableDatabase(), worker.id, toSave, getApplicationContext());
                            return FaceProfiles.read(db.getReadableDatabase(), worker.id);
                        } finally { java.util.Arrays.fill(toSave, (byte) 0); }
                    }, profile -> renderFace(worker, profile, true));
                });
                button(R.string.face_retake, () -> startFaceCamera(worker));
                button(R.string.face_cancel, () -> showFace(worker));
            }
        });
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 42) { if (foreground) showHome(); return; }
        if (code == 41) android.widget.Toast.makeText(this,
                results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
                        ? R.string.face_permission_granted : R.string.face_permission_denied,
                android.widget.Toast.LENGTH_LONG).show();
    }
    private void showAddWorker() {
        if (!requireAdmin() || busy) return;
        screen(R.string.add_worker);

        EditText code = workerField(R.string.worker_code, 20);
        code.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        EditText name = workerField(R.string.worker_name, 100);
        name.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        TextView status = text(R.string.empty, 16);
        button(R.string.save_worker, () -> {
            if (!requireAdmin() || busy) return;
            final WorkerFields fields;
            try { fields = new WorkerFields(code.getText().toString(), name.getText().toString()); }
            catch (IllegalArgumentException error) { status.setText(R.string.invalid_worker); return; }
            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE))
                    .hideSoftInputFromWindow(name.getWindowToken(), 0);
            runWorkerTask(db -> { db.add(fields.code, fields.name); return db.list(); }, true);
        });
        button(R.string.cancel_worker, this::showWorkers);
    }
    private void confirmStateChange(WorkersDb.Worker row) {
        if (!requireAdmin() || busy) return;
        confirmationDialog = new AlertDialog.Builder(this)
                .setTitle(row.active ? R.string.deactivate_worker : R.string.activate_worker)
                .setMessage(getString(row.active ? R.string.deactivate_question : R.string.activate_question,
                        row.name, row.code))
                .setNegativeButton(R.string.cancel_worker, null)
                .setPositiveButton(R.string.confirm_worker, (dialog, which) -> {
                    if (!requireAdmin() || busy) return;
                    runWorkerTask(db -> { db.setActive(row.id, !row.active); return db.list(); }, false);
                }).create();
        confirmationDialog.show();
    }
    private interface WorkerTask { List<WorkersDb.Worker> run(WorkersDb db); }
    private void confirmDelete(WorkersDb.Worker row) {
        if (!requireAdmin() || busy) return;
        confirmationDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.delete_worker)
                .setMessage(getString(R.string.delete_question, row.name, row.code))
                .setNegativeButton(R.string.cancel_worker, null)
                .setPositiveButton(R.string.delete_worker, (dialog, which) -> {
                    if (!requireAdmin() || busy) return;
                    runWorkerTask(db -> { db.deleteWorker(row.id); return db.list(); }, false);
                }).create();
        confirmationDialog.show();
    }
    private void runWorkerTask(WorkerTask task, boolean adding) {
        if (!requireAdmin() || busy) return;
        busy = true;
        screen(R.string.workers_title);
        text(R.string.working, 18);
        int request = generation;
        WORKER.execute(() -> {
            List<WorkersDb.Worker> result = null;
            int error = 0;
            try (WorkersDb db = new WorkersDb(getApplicationContext())) { result = task.run(db); }
            catch (WorkersDb.RuleError exception) { error = exception.message; }
            catch (SQLiteConstraintException exception) { error = adding ? R.string.duplicate_worker : R.string.worker_error; }
            catch (RuntimeException exception) { error = R.string.worker_error; }
            final List<WorkersDb.Worker> rows = result;
            final int failure = error;
            handler.post(() -> {
                busy = false;
                if (isDestroyed() || !foreground) return;
                if (request != generation || !authenticated) { showHome(); return; }
                if (failure == 0) { renderWorkers(rows); }
                else {
                    screen(R.string.workers_title);
                    text(failure, 18);
                    button(R.string.add_worker, this::showAddWorker);
                    button(R.string.workers_title, this::showWorkers);
                    button(R.string.back_admin, this::showAdmin);
                }
            });
        });
    }
    private void showClock() {
        if (busy || !foreground) return;
        if (!access.configured()) { showHome(); return; }
        authenticated = false;
        handler.removeCallbacks(expire);
        screen(R.string.clock_in_out);

        EditText code = workerField(R.string.worker_code, 20);
        code.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        TextView status = text(R.string.empty, 16);
        button(R.string.find_worker, () -> {
            String value = code.getText().toString().trim();
            if (value.isEmpty()) { status.setText(R.string.enter_code); return; }
            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(code.getWindowToken(), 0);
            runAttendanceTask(false, db -> db.findForClock(value), this::showClockWorker);
        });
        button(R.string.back_home, this::showHome);
    }
    private void showClockWorker(WorkersDb.CheckInState state) {
        showClockWorker(state, null);
    }
    private void showClockWorker(WorkersDb.CheckInState state, String notice) {
        screen(R.string.worker_dashboard);
        text(state.worker.name, 26);
        text(state.worker.code, 20);
        if (notice != null) text(notice, 18).setTextColor(0xff176b60);
        boolean inside = state.last != null && !"OUT".equals(state.last.kind);
        boolean resting = state.last != null && "BREAK_START".equals(state.last.kind);
        text(resting ? R.string.state_resting : inside ? R.string.state_working : R.string.state_outside, 22);
        if (state.plan != null) {
            text(getString(R.string.current_plan, state.plan.name, ScheduleRules.clock(state.plan.day.start), ScheduleRules.clock(state.plan.day.end)), 16);
            text(state.plan.marked ? R.string.mode_marked : R.string.mode_automatic, 16);
        } else text(R.string.no_calculation_schedule, 16);
        if (!inside) button(R.string.register_entry, () -> clockAction(state, "IN"));
        else if (resting) button(R.string.end_rest, () -> clockAction(state, "BREAK_END"));
        else {
            if (state.plan != null && state.plan.marked) button(R.string.start_rest, () -> clockAction(state, "BREAK_START"));
            button(R.string.register_exit, () -> clockAction(state, "OUT"));
        }
        if (state.summary != null) renderSummary(state.summary);
        else text(R.string.no_prior_punch, 16);
        if (state.last != null) text(getString(R.string.last_punch, formatPunch(state.last)), 14);

        int refreshToken = generation;
        handler.postDelayed(() -> {
            if (foreground && generation == refreshToken && !busy)
                runAttendanceTask(false, db -> db.findForClock(state.worker.code), this::showClockWorker);
        },300000);
        button(R.string.not_me, this::showClock);
        button(R.string.back_home, this::showHome);
        int current = generation;
        handler.postDelayed(() -> {
            if (!isDestroyed() && foreground && generation == current) showHome();
        }, 60_000);
    }
    private void clockAction(WorkersDb.CheckInState state, String kind) {
        runAttendanceTask(false, db -> {
            WorkersDb.Punch saved = db.punch(state.worker.id, kind);
            return new ClockOutcome(db.findForClock(state.worker.code), saved);
        }, outcome -> showClockWorker(outcome.state, getString(R.string.saved_inline, formatPunch(outcome.punch))));
    }
    private static final class ClockOutcome {
        final WorkersDb.CheckInState state;
        final WorkersDb.Punch punch;
        ClockOutcome(WorkersDb.CheckInState state, WorkersDb.Punch punch) { this.state = state; this.punch = punch; }
    }
    private int kindLabel(String kind) {
        if ("IN".equals(kind)) return R.string.entry;
        if ("OUT".equals(kind)) return R.string.exit;
        return "BREAK_START".equals(kind) ? R.string.rest_start_label : R.string.rest_end_label;
    }
    private String duration(long millis) {
        if (millis < 0) return getString(R.string.not_available);
        long seconds = millis / 1000;
        return String.format(java.util.Locale.getDefault(), "%d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60);
    }
    private void renderSummary(AttendanceRepository.Summary row) {
        WorkCalculator.Result r = row.result;
        text(getString(R.string.day_summary, row.context.date.toString()), 22);
        text(row.context.plan == null ? getString(R.string.no_calculation_schedule) : row.context.plan.name, 16);
        text(r.provisional() ? R.string.provisional_summary : R.string.closed_summary, 16);
        metricPair(R.string.effective_metric, duration(r.effective), R.string.excluded_metric, duration(r.excluded));
        metricPair(R.string.ordinary_metric, duration(r.ordinary), R.string.extra_metric, duration(r.overtime));
        metricPair(R.string.late_metric, duration(r.late), R.string.target_metric,
                duration(row.context.plan == null ? -1 : row.context.plan.day.effectiveMinutes * 60_000L));
        if (r.missingBreaks) text(R.string.missing_rest_incident, 16).setTextColor(0xffa42c35);
        if (r.invalid) text(R.string.calculation_incident, 16).setTextColor(0xffa42c35);
    }
    private void metricPair(int leftTitle, String leftValue, int rightTitle, String rightValue) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.addView(metric(leftTitle, leftValue), new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams right = new LinearLayout.LayoutParams(0, -2, 1);
        right.leftMargin = dp(8);
        row.addView(metric(rightTitle, rightValue), right);
        panel.addView(row, params());
    }
    private LinearLayout metric(int title, String value) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(12), dp(12), dp(12), dp(12));
        card.setBackground(surface(0xffedf3ff, 0xffedf3ff, 16));
        TextView heading = new TextView(this); heading.setText(title); heading.setTextSize(13); heading.setTextColor(0xff526278);
        TextView number = new TextView(this); number.setText(value); number.setTextSize(22); number.setTextColor(0xff172b42);
        card.addView(heading); card.addView(number);
        return card;
    }
    private String formatPunch(WorkersDb.Punch punch) {
        String timestamp = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss", java.util.Locale.getDefault())
                .format(java.time.Instant.ofEpochMilli(punch.time).atZone(java.time.ZoneId.of(punch.zone)));
        return getString(R.string.punch_line, getString(kindLabel(punch.kind)), timestamp, punch.zone);
    }
    private void showHistory() {
        if (!requireAdmin() || busy) return;
        runAttendanceTask(true, db -> new HistoryData(new AttendanceRepository(db.getReadableDatabase()).recentSummaries(System.currentTimeMillis()), db.recentPunches()), data -> {
            screen(R.string.punch_history);
            text(R.string.daily_history_limit, 16);
            button(R.string.back_admin, this::showAdmin);
            if (data.summaries.isEmpty()) text(R.string.no_punches, 18);
            for (AttendanceRepository.Summary row : data.summaries) {
                text(getString(R.string.history_worker, row.name, row.code), 24);
                renderSummary(row);
            }
            CheckBox details = new CheckBox(this);
            details.setText(R.string.show_raw_punches); details.setMinHeight(dp(56));
            panel.addView(details, params());
            LinearLayout parent = panel, raw = new LinearLayout(this);
            raw.setOrientation(LinearLayout.VERTICAL); parent.addView(raw, params());
            panel = raw;
            text(R.string.history_limit, 14);
            for (WorkersDb.Punch row : data.punches) {
                text(getString(R.string.history_worker, row.name, row.code), 22);
                text(formatPunch(row), 16);
            }
            panel = parent;
            raw.setVisibility(View.GONE);
            details.setOnCheckedChangeListener((view, checked) -> raw.setVisibility(checked ? View.VISIBLE : View.GONE));
        });
    }
    private static final class HistoryData {
        final List<AttendanceRepository.Summary> summaries;
        final List<WorkersDb.Punch> punches;
        HistoryData(List<AttendanceRepository.Summary> summaries, List<WorkersDb.Punch> punches) { this.summaries = summaries; this.punches = punches; }
    }
    private interface AttendanceTask<T> { T run(WorkersDb db); }
    private <T> void runFaceTask(AttendanceTask<T> task, java.util.function.Consumer<T> success) {
        runAttendanceTask(true, R.string.face_title, R.string.face_storage_error, task, success);
    }
    private <T> void runAttendanceTask(boolean admin, AttendanceTask<T> task, java.util.function.Consumer<T> success) {
        runAttendanceTask(admin, admin ? R.string.punch_history : R.string.clock_in_out,
                R.string.attendance_error, task, success);
    }
    private <T> void runAttendanceTask(boolean admin, int title, int errorMessage,
                                      AttendanceTask<T> task, java.util.function.Consumer<T> success) {
        if (busy || !foreground || (admin && !requireAdmin())) return;
        if (!access.configured()) { showHome(); return; }
        busy = true;
        screen(title);
        text(R.string.working, 18);
        int request = generation;
        WORKER.execute(() -> {
            T result = null;
            int error = 0;
            try (WorkersDb db = new WorkersDb(getApplicationContext())) { result = task.run(db); }
            catch (WorkersDb.RuleError exception) { error = exception.message; }
            catch (RuntimeException exception) { error = errorMessage; }
            final T value = result;
            final int failure = error;
            handler.post(() -> {
                busy = false;
                if (isDestroyed() || !foreground) return;
                if (generation != request || (admin && !authenticated)) { showHome(); return; }
                if (failure == 0) success.accept(value);
                else {
                    screen(title);
                    text(failure, 18);
                    button(admin ? R.string.back_admin : R.string.back_home, admin ? this::showAdmin : this::showHome);
                }
            });
        });
    }
    private void showSchedules() {
        if (!requireAdmin() || busy) return;
        runScheduleTask(db -> new SchedulesRepository(db.getReadableDatabase()).list(), this::renderSchedules);
    }
    private void renderSchedules(List<SchedulesRepository.Schedule> rows) {
        if (!requireAdmin()) return;
        screen(R.string.schedules_title);

        button(R.string.create_schedule, this::showCreateSchedule);
        button(R.string.back_admin, this::showAdmin);
        if (rows.isEmpty()) text(R.string.no_schedules, 18);
        for (SchedulesRepository.Schedule schedule : rows) {
            text(schedule.name, 24);
            text(schedule.markBreaks ? R.string.mode_marked : R.string.mode_automatic, 16);
            text(schedule.zone, 14);
            for (ScheduleRules.Day day : schedule.days) {
                String line = getString(R.string.schedule_day_summary, weekdayName(day.weekday),
                        ScheduleRules.clock(day.start), ScheduleRules.clock(day.end),
                        day.effectiveMinutes / 60, day.effectiveMinutes % 60);
                text(line, 18);
                if (day.end >= 1440) text(R.string.next_day_exit, 14);
                if (!day.breaks.isEmpty()) {
                    StringBuilder intervals = new StringBuilder();
                    for (ScheduleRules.Break rest : day.breaks) {
                        if (intervals.length() > 0) intervals.append("; ");
                        intervals.append(ScheduleRules.clock(day.start + rest.startOffset)).append("–")
                                .append(ScheduleRules.clock(day.start + rest.endOffset));
                    }
                    text(getString(R.string.breaks_summary, intervals.toString()), 16);
                }
            }
        }
    }
    private String weekdayName(int weekday) {
        return getResources().getStringArray(R.array.weekdays)[weekday - 1];
    }
    private void showCreateSchedule() {
        if (!requireAdmin() || busy) return;
        screen(R.string.create_schedule);

        EditText name = workerField(R.string.schedule_name, 80);
        CheckBox marked = new CheckBox(this);
        marked.setText(R.string.mark_breaks_checkbox);
        marked.setTextSize(17); marked.setMinHeight(dp(56));
        panel.addView(marked, params());
        text(R.string.break_mode_help, 16);
        CheckBox[] enabled = new CheckBox[7];
        EditText[] starts = new EditText[7], ends = new EditText[7], breaks = new EditText[7];
        for (int i = 0; i < 7; i++) {
            enabled[i] = new CheckBox(this);
            enabled[i].setText(weekdayName(i + 1)); enabled[i].setTextSize(20); enabled[i].setMinHeight(dp(56));
            panel.addView(enabled[i], params());
            LinearLayout parent = panel;
            LinearLayout fields = new LinearLayout(this);
            fields.setOrientation(LinearLayout.VERTICAL);
            fields.setPadding(dp(12), dp(12), dp(12), dp(4));
            fields.setBackground(surface(0xfff5f7fb, 0xffe3e9f1, 16));
            parent.addView(fields, params());
            panel = fields;
            starts[i] = workerField(R.string.schedule_start, 5);
            starts[i].setInputType(InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
            starts[i].setText(R.string.default_start);
            ends[i] = workerField(R.string.schedule_end, 5);
            ends[i].setInputType(InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
            ends[i].setText(R.string.default_end);
            breaks[i] = workerField(R.string.schedule_breaks, 120);
            text(R.string.break_format_help, 14);
            panel = parent;
            fields.setVisibility(View.GONE);
            enabled[i].setOnCheckedChangeListener((view, checked) -> fields.setVisibility(checked ? View.VISIBLE : View.GONE));
        }
        TextView status = text(R.string.empty, 16);
        button(R.string.save_schedule, () -> {
            if (!requireAdmin() || busy) return;
            String title = name.getText().toString().trim();
            if (title.isEmpty()) { status.setText(R.string.schedule_name_required); return; }
            List<ScheduleRules.Day> days = new java.util.ArrayList<>();
            try {
                for (int i = 0; i < 7; i++) if (enabled[i].isChecked()) {
                    try { days.add(new ScheduleRules.Day(i + 1, starts[i].getText().toString(), ends[i].getText().toString(), breaks[i].getText().toString())); }
                    catch (IllegalArgumentException error) { throw new IllegalArgumentException(weekdayName(i + 1) + ": " + error.getMessage()); }
                }
                ScheduleRules.validateWeek(days);
            } catch (IllegalArgumentException error) { status.setText(error.getMessage()); return; }
            boolean requireBreakMarks = marked.isChecked();
            ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(name.getWindowToken(), 0);
            runScheduleTask(db -> {
                SchedulesRepository repo = new SchedulesRepository(db.getWritableDatabase());
                repo.create(title, requireBreakMarks, days);
                return repo.list();
            }, this::renderSchedules);
        });
        button(R.string.cancel_worker, this::showSchedules);
    }
    private void showAssignSchedule(WorkersDb.Worker worker) {
        if (!requireAdmin() || busy) return;
        runScheduleTask(db -> {
            SchedulesRepository repo = new SchedulesRepository(db.getReadableDatabase());
            return new ScheduleAssignmentData(repo.list(), repo.assignmentHistory(worker.id));
        }, data -> {
            screen(R.string.assign_schedule);
            text(worker.name, 24);

            EditText date = workerField(R.string.effective_date, 10);
            date.setInputType(InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_DATE);
            date.setText(java.time.LocalDate.now().toString());
            TextView status = text(R.string.empty, 16);
            if (data.schedules.isEmpty()) text(R.string.no_schedules, 18);
            for (SchedulesRepository.Schedule schedule : data.schedules) {
                Button choose = button(R.string.assign_schedule, () -> {
                    if (!requireAdmin() || busy) return;
                    final String since = date.getText().toString().trim();
                    try { java.time.LocalDate.parse(since); }
                    catch (java.time.DateTimeException error) { status.setText(R.string.invalid_effective_date); return; }
                    confirmationDialog = new AlertDialog.Builder(this).setTitle(R.string.assign_schedule)
                            .setMessage(getString(R.string.confirm_assignment, schedule.name, worker.name, since))
                            .setNegativeButton(R.string.cancel_worker, null)
                            .setPositiveButton(R.string.confirm_worker, (dialog, which) -> {
                                if (!requireAdmin() || busy) return;
                                runScheduleTask(db -> {
                                    new SchedulesRepository(db.getWritableDatabase()).assign(worker.id, schedule.id, since);
                                    return db.list();
                                }, this::renderWorkers);
                            }).create();
                    confirmationDialog.show();
                });
                choose.setText(getString(R.string.choose_named_schedule, schedule.name));
            }
            button(R.string.workers_title, this::showWorkers);
            text(R.string.assignment_history, 22);
            if (data.history.isEmpty()) text(R.string.no_schedule_assigned, 16);
            for (String item : data.history) text(item, 16);
        });
    }
    private static final class ScheduleAssignmentData {
        final List<SchedulesRepository.Schedule> schedules;
        final List<String> history;
        ScheduleAssignmentData(List<SchedulesRepository.Schedule> schedules, List<String> history) { this.schedules = schedules; this.history = history; }
    }
    private <T> void runScheduleTask(AttendanceTask<T> task, java.util.function.Consumer<T> success) {
        if (!requireAdmin() || busy) return;
        busy = true;
        screen(R.string.schedules_title);
        text(R.string.working, 18);
        int request = generation;
        WORKER.execute(() -> {
            T result = null;
            String error = null;
            try (WorkersDb db = new WorkersDb(getApplicationContext())) { result = task.run(db); }
            catch (WorkersDb.RuleError exception) { error = getString(exception.message); }
            catch (SQLiteConstraintException exception) { error = getString(R.string.schedule_conflict); }
            catch (IllegalArgumentException exception) { error = exception.getMessage(); }
            catch (RuntimeException exception) { error = getString(R.string.schedule_error); }
            final T value = result;
            final String failure = error;
            handler.post(() -> {
                busy = false;
                if (isDestroyed() || !foreground) return;
                if (request != generation || !authenticated) { showHome(); return; }
                if (failure == null) success.accept(value);
                else {
                    screen(R.string.schedules_title);
                    text(failure, 18);
                    button(R.string.schedules_title, this::showSchedules);
                    button(R.string.workers_title, this::showWorkers);
                    button(R.string.back_admin, this::showAdmin);
                }
            });
        });
    }
    private EditText workerField(int hint, int maxLength) {
        EditText field = new EditText(this);
        field.setHint(hint); field.setContentDescription(getString(hint));
        field.setTextSize(20); field.setSingleLine(true);
        field.setFilters(new InputFilter[]{new InputFilter.LengthFilter(maxLength)});
        field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        field.setSaveEnabled(false);
        styleField(field);
        panel.addView(field, params());
        return field;
    }
    private EditText pinField(int hint) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setContentDescription(getString(hint));
        field.setTextSize(22);
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        field.setFilters(new InputFilter[] {new InputFilter.LengthFilter(6)});
        field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        field.setSaveEnabled(false);
        styleField(field);
        panel.addView(field, params());
        return field;
    }
    private TextView text(int value, int size) {
        return text(getString(value), size);
    }
    private TextView text(CharSequence value, int size) {
        TextView label = new TextView(this);
        label.setText(value); label.setTextSize(size); label.setTextColor(0xff172b42);
        label.setLineSpacing(dp(3), 1.08f);
        label.setTypeface(Typeface.create(size >= 22 ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
        if (size < 22) label.setTextColor(0xff526278);
        panel.addView(label, params());
        return label;
    }
    private Button button(int label, Runnable action) {
        Button button = new Button(this);
        button.setText(label); button.setAllCaps(false); button.setMinHeight(dp(56));
        boolean danger = label == R.string.delete_worker || label == R.string.deactivate_worker;
        boolean secondary = label == R.string.back_home || label == R.string.back_admin ||
                label == R.string.cancel_worker || label == R.string.logout || label == R.string.not_me;
        int fill = danger ? 0xfffff1f0 : secondary ? 0xfff1f5fa : 0xff2457a7;
        int ink = danger ? 0xffa42c35 : secondary ? 0xff243c5d : 0xffffffff;
        button.setBackgroundTintList(null);
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x222457a7), surface(fill, fill, 18), null));
        button.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}}, new int[]{0xff8795a8, ink}));
        button.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        button.setTextSize(17);
        button.setPadding(dp(20), dp(14), dp(20), dp(14));
        button.setElevation(dp(3));
        button.setGravity(Gravity.CENTER);
        button.setOnClickListener(view -> action.run());
        panel.addView(button, params());
        return button;
    }
    private LinearLayout.LayoutParams params() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(18);
        return params;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private GradientDrawable surface(int fill, int border, int radius) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(fill);
        background.setCornerRadius(dp(radius));
        background.setStroke(dp(1), border);
        return background;
    }
    private void styleField(EditText field) {
        field.setBackgroundTintList(null);
        android.graphics.drawable.StateListDrawable states = new android.graphics.drawable.StateListDrawable();
        states.addState(new int[]{android.R.attr.state_focused}, surface(0xffffffff, 0xff2457a7, 16));
        states.addState(new int[]{}, surface(0xfff5f7fb, 0xffd8e1ed, 16));
        field.setBackground(states);
        field.setPadding(dp(18), dp(16), dp(18), dp(16));
        field.setTextColor(0xff172b42);
        field.setHintTextColor(0xff637389);
        field.setMinHeight(dp(60));
    }
}
