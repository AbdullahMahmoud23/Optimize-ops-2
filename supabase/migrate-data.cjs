/**
 * Data Migration: MySQL (Railway) → Supabase
 */

// Load env FIRST
require('dotenv').config({ path: './backend/.env' });

const mysql = require('mysql2/promise');
const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = 'https://asujcdxramfbtjrtzlgz.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_IVXIvEvnJPdR0eNi3WPtYA_vesMF0cX';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// MySQL config (from your .env)
const mysqlConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
};

// Transform MySQL row to Supabase format (camelCase → snake_case)
function transformRow(tableName, row) {
    const mappings = {
        operators: { OperatorID: 'operator_id', Email: 'email', Password: 'password', Name: 'name', GoogleID: 'google_id' },
        recordings: {
            RecordingID: 'recording_id', OperatorID: 'operator_id', Shift: 'shift', Type: 'type',
            Transcript: 'transcript', AudioPath: 'audio_path', CreatedAt: 'created_at',
            DetectedDefects: 'detected_defects', DefectAnalysis: 'defect_analysis',
            TranscriptionText: 'transcription_text', PerformancePercentage: 'performance_percentage',
            FinalEvaluationScore: 'final_evaluation_score', EvaluationDetails: 'evaluation_details',
            ShiftDeductedTime: 'shift_deducted_time', ShiftDelayTime: 'shift_delay_time',
            EffectiveWorkingTime: 'effective_working_time', ShiftDate: 'shift_date'
        },
        evaluations: {
            EvaluationID: 'evaluation_id', RecordingID: 'recording_id', FaultCode: 'fault_code',
            FaultName: 'fault_name', DetectedDuration: 'detected_duration', StandardDuration: 'standard_duration',
            TimeDifference: 'time_difference', PerformanceStatus: 'performance_status',
            Score: 'score', AI_Summary: 'ai_summary', ExtraTime: 'extra_time'
        },
        tasks: { TaskID: 'task_id', Date: 'date', Shift: 'shift', TargetDescription: 'target_description', CreatedAt: 'created_at', UpdatedAt: 'updated_at' },
        targets: { TargetID: 'target_id', Name: 'name', TargetValue: 'target_value' },
        targetachievements: { AchievementID: 'achievement_id', TargetID: 'target_id', OperatorID: 'operator_id', Achievement: 'achievement', CreatedAt: 'created_at' },
        stops: { StopID: 'stop_id', Reason: 'reason', Timestamp: 'stop_timestamp' },
        defects_limits: { DefectID: 'defect_id', DefectName: 'defect_name', MaxDurationMinutes: 'max_duration_minutes', Severity: 'severity', CreatedAt: 'created_at' },
    };

    const mapping = mappings[tableName] || {};
    const transformed = {};

    for (const [key, value] of Object.entries(row)) {
        const newKey = mapping[key] || key.toLowerCase();
        // Handle dates
        if (value instanceof Date) {
            transformed[newKey] = value.toISOString();
        } else {
            transformed[newKey] = value;
        }
    }
    return transformed;
}

async function migrateTable(mysqlConn, tableName, pkColumn) {
    console.log(`\n📦 Migrating ${tableName}...`);

    try {
        const [rows] = await mysqlConn.query(`SELECT * FROM ${tableName} ORDER BY ${pkColumn}`);
        console.log(`   Found ${rows.length} rows in MySQL`);

        if (rows.length === 0) {
            console.log(`   ⏭️  Skipping (no data)`);
            return { success: true, count: 0 };
        }

        const transformed = rows.map(row => transformRow(tableName, row));

        // Insert to Supabase (fresh migration - use insert)
        const { data, error } = await supabase
            .from(tableName)
            .insert(transformed);

        if (error) {
            console.error(`   ❌ Error: ${error.message}`);
            return { success: false, count: 0, error: error.message };
        }

        console.log(`   ✅ Migrated ${rows.length} rows`);
        return { success: true, count: rows.length };
    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        return { success: false, count: 0, error: err.message };
    }
}

async function main() {
    console.log('🚀 MySQL → Supabase Data Migration\n');

    console.log('MySQL:', mysqlConfig.host, mysqlConfig.database);
    console.log('Supabase:', SUPABASE_URL);

    // Connect to MySQL
    const mysqlConn = await mysql.createConnection(mysqlConfig);
    console.log('✅ Connected to MySQL\n');

    // Migration order (respects foreign keys)
    const tables = [
        { name: 'admins', pk: 'id' },
        { name: 'supervisors', pk: 'id' },
        { name: 'operators', pk: 'OperatorID' },
        { name: 'targets', pk: 'TargetID' },
        { name: 'tasks', pk: 'TaskID' },
        { name: 'recordings', pk: 'RecordingID' },
        { name: 'evaluations', pk: 'EvaluationID' },
        { name: 'stops', pk: 'StopID' },
        { name: 'targetachievements', pk: 'AchievementID' },
    ];

    const results = [];
    for (const { name, pk } of tables) {
        const result = await migrateTable(mysqlConn, name, pk);
        results.push({ table: name, ...result });
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));

    let total = 0;
    for (const r of results) {
        const icon = r.success ? '✅' : '❌';
        console.log(`${icon} ${r.table}: ${r.count} rows`);
        total += r.count;
    }

    console.log('='.repeat(50));
    console.log(`Total: ${total} rows migrated`);

    await mysqlConn.end();
    console.log('\n✅ Done!');
}

main().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
