from pathlib import Path
import sqlite3
import unittest

RAW = Path(__file__).resolve().parents[1] / 'app/src/main/res/raw'

class RecognitionMigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for name in ('workers_v1','attendance_v2','schedules_v3','calculations_v4','faces_v5'):
            self.db.executescript((RAW / (name + '.sql')).read_text())
        self.db.execute("INSERT INTO workers VALUES ('w','001','Test',1,1,1)")
        self.db.execute("INSERT INTO schedules VALUES ('s','Test',1,'America/Chicago',1)")
        self.db.execute("INSERT INTO punches VALUES (9,'event','w','001','Test','IN',1,'America/Chicago','manual')")
        self.db.execute("INSERT INTO shift_contexts VALUES (9,'s','2026-09-29','America/Chicago')")
        self.db.execute("INSERT INTO face_profiles VALUES ('w',?,1,1)", (b'encrypted',))
        self.db.executescript((RAW / 'recognition_v6.sql').read_text())

    def tearDown(self): self.db.close()

    def test_existing_data_preserved(self):
        self.assertEqual(self.db.execute('SELECT * FROM shift_contexts').fetchone(), (9,'s','2026-09-29','America/Chicago'))
        self.assertEqual(self.db.execute('SELECT seq,method FROM punches').fetchone(), (9,'manual'))
        self.assertEqual(self.db.execute('SELECT encrypted_photo,encrypted_template FROM face_profiles').fetchone(), (b'encrypted',None))
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_facial_event_and_sequence(self):
        self.db.execute("INSERT INTO punches(event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id,method) VALUES ('face','w','001','Test','BREAK_START',2,'America/Chicago','facial')")
        self.db.execute("INSERT INTO facial_punch_details VALUES (10,'MEAL',0.8,'sface-v1')")
        self.assertEqual(self.db.execute('SELECT seq,method FROM punches ORDER BY seq DESC LIMIT 1').fetchone(), (10,'facial'))

    def test_context_restricts_event_deletion(self):
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute('DELETE FROM punches WHERE seq=9')

    def test_bad_detail_rejected(self):
        for seq, action, score in [(999,'MEAL',0.8),(9,'INVALID',0.8),(9,'REST',1.5)]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute('INSERT INTO facial_punch_details VALUES (?,?,?,?)', (seq,action,score,'sface'))

    def test_unknown_method_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE punches SET method='unknown'")

    def test_delete_photo_preserves_attendance(self):
        self.db.execute("DELETE FROM face_profiles WHERE worker_id='w'")
        self.assertEqual(self.db.execute('SELECT count(*) FROM punches').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM shift_contexts').fetchone()[0], 1)

if __name__ == '__main__': unittest.main()
