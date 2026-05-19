const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'app.sqlite');
const seedPath = path.join(__dirname, 'db', 'seed.sql');

const db = new sqlite3.Database(dbPath);

const seedSQL = fs.readFileSync(seedPath, 'utf8');

db.exec(seedSQL, (err) => {
  if (err) {
    console.error('❌ Error:', err);
  } else {
    console.log('✅ Seed data inserted successfully!');
  }
  db.close();
});