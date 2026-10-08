import { connectDatabase, disconnectDatabase, syncDatabase } from '../config/database.js';
import '../models/index.js';

const force = process.argv.includes('--force');

async function main() {
  await connectDatabase();
  await syncDatabase({ force });
  console.log(force ? '[db:sync] tables dropped and recreated' : '[db:sync] tables created or updated');
  await disconnectDatabase();
}

main().catch((error) => {
  console.error('[db:sync] failed', error);
  process.exit(1);
});
