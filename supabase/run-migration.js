/**
 * Supabase Migration Runner
 * Runs SQL migrations against Supabase PostgreSQL
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://asujcdxramfbtjrtzlgz.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_IVXIvEvnJPdR0eNi3WPtYA_vesMF0cX';

async function runSQL(sql, description) {
    console.log(`\n📦 ${description}...`);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ sql })
        });

        if (!response.ok) {
            // Try alternative: direct SQL via postgres endpoint
            const pgResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
                body: JSON.stringify({ query: sql })
            });

            if (!pgResponse.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        }

        console.log(`   ✅ Success`);
        return true;
    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 Supabase Migration Runner');
    console.log(`   URL: ${SUPABASE_URL}`);

    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    console.log(`\nFound ${files.length} migration files:`);
    files.forEach(f => console.log(`   - ${f}`));

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await runSQL(sql, `Running ${file}`);
    }

    console.log('\n✅ Migration complete!');
}

main().catch(console.error);
