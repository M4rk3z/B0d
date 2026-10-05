package com.b0d.asistencia;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Versioned authenticated envelope; worker identity prevents swapping stored photos. */
final class FacePhotoCipher {
    static byte[] encrypt(SecretKey key, String worker, byte[] photo) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        cipher.updateAAD(worker.getBytes(StandardCharsets.UTF_8));
        byte[] encrypted = cipher.doFinal(photo);
        byte[] iv = cipher.getIV();
        return ByteBuffer.allocate(2 + iv.length + encrypted.length).put((byte) 1)
                .put((byte) iv.length).put(iv).put(encrypted).array();
    }
    static byte[] decrypt(SecretKey key, String worker, byte[] envelope) throws GeneralSecurityException {
        if (envelope == null || envelope.length < 30 || envelope[0] != 1 || envelope[1] != 12)
            throw new GeneralSecurityException("Invalid face envelope");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, envelope, 2, 12));
        cipher.updateAAD(worker.getBytes(StandardCharsets.UTF_8));
        return cipher.doFinal(envelope, 14, envelope.length - 14);
    }
}
