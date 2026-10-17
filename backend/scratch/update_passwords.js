const bcrypt = require("bcrypt");
const pool = require("../src/config/db");

async function setPassword() {
  const hash = await bcrypt.hash("password123", 10);
  const res = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE email = 'owner@test.com' OR email = 'richa@gmail.com'",
    [hash]
  );
  console.log("Updated users count:", res.rowCount);
  pool.end();
}

setPassword().catch(console.error);
