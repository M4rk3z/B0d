"""Desktop integration smoke test; does not establish real-world recognition accuracy."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/vision-test-deps'))
import cv2
import numpy as np

models = ROOT / 'app/src/main/assets/models'
detector = cv2.FaceDetectorYN.create(str(models/'yunet.onnx'), '', (640,640), 0.9, 0.3, 5000)
recognizer = cv2.FaceRecognizerSF.create(str(models/'sface.onnx'), '')

def embedding(image):
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, faces = detector.detect(image)
    assert faces is not None and len(faces) == 1, 'Expected one face in fixture'
    return recognizer.feature(recognizer.alignCrop(image, faces[0]))

a = cv2.imread(str(ROOT/'.tools/face-fixtures/sample-a.jpg'))
b = cv2.imread(str(ROOT/'.tools/face-fixtures/sample-b.jpg'))
assert a is not None and b is not None
first = embedding(a)
other = embedding(b)
variant = embedding(cv2.convertScaleAbs(a, alpha=0.92, beta=10))
same = recognizer.match(first, variant, cv2.FaceRecognizerSF_FR_COSINE)
different = recognizer.match(first, other, cv2.FaceRecognizerSF_FR_COSINE)
assert first.size == 128 and np.isfinite(first).all()
assert same >= 0.55 and same - different >= 0.10
assert different < 0.55
detector.setInputSize((640,640))
_, blank = detector.detect(np.zeros((640,640,3), dtype=np.uint8))
assert blank is None or len(blank) == 0
print(f'PASS desktop model smoke: dimensions, finite vector, same sample variant, different sample, blank image; scores {same:.3f}/{different:.3f}')
