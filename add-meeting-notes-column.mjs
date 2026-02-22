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

async function addColumn() {
  try {
    console.log('Adding meeting_notes column...');
    
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
    `);
    
    console.log('✓ meeting_notes column added successfully');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error adding column:', error);
    await pool.end();
    process.exit(1);
  }
}

addColumn();
