package com.b0d.asistencia;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.Mat;
import org.opencv.core.Size;
import org.opencv.imgproc.Imgproc;
import org.opencv.objdetect.FaceDetectorYN;
import org.opencv.objdetect.FaceRecognizerSF;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/** Single worker executor owns this engine. Models are bundled and never downloaded on tablet. */
final class FaceEngine {
    static final String MODEL = "sface-2021dec-yunet-2023mar-v1";
    private static FaceEngine instance;
    private final FaceDetectorYN detector;
    private final FaceRecognizerSF recognizer;
    static FaceEngine get(Context context) {
        if (instance == null) instance = new FaceEngine(context.getApplicationContext());
        return instance;
    }
    private FaceEngine(Context context) {
        if (!OpenCVLoader.initLocal()) throw new IllegalStateException("OpenCV unavailable");
        detector = FaceDetectorYN.create(model(context, "yunet.onnx"), "", new Size(640,640), 0.9f, 0.3f, 5000);
        recognizer = FaceRecognizerSF.create(model(context, "sface.onnx"), "");
    }
    private static String model(Context context, String name) {
        File file = new File(context.getNoBackupFilesDir(), MODEL + "-" + name);
        try {
            long expected = name.equals("sface.onnx") ? 38696353 : 232589;
            if (!file.exists() || file.length() != expected) {
                File temp = new File(file.getPath() + ".tmp");
                try (var input = context.getAssets().open("models/" + name)) {
                    Files.copy(input, temp.toPath(), StandardCopyOption.REPLACE_EXISTING);
                }
                if (temp.length() != expected) throw new IllegalStateException("Incomplete model");
                Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            return file.getAbsolutePath();
        } catch (java.io.IOException e) { throw new IllegalStateException("Model unavailable", e); }
    }
    float[] feature(byte[] jpeg) {
        Bitmap bitmap = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.length);
        if (bitmap == null) throw new IllegalArgumentException("Invalid photo");
        Mat rgba = new Mat(), bgr = new Mat(), faces = new Mat(), aligned = new Mat(), feature = new Mat();
        try {
            Utils.bitmapToMat(bitmap, rgba);
            Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR);
            detector.setInputSize(bgr.size());
            detector.detect(bgr, faces);
            if (faces.rows() != 1) throw new IllegalArgumentException("Exactly one face required");
            Mat face = faces.row(0);
            try { recognizer.alignCrop(bgr, face, aligned); } finally { face.release(); }
            recognizer.feature(aligned, feature);
            float[] vector = new float[128];
            if (feature.total() != 128) throw new IllegalStateException("Unexpected model output");
            feature.get(0, 0, vector);
            if (!Double.isFinite(FaceMatchRules.cosine(vector, vector))) throw new IllegalStateException("Invalid vector");
            return vector;
        } finally { bitmap.recycle(); rgba.release(); bgr.release(); faces.release(); aligned.release(); feature.release(); }
    }
}
