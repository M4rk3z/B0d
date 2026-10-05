from pathlib import Path
import sqlite3
import tempfile
import unittest

RAW = Path(__file__).resolve().parents[1] / "app/src/main/res/raw"

class ScheduleSchemaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "attendance.db"
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys=ON")
        for file in ("workers_v1.sql", "attendance_v2.sql"):
            self.db.executescript((RAW / file).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workers VALUES ('w1','EMP-001','María',1,100,100)")
        self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES ('e1','w1','EMP-001','María','IN',200,'America/Chicago')")
        self.db.commit()
        self.db.executescript((RAW / "schedules_v3.sql").read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO schedules VALUES ('s1','Oficina',0,'America/Chicago',300)")
        self.db.execute("INSERT INTO schedule_days VALUES ('s1',1,480,1020)")
        self.db.execute("INSERT INTO schedule_breaks VALUES ('s1',1,300,360)")
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_migration_keeps_workers_and_punches(self):
        self.assertEqual(self.db.execute("SELECT code,name FROM workers").fetchone(), ("EMP-001", "María"))
        self.assertEqual(self.db.execute("SELECT event_id,kind FROM punches").fetchone(), ("e1", "IN"))

    def test_persistence_and_checkbox_modes(self):
        self.db.execute("INSERT INTO schedules VALUES ('s2','Nocturno',1,'America/Chicago',300)")
        self.db.commit()
        self.db.close()
        self.db = sqlite3.connect(self.path)
        self.assertEqual(self.db.execute("SELECT mark_breaks FROM schedules ORDER BY id").fetchall(), [(0,), (1,)])
        self.assertEqual(self.db.execute("SELECT start_offset,end_offset FROM schedule_breaks").fetchone(), (300, 360))

    def test_assignment_history(self):
        self.db.execute("INSERT INTO schedules VALUES ('s2','Nuevo',1,'America/Chicago',300)")
        self.db.execute("INSERT INTO schedule_assignments(worker_id,schedule_id,effective_date,created_at) VALUES ('w1','s1','2026-10-01',300)")
        self.db.execute("INSERT INTO schedule_assignments(worker_id,schedule_id,effective_date,created_at) VALUES ('w1','s2','2026-11-01',400)")
        self.assertEqual(self.db.execute("SELECT schedule_id FROM schedule_assignments ORDER BY effective_date").fetchall(), [("s1",), ("s2",)])
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO schedule_assignments(worker_id,schedule_id,effective_date,created_at) VALUES ('w1','s2','2026-10-01',500)")

    def test_missing_references_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO schedule_breaks VALUES ('missing',1,60,90)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO schedule_assignments(worker_id,schedule_id,effective_date,created_at) VALUES ('missing','s1','2026-10-01',500)")

    def test_day_constraints(self):
        for values in (("s1", 0, 480, 1020), ("s1", 2, 480, 480), ("s1", 2, 480, 1920)):
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute("INSERT INTO schedule_days VALUES (?,?,?,?)", values)

    def test_duplicate_name_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO schedules VALUES ('s2','oficina',1,'America/Chicago',300)")

    def test_creation_rollback(self):
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.db.execute("INSERT INTO schedules VALUES ('s2','Otro',1,'America/Chicago',300)")
                self.db.execute("INSERT INTO schedule_days VALUES ('s2',1,480,480)")
        self.assertEqual(self.db.execute("SELECT count(*) FROM schedules WHERE id='s2'").fetchone()[0], 0)

    def test_delete_unmarked_worker_with_assignment(self):
        self.db.execute("INSERT INTO workers VALUES ('w2','EMP-002','Luis',1,100,100)")
        self.db.execute("INSERT INTO schedule_assignments(worker_id,schedule_id,effective_date,created_at) VALUES ('w2','s1','2026-10-01',300)")
        self.db.execute("DELETE FROM schedule_assignments WHERE worker_id='w2'")
        self.db.execute("DELETE FROM workers WHERE id='w2'")
        self.assertEqual(self.db.execute("SELECT count(*) FROM schedules").fetchone()[0], 1)

if __name__ == "__main__":
    unittest.main()
