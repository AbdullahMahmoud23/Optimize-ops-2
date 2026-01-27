/**
 * Data Migration Script: MySQL (Railway) → Supabase
 *
 * This script migrates data from your existing MySQL database to Supabase.
 *
 * Prerequisites:
 * 1. Run the Supabase migrations first (001, 002, 003)
 * 2. Install dependencies: npm install @supabase/supabase-js mysql2 dotenv
 * 3. Set environment variables (see below)
 *
 * Environment Variables:
 * - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

// MySQL connection config
const mysqlConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST,
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME,
    port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
};

// Supabase client (use service role for migrations)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Column name mappings (MySQL camelCase → PostgreSQL snake_case)
const columnMappings = {
    operators: {
        OperatorID: 'operator_id',
        Email: 'email',
        Password: 'password',
        Name: 'name',
        GoogleID: 'google_id',
    },
    admins: {
        id: 'id',
        name: 'name',
        email: 'email',
        password: 'password',
    },
    supervisors: {
        id: 'id',
        name: 'name',
        email: 'email',
        password: 'password',
        code: 'code',
        is_active: 'is_active',
    },
    defects_limits: {
        DefectID: 'defect_id',
        DefectName: 'defect_name',
        MaxDurationMinutes: 'max_duration_minutes',
        Severity: 'severity',
        CreatedAt: 'created_at',
    },
    targets: {
        TargetID: 'target_id',
        Name: 'name',
        TargetValue: 'target_value',
    },
    tasks: {
        TaskID: 'task_id',
        Date: 'date',
        Shift: 'shift',
        TargetDescription: 'target_description',
        CreatedAt: 'created_at',
        UpdatedAt: 'updated_at',
    },
    recordings: {
        RecordingID: 'recording_id',
        OperatorID: 'operator_id',
        Shift: 'shift',
        Type: 'type',
        Transcript: 'transcript',
        AudioPath: 'audio_path',
        CreatedAt: 'created_at',
        DetectedDefects: 'detected_defects',
        DefectAnalysis: 'defect_analysis',
        TranscriptionText: 'transcription_text',
        PerformancePercentage: 'performance_percentage',
        FinalEvaluationScore: 'final_evaluation_score',
        EvaluationDetails: 'evaluation_details',
        ShiftDeductedTime: 'shift_deducted_time',
        ShiftDelayTime: 'shift_delay_time',
        EffectiveWorkingTime: 'effective_working_time',
        ShiftDate: 'shift_date',
    },
    evaluations: {
        EvaluationID: 'evaluation_id',
        RecordingID: 'recording_id',
        FaultCode: 'fault_code',
        FaultName: 'fault_name',
        DetectedDuration: 'detected_duration',
        StandardDuration: 'standard_duration',
        TimeDifference: 'time_difference',
        PerformanceStatus: 'performance_status',
        Score: 'score',
        AI_Summary: 'ai_summary',
        ExtraTime: 'extra_time',
    },
    stops: {
        StopID: 'stop_id',
        Reason: 'reason',
        Timestamp: 'stop_timestamp',
    },
    targetachievements: {
        AchievementID: 'achievement_id',
        TargetID: 'target_id',
        OperatorID: 'operator_id',
        Achievement: 'achievement',
        CreatedAt: 'created_at',
    },
};

// Transform row from MySQL to Supabase format
function transformRow(tableName, row) {
    const mapping = columnMappings[tableName];
    if (!mapping) return row;

    const transformed = {};
    for (const [mysqlCol, value] of Object.entries(row)) {
        const pgCol = mapping[mysqlCol] || mysqlCol.toLowerCase();
        transformed[pgCol] = value;
    }
    return transformed;
}

// Migrate a single table
async function migrateTable(mysqlConn, tableName, orderBy = null) {
    console.log(`\n📦 Migrating ${tableName}...`);

    try {
        // Fetch from MySQL
        const orderClause = orderBy ? ` ORDER BY ${orderBy}` : '';
        const [rows] = await mysqlConn.query(`SELECT * FROM ${tableName}${orderClause}`);
        console.log(`   Found ${rows.length} rows in MySQL`);

        if (rows.length === 0) {
            console.log(`   ⏭️  Skipping (no data)`);
            return { table: tableName, migrated: 0, errors: 0 };
        }

        // Transform and insert to Supabase
        const transformedRows = rows.map(row => transformRow(tableName, row));

        // Insert in batches of 100
        const batchSize = 100;
        let migrated = 0;
        let errors = 0;

        for (let i = 0; i < transformedRows.length; i += batchSize) {
            const batch = transformedRows.slice(i, i + batchSize);
            const { data, error } = await supabase
                .from(tableName)
                .upsert(batch, { onConflict: 'id' })
                .select();

            if (error) {
                console.error(`   ❌ Error inserting batch: ${error.message}`);
                errors += batch.length;
            } else {
                migrated += batch.length;
            }
        }

        console.log(`   ✅ Migrated ${migrated} rows (${errors} errors)`);
        return { table: tableName, migrated, errors };

    } catch (err) {
        console.error(`   ❌ Failed: ${err.message}`);
        return { table: tableName, migrated: 0, errors: -1 };
    }
}

// Main migration function
async function migrate() {
    console.log('🚀 Starting MySQL → Supabase Migration\n');
    console.log('MySQL:', mysqlConfig.host, mysqlConfig.database);
    console.log('Supabase:', process.env.SUPABASE_URL);

    // Connect to MySQL
    const mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log('\n✅ Connected to MySQL');

    // Migration order (respects foreign keys)
    const migrationOrder = [
        { table: 'admins', orderBy: 'id' },
        { table: 'supervisors', orderBy: 'id' },
        { table: 'operators', orderBy: 'OperatorID' },
        { table: 'defects_limits', orderBy: 'DefectID' },
        { table: 'targets', orderBy: 'TargetID' },
        { table: 'tasks', orderBy: 'TaskID' },
        { table: 'recordings', orderBy: 'RecordingID' },
        { table: 'evaluations', orderBy: 'EvaluationID' },
        { table: 'stops', orderBy: 'StopID' },
        { table: 'targetachievements', orderBy: 'AchievementID' },
    ];

    const results = [];
    for (const { table, orderBy } of migrationOrder) {
        const result = await migrateTable(mysqlConn, table, orderBy);
        results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));

    let totalMigrated = 0;
    let totalErrors = 0;

    for (const r of results) {
        const status = r.errors === 0 ? '✅' : r.errors === -1 ? '❌' : '⚠️';
        console.log(`${status} ${r.table}: ${r.migrated} rows`);
        totalMigrated += r.migrated;
        totalErrors += Math.max(0, r.errors);
    }

    console.log('='.repeat(50));
    console.log(`Total: ${totalMigrated} rows migrated, ${totalErrors} errors`);

    // Cleanup
    await mysqlConn.end();
    console.log('\n✅ Migration complete!');
}

// Reset sequences after migration (important for SERIAL columns)
async function resetSequences() {
    console.log('\n🔄 Resetting PostgreSQL sequences...');

    const sequences = [
        { table: 'admins', column: 'id' },
        { table: 'supervisors', column: 'id' },
        { table: 'operators', column: 'operator_id' },
        { table: 'defects_limits', column: 'defect_id' },
        { table: 'targets', column: 'target_id' },
        { table: 'tasks', column: 'task_id' },
        { table: 'recordings', column: 'recording_id' },
        { table: 'evaluations', column: 'evaluation_id' },
        { table: 'stops', column: 'stop_id' },
        { table: 'targetachievements', column: 'achievement_id' },
    ];

    for (const { table, column } of sequences) {
        const sql = `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE(MAX(${column}), 1)) FROM ${table}`;
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) {
            console.log(`   ⚠️  Could not reset sequence for ${table}: ${error.message}`);
        } else {
            console.log(`   ✅ Reset sequence for ${table}`);
        }
    }
}

// Run migration
migrate()
    .then(() => resetSequences())
    .catch(err => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
