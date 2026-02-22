import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.backend.local') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'humanchat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function checkMeetingNotes() {
  try {
    console.log('Checking meeting_notes for user padpr1917@gmail.com...\n');
    
    const result = await pool.query(`
      SELECT 
        b.id,
        b.meeting_title,
        b.meeting_notes,
        b.status,
        b.start_time,
        u.email as user_email,
        u.name as user_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE u.email = 'padpr1917@gmail.com'
      ORDER BY b.start_time DESC
      LIMIT 5;
    `);
    
    console.log(`Found ${result.rows.length} bookings:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`Booking ${idx + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Title: ${row.meeting_title || '(none)'}`);
      console.log(`  Notes: ${row.meeting_notes || '(empty)'}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Start: ${new Date(row.start_time).toLocaleString()}`);
      console.log('');
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkMeetingNotes();
