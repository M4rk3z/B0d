package com.b0d.asistencia;

import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.graphics.Rect;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.lifecycle.LifecycleOwner;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetector;
import com.google.mlkit.vision.face.FaceDetectorOptions;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.Executor;

/** In-memory capture. No gallery, files, remote service or identity matching. */
final class FaceCamera implements AutoCloseable {
    interface Listener {
        void status(int message);
        void ready();
        void captured(byte[] jpeg);
    }
    private final PreviewView view;
    private final Executor main, worker;
    private final Listener listener;
    private ProcessCameraProvider provider;
    private Preview preview;
    private ImageCapture capture;
    private volatile boolean closed;
    private boolean taking;
    private final FaceDetector detector = FaceDetection.getClient(new FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE).build());

    FaceCamera(PreviewView view, LifecycleOwner owner, Executor worker, Listener listener) {
        this.view = view; this.main = androidx.core.content.ContextCompat.getMainExecutor(view.getContext());
        this.worker = worker; this.listener = listener;
        var future = ProcessCameraProvider.getInstance(view.getContext());
        future.addListener(() -> {
            if (closed) return;
            try {
                provider = future.get();
                CameraSelector selector = provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)
                        ? CameraSelector.DEFAULT_FRONT_CAMERA : CameraSelector.DEFAULT_BACK_CAMERA;
                preview = new Preview.Builder().build();
                capture = new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build();
                preview.setSurfaceProvider(view.getSurfaceProvider());
                provider.bindToLifecycle(owner, selector, preview, capture);
                listener.status(selector == CameraSelector.DEFAULT_FRONT_CAMERA ? R.string.face_ready : R.string.face_back_camera);
                listener.ready();
            } catch (Exception e) { listener.status(R.string.face_camera_error); }
        }, main);
    }
    void capture() {
        if (closed || capture == null || taking) return;
        taking = true;
        listener.status(R.string.face_checking);
        if (view.getDisplay() != null) capture.setTargetRotation(view.getDisplay().getRotation());
        capture.takePicture(worker, new ImageCapture.OnImageCapturedCallback() {
            @Override public void onCaptureSuccess(ImageProxy image) {
                Bitmap normalized = null;
                try {
                    if (closed) return;
                    Bitmap source = image.toBitmap();
                    Matrix transform = new Matrix();
                    transform.postRotate(image.getImageInfo().getRotationDegrees());
                    float scale = Math.min(1f, 1280f / Math.max(source.getWidth(), source.getHeight()));
                    transform.postScale(scale, scale);
                    normalized = Bitmap.createBitmap(source, 0, 0, source.getWidth(), source.getHeight(), transform, true);
                    if (normalized != source) source.recycle();
                } catch (RuntimeException e) { fail(R.string.face_camera_error); }
                finally { image.close(); }
                if (normalized != null) {
                    Bitmap bitmap = normalized;
                    main.execute(() -> analyze(bitmap));
                }
            }
            @Override public void onError(ImageCaptureException error) { fail(R.string.face_camera_error); }
        });
    }
    private void analyze(Bitmap bitmap) {
        if (closed) { bitmap.recycle(); return; }
        detector.process(InputImage.fromBitmap(bitmap, 0)).addOnSuccessListener(main, faces -> {
            if (closed) return;
            if (faces.size() != 1) { fail(R.string.face_count_error); return; }
            Face face = faces.get(0);
            Rect box = face.getBoundingBox();
            if (!FaceQuality.acceptable(faces.size(), box.width(), box.height(), face.getHeadEulerAngleY(),
                    face.getHeadEulerAngleX(), face.getHeadEulerAngleZ(), box.left, box.top, box.right,
                    box.bottom, bitmap.getWidth(), bitmap.getHeight())) {
                fail(R.string.face_quality_error); return;
            }
            // Retain a little context around the face; dimensions remain bounded.
            int pad = Math.min(box.width(), box.height()) / 5;
            int left = Math.max(0, box.left - pad), top = Math.max(0, box.top - pad);
            int right = Math.min(bitmap.getWidth(), box.right + pad), bottom = Math.min(bitmap.getHeight(), box.bottom + pad);
            Bitmap crop = Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top);
            float scale = Math.min(1f, 640f / Math.max(crop.getWidth(), crop.getHeight()));
            Bitmap small = Bitmap.createScaledBitmap(crop, Math.round(crop.getWidth() * scale), Math.round(crop.getHeight() * scale), true);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            small.compress(Bitmap.CompressFormat.JPEG, 92, output);
            if (small != crop) small.recycle();
            if (crop != bitmap) crop.recycle();
            listener.captured(output.toByteArray());
        }).addOnFailureListener(main, error -> fail(R.string.face_detection_error))
                .addOnCompleteListener(main, task -> bitmap.recycle());
    }
    private void fail(int message) {
        main.execute(() -> {
            if (closed) return;
            taking = false; listener.status(message); listener.ready();
        });
    }
    void resetCapture() {
        if (!closed) { taking = false; listener.ready(); }
    }
    @Override public void close() {
        closed = true;
        if (provider != null && preview != null && capture != null) provider.unbind(preview, capture);
        detector.close();
    }
}
