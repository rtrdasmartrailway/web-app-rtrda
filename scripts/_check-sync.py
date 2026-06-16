import json, subprocess
import urllib.request

# Get DB contentHtml for all records via Prisma
script = """
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const rows = await p.contentRecord.findMany({
  select: { id: true, contentHtml: true }
});
for (const r of rows) console.log('DB|' + r.id + '|' + r.contentHtml.length);
await p.$disconnect();
"""
open('scripts/_dump-db.mjs', 'w').write(script)
result = subprocess.run(['bash', '-c', 'set -a && source .env && set +a && npx tsx scripts/_dump-db.mjs'], capture_output=True, text=True, cwd='/srv/workspace/web-app-rtrda')
db = {}
for line in result.stdout.splitlines():
    if line.startswith('DB|'):
        _, id, length = line.split('|', 2)
        db[id] = int(length)

# Load wp-content.json
wp = json.load(open('/srv/workspace/web-app-rtrda/src/data/wp-content.json'))
wp_lengths = {r['id']: len(r['contentHtml']) for r in wp['records']}

# Compare
mismatches = []
for id in sorted(set(list(db.keys()) + list(wp_lengths.keys()))):
    d = db.get(id, 0)
    w = wp_lengths.get(id, 0)
    if d != w:
        mismatches.append((id, d, w))

print(f'Total DB records: {len(db)}')
print(f'Total WP records: {len(wp_lengths)}')
print(f'\nMismatches (DB vs wp-content.json):')
for id, d, w in mismatches:
    delta = d - w
    sign = '+' if delta > 0 else ''
    print(f'  {id}: DB={d}, WP={w}, Δ={sign}{delta}')

if not mismatches:
    print('  (none — DB and wp-content.json are in sync)')
