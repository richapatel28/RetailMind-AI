const pool = require("../src/config/db");

async function migrateUsers() {
  console.log("Adding onboarding columns to users table if not exist...");

  const queries = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS store_name VARCHAR(150);`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS business_type VARCHAR(100);`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(150);`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_language VARCHAR(50) DEFAULT 'en';`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_preference VARCHAR(50) DEFAULT 'Standard';`
  ];

  for (const q of queries) {
    await pool.query(q);
  }

  console.log("Users schema updated successfully!");
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
  console.log("Current columns:", cols.rows.map(r => r.column_name));
  pool.end();
}

migrateUsers().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
