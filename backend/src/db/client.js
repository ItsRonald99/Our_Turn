import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL || 'file:./dev.sqlite';
const dbPath = url.replace(/^file:/, '');
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(__dirname, '../../', dbPath);

let _db;
let _sqlDb;

function runMigrations() {
  _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at integer DEFAULT (unixepoch())
    )
  `);
  const drizzleDir = path.join(__dirname, '../../drizzle');
  const files = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
  const appliedRows = _sqlDb.exec('SELECT hash FROM __drizzle_migrations');
  const appliedSet = new Set();
  if (appliedRows.length > 0 && appliedRows[0].values) {
    appliedRows[0].values.forEach(([h]) => appliedSet.add(h));
  }
  for (const file of files) {
    const name = file.replace('.sql', '');
    if (appliedSet.has(name)) continue;
    const sql = readFileSync(path.join(drizzleDir, file), 'utf8');
    _sqlDb.exec(sql);
    _sqlDb.run('INSERT INTO __drizzle_migrations (hash) VALUES (?)', [name]);
    console.log('Applied migration:', file);
  }
}

async function init() {
  const SQL = await initSqlJs();
  if (existsSync(absolutePath)) {
    const buf = readFileSync(absolutePath);
    _sqlDb = new SQL.Database(buf);
  } else {
    _sqlDb = new SQL.Database();
  }
  _db = drizzle(_sqlDb, { schema });
  runMigrations();
  return _db;
}

export function getDbSync() {
  if (!_db) throw new Error('DB not initialized. Call getDb() at startup.');
  return _db;
}

export function saveDb() {
  if (_sqlDb) {
    const data = _sqlDb.export();
    const buf = Buffer.from(data);
    writeFileSync(absolutePath, buf);
  }
}

let initPromise;
export function getDb() {
  if (_db) return Promise.resolve(_db);
  if (!initPromise) initPromise = init();
  return initPromise;
}
