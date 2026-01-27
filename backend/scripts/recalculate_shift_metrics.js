/**
 * Script: Recalculate Shift Metrics for All Existing Records
 * 
 * This script recalculates the ShiftDeductedTime, ShiftDelayTime, and EffectiveWorkingTime
 * for all existing recordings using the CORRECTED formula:
 * 
 * - ShiftDeductedTime = sum of ALLOWED/STANDARD time only (not actual detected time)
 * - ShiftDelayTime = sum of (DetectedDuration - AllowedTime) for evaluation
 * - EffectiveWorkingTime = 480 - ShiftDeductedTime
 * 
 * Run with: node scripts/recalculate_shift_metrics.js
 */

require('dotenv').config();
const db = require('../db');
const { calculateShiftMetrics } = require('../aiLogic');

async function recalculateAllShiftMetrics() {
    console.log('🔄 Starting recalculation of shift metrics...\n');

    try {
        // Get all unique operator-shift-date combinations
        const [shifts] = await db.promise().query(`
            SELECT DISTINCT 
                r.OperatorID, 
                r.Shift, 
                DATE(r.CreatedAt) as RecDate
            FROM recordings r
            WHERE r.Shift IS NOT NULL
            ORDER BY RecDate DESC
        `);

        console.log(`📊 Found ${shifts.length} unique shift combinations to process\n`);

        let updated = 0;
        let errors = 0;

        for (const shift of shifts) {
            const { OperatorID, Shift, RecDate } = shift;

            try {
                // Get all evaluations for this operator on this shift/date
                // Try with Quantity first, fallback to without it
                let evaluations;
                try {
                    const [result] = await db.promise().query(`
                        SELECT 
                            e.FaultCode, 
                            e.DetectedDuration,
                            COALESCE(e.Quantity, 1) as Quantity
                        FROM evaluations e
                        INNER JOIN recordings r ON e.RecordingID = r.RecordingID
                        WHERE r.OperatorID = ? AND r.Shift = ? AND DATE(r.CreatedAt) = ?
                    `, [OperatorID, Shift, RecDate]);
                    evaluations = result;
                } catch (colErr) {
                    // Quantity column might not exist, try without it
                    const [result] = await db.promise().query(`
                        SELECT 
                            e.FaultCode, 
                            e.DetectedDuration,
                            1 as Quantity
                        FROM evaluations e
                        INNER JOIN recordings r ON e.RecordingID = r.RecordingID
                        WHERE r.OperatorID = ? AND r.Shift = ? AND DATE(r.CreatedAt) = ?
                    `, [OperatorID, Shift, RecDate]);
                    evaluations = result;
                }

                if (evaluations.length === 0) {
                    // No evaluations, set default values
                    await db.promise().query(`
                        UPDATE recordings 
                        SET ShiftDeductedTime = 0, 
                            ShiftDelayTime = 0, 
                            EffectiveWorkingTime = 480
                        WHERE OperatorID = ? AND Shift = ? AND DATE(CreatedAt) = ?
                    `, [OperatorID, Shift, RecDate]);
                    continue;
                }

                // Calculate shift metrics using the CORRECTED formula
                const shiftMetrics = calculateShiftMetrics(evaluations);

                // Update all recordings for this shift
                await db.promise().query(`
                    UPDATE recordings 
                    SET ShiftDeductedTime = ?, 
                        ShiftDelayTime = ?, 
                        EffectiveWorkingTime = ?
                    WHERE OperatorID = ? AND Shift = ? AND DATE(CreatedAt) = ?
                `, [
                    shiftMetrics.totalFaultTime,
                    shiftMetrics.totalDelayTime,
                    shiftMetrics.effectiveWorkingTime,
                    OperatorID,
                    Shift,
                    RecDate
                ]);

                console.log(`✅ Operator ${OperatorID} | ${RecDate} | ${Shift}`);
                console.log(`   Allowed Fault Time: ${shiftMetrics.totalFaultTime} mins`);
                console.log(`   Delay Time: ${shiftMetrics.totalDelayTime} mins`);
                console.log(`   Effective Time: ${shiftMetrics.effectiveWorkingTime} mins (${shiftMetrics.effectiveWorkingHours} hrs)`);
                console.log('');

                updated++;

            } catch (err) {
                console.error(`❌ Error processing Operator ${OperatorID} | ${RecDate} | ${Shift}:`, err.message);
                errors++;
            }
        }

        console.log('\n========================================');
        console.log(`✅ Recalculation complete!`);
        console.log(`   Updated: ${updated} shifts`);
        console.log(`   Errors: ${errors}`);
        console.log('========================================\n');

    } catch (err) {
        console.error('❌ Fatal error:', err);
    } finally {
        // Close database connection
        process.exit(0);
    }
}

// Run the script
recalculateAllShiftMetrics();
