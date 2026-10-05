from pathlib import Path
import sqlite3
import tempfile
import unittest

RAW = Path(__file__).resolve().parents[1] / "app/src/main/res/raw"

class AttendanceSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "attendance.db"
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript((RAW / "workers_v1.sql").read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workers VALUES ('w1','EMP-001','María',1,100,100)")
        self.db.execute("INSERT INTO worker_events(worker_id,action,actor,occurred_at) VALUES ('w1','created','local_admin',100)")
        self.db.commit()
        self.db.executescript((RAW / "attendance_v2.sql").read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def punch(self, event="e1", kind="IN", worker="w1"):
        self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES (?,?, 'EMP-001','María',?,200,'America/Chicago')", (event, worker, kind))

    def test_migration_keeps_workers_and_audit(self):
        self.assertEqual(self.db.execute("SELECT id,code,name,active FROM workers").fetchone(), ("w1", "EMP-001", "María", 1))
        self.assertEqual(self.db.execute("SELECT count(*) FROM worker_events").fetchone()[0], 1)

    def test_punches_survive_reopen(self):
        self.punch()
        self.punch("e2", "OUT")
        self.db.commit()
        self.db.close()
        self.db = sqlite3.connect(self.path)
        self.assertEqual(self.db.execute("SELECT kind,zone_id FROM punches ORDER BY seq").fetchall(), [("IN", "America/Chicago"), ("OUT", "America/Chicago")])

    def test_history_prevents_worker_delete(self):
        self.punch()
        self.db.execute("DELETE FROM worker_events")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM workers WHERE id='w1'")

    def test_unmarked_worker_can_be_deleted(self):
        with self.db:
            self.db.execute("INSERT INTO deleted_workers VALUES ('w1','EMP-001',300,'local_admin')")
            self.db.execute("DELETE FROM worker_events WHERE worker_id='w1'")
            self.db.execute("DELETE FROM workers WHERE id='w1'")
        self.assertEqual(self.db.execute("SELECT count(*) FROM workers").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT worker_code FROM deleted_workers").fetchone()[0], "EMP-001")
        self.db.execute("INSERT INTO workers VALUES ('w2','EMP-001','Nuevo',1,400,400)")

    def test_event_id_is_unique(self):
        self.punch()
        with self.assertRaises(sqlite3.IntegrityError):
            self.punch()

    def test_invalid_punch_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.punch(kind="BAD")

    def test_missing_worker_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.punch(worker="missing")

if __name__ == "__main__":
    unittest.main()
