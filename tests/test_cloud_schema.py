from pathlib import Path
import sqlite3
import unittest
RAW = Path(__file__).resolve().parents[1] / 'app/src/main/res/raw'
class CloudMigrationTests(unittest.TestCase):
    def test_migration_preserves_events_and_ack_survives_reopen(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            path = str(Path(temp) / 'test.db')
            db = sqlite3.connect(path)
            db.execute('PRAGMA foreign_keys=ON')
            for schema in ['workers_v1','attendance_v2','schedules_v3','calculations_v4','faces_v5','recognition_v6']:
                db.executescript((RAW / (schema + '.sql')).read_text(encoding='utf-8-sig'))
            db.execute("INSERT INTO workers VALUES('w','001','Persona',1,1,1)")
            db.execute("INSERT INTO punches VALUES(1,'evt','w','001','Persona','IN',100,'America/Chicago','facial')")
            db.execute("INSERT INTO facial_punch_details VALUES(1,'IN',0.8,'sface')")
            db.execute("INSERT INTO schedules VALUES('original','Turno original',0,'America/Chicago',1)")
            db.execute("INSERT INTO shift_contexts VALUES(1,'original','2026-10-01','America/Chicago')")
            db.execute("INSERT INTO face_profiles(worker_id,encrypted_photo,captured_at,format_version) VALUES('w',?,1,1)", (b'private',))
            db.executescript((RAW / 'cloud_v7.sql').read_text(encoding='utf-8-sig'))
            db.executescript((RAW / 'cloud_v8.sql').read_text(encoding='utf-8-sig'))
            db.executescript((RAW / 'cloud_v9.sql').read_text(encoding='utf-8-sig'))
            db.execute("INSERT INTO cloud_context_receipts VALUES('evt')")
            pending = 'SELECT count(*) FROM punches p WHERE NOT EXISTS(SELECT 1 FROM cloud_receipts r WHERE r.event_id=p.event_id)'
            self.assertEqual(db.execute(pending).fetchone()[0], 1)
            db.execute("INSERT INTO cloud_receipts VALUES('evt',200)")
            db.commit(); db.close()
            db = sqlite3.connect(path)
            self.assertEqual(db.execute(pending).fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT event_id FROM punches').fetchone()[0], 'evt')
            self.assertEqual(db.execute('SELECT encrypted_photo FROM face_profiles').fetchone()[0], b'private')
            self.assertEqual(db.execute('SELECT schedule_id FROM shift_contexts WHERE entry_seq=1').fetchone()[0], 'original')
            self.assertEqual(db.execute('SELECT event_id FROM cloud_context_receipts').fetchone()[0], 'evt')
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
            db.close()
if __name__ == '__main__': unittest.main()
