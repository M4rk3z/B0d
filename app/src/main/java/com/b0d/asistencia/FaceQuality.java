package com.b0d.asistencia;

final class FaceQuality {
    static boolean acceptable(int count, int width, int height, float yaw, float pitch, float roll,
                              int left, int top, int right, int bottom, int imageWidth, int imageHeight) {
        return count == 1 && width >= 160 && height >= 160
                && Math.abs(yaw) <= 15 && Math.abs(pitch) <= 15 && Math.abs(roll) <= 15
                && left > 0 && top > 0 && right < imageWidth && bottom < imageHeight;
    }
}
