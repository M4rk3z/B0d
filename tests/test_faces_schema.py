from pathlib import Path
import sqlite3
import unittest

RAW = Path(__file__).resolve().parents[1] / "app/src/main/res/raw"

class FaceMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for file in ("workers_v1.sql", "attendance_v2.sql", "schedules_v3.sql", "calculations_v4.sql"):
            self.db.executescript((RAW / file).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workers VALUES ('w1','EMP-001','María',1,100,100)")
        self.db.execute("INSERT INTO workers VALUES ('w2','EMP-002','Juan',1,100,100)")
        self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES ('e1','w1','EMP-001','María','IN',200,'America/Chicago')")
        self.before = self.db.execute("SELECT * FROM punches").fetchall()
        self.db.executescript((RAW / 'faces_v5.sql').read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_migration_preserves_attendance(self):
        self.assertEqual(self.before, self.db.execute("SELECT * FROM punches").fetchall())
        self.assertEqual(2, self.db.execute("SELECT count(*) FROM workers").fetchone()[0])

    def test_missing_worker_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO face_profiles VALUES ('missing',?,300,1)", (b'ciphertext',))

    def test_one_profile_and_supported_version(self):
        self.db.execute("INSERT INTO face_profiles VALUES ('w1',?,300,1)", (b'ciphertext',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO face_profiles VALUES ('w1',?,301,1)", (b'new',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO face_profiles VALUES ('w2',?,301,2)", (b'new',))

    def test_profile_deletion_preserves_worker_and_history(self):
        self.db.execute("INSERT INTO face_profiles VALUES ('w1',?,300,1)", (b'ciphertext',))
        self.db.execute("DELETE FROM face_profiles WHERE worker_id='w1'")
        self.assertEqual(self.before, self.db.execute("SELECT * FROM punches").fetchall())
        self.assertEqual(2, self.db.execute("SELECT count(*) FROM workers").fetchone()[0])

    def test_deleting_unused_worker_removes_photo(self):
        self.db.execute("INSERT INTO face_profiles VALUES ('w2',?,300,1)", (b'ciphertext',))
        self.db.execute("DELETE FROM workers WHERE id='w2'")
        self.assertEqual(0, self.db.execute("SELECT count(*) FROM face_profiles").fetchone()[0])

    def test_history_still_prevents_worker_deletion(self):
        self.db.execute("INSERT INTO face_profiles VALUES ('w1',?,300,1)", (b'ciphertext',))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM workers WHERE id='w1'")
        self.assertEqual(1, self.db.execute("SELECT count(*) FROM face_profiles").fetchone()[0])

if __name__ == '__main__':
    unittest.main()
