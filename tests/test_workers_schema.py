"""Checks the shipped schema with SQLite; Android integration remains a tablet check."""
from pathlib import Path
import sqlite3
import tempfile
import unittest

SCHEMA = Path(__file__).resolve().parents[1] / "app/src/main/res/raw/workers_v1.sql"

class WorkerSchemaTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "attendance.db"
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()
        self.directory.cleanup()

    def add(self, ident="w1", code="EMP-001", name="María Pérez"):
        self.db.execute("INSERT INTO workers VALUES (?, ?, ?, 1, 1000, 1000)", (ident, code, name))

    def test_reopen_preserves_data_and_state(self):
        self.add()
        self.db.execute("UPDATE workers SET active=0 WHERE id=?", ("w1",))
        self.db.commit()
        self.db.close()
        self.db = sqlite3.connect(self.path)
        self.assertEqual(self.db.execute("SELECT code, name, active FROM workers").fetchone(),
                         ("EMP-001", "María Pérez", 0))
        self.db.execute("UPDATE workers SET active=1 WHERE id=?", ("w1",))
        self.assertEqual(self.db.execute("SELECT id, active FROM workers").fetchone(), ("w1", 1))

    def test_code_unique_even_when_inactive(self):
        self.add()
        self.db.execute("UPDATE workers SET active=0")
        with self.assertRaises(sqlite3.IntegrityError):
            self.add("w2", "emp-001")

    def test_names_may_repeat(self):
        self.add()
        self.add("w2", "EMP-002")
        self.assertEqual(self.db.execute("SELECT count(*) FROM workers").fetchone()[0], 2)

    def test_event_requires_worker(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO worker_events(worker_id, action, actor, occurred_at) VALUES ('absent','created','local_admin',1)")

    def test_transaction_rollback(self):
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db:
                self.add()
                self.db.execute("INSERT INTO worker_events(worker_id, action, actor, occurred_at) VALUES ('w1','bad','local_admin',1)")
        self.assertEqual(self.db.execute("SELECT count(*) FROM workers").fetchone()[0], 0)

    def test_audit_preserves_worker(self):
        self.add()
        self.db.execute("INSERT INTO worker_events(worker_id, action, actor, occurred_at) VALUES ('w1','created','local_admin',1)")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM workers WHERE id='w1'")

    def test_invalid_status(self):
        self.add()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE workers SET active=2")

if __name__ == "__main__":
    unittest.main()
