from pathlib import Path
import sqlite3
import unittest

RAW = Path(__file__).resolve().parents[1] / "app/src/main/res/raw"

class CalculationMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        for file in ("workers_v1.sql", "attendance_v2.sql", "schedules_v3.sql"):
            self.db.executescript((RAW / file).read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workers VALUES ('w1','EMP-001','María',1,100,100)")
        self.db.execute("INSERT INTO schedules VALUES ('s1','Oficina',1,'America/Chicago',300)")
        self.db.execute("INSERT INTO punches(seq,event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES (9,'old','w1','EMP-001','María','IN',200,'America/Chicago')")
        self.db.commit()
        self.db.executescript((RAW / "calculations_v4.sql").read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def test_original_event_exactly_preserved(self):
        self.assertEqual(self.db.execute("SELECT * FROM punches").fetchone(), (9,'old','w1','EMP-001','María','IN',200,'America/Chicago','manual'))
        self.assertEqual(self.db.execute("SELECT count(*) FROM workers").fetchone()[0],1)
        self.assertEqual(self.db.execute("SELECT count(*) FROM schedules").fetchone()[0],1)

    def test_new_kinds_and_sequence(self):
        for index, kind in enumerate(("BREAK_START","BREAK_END","OUT")):
            self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES (?,'w1','EMP-001','María',?,?,'America/Chicago')",(str(index),kind,300+index))
        self.assertEqual(self.db.execute("SELECT seq FROM punches ORDER BY seq").fetchall(),[(9,),(10,),(11,),(12,)])

    def test_context_references_are_valid(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO shift_contexts VALUES (999,'s1','2026-10-05','America/Chicago')")
        self.db.execute("INSERT INTO shift_contexts VALUES (9,'s1','2026-10-05','America/Chicago')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM punches WHERE seq=9")

    def test_no_schedule_snapshot_can_be_preserved(self):
        self.db.execute("INSERT INTO shift_contexts VALUES (9,NULL,'2026-10-05','America/Chicago')")
        self.assertIsNone(self.db.execute("SELECT schedule_id FROM shift_contexts").fetchone()[0])

    def test_worker_history_protected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM workers WHERE id='w1'")

    def test_unknown_kind_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id) VALUES ('bad','w1','EMP-001','María','BAD',300,'America/Chicago')")

if __name__ == "__main__":
    unittest.main()
