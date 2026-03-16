// Run migrations by initializing the DB (migrations run inside getDb()).
import { getDb } from './client.js';

await getDb();
console.log('Migrations complete.');
