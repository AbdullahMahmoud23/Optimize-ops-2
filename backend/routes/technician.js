/* eslint-disable no-undef */
const express = require("express");
const router = express.Router();
const supabase = require("../supabaseDb");
const verifyToken = require("../middleware/auth");
const { analyzeShiftRollover } = require("../aiLogic");
const { executeAIRolloverDecisions, getNextShift, getShiftConfig } = require("../utils/shiftHandover");

// -- Technician: fetch targets
router.get('/targets', verifyToken, async (req, res) => {
    try {
        // 1. Fetch achievements for this operator
        const { data: achievements } = await supabase
            .from('targetachievements')
            .select('target_id, achievement, is_completed')
            .eq('operator_id', req.userId);

        // 2. Identify completed targets to hide
        const completedTargetIds = new Set();
        const achievementMap = new Map();
        
        if (achievements) {
            achievements.forEach(a => {
                achievementMap.set(a.target_id, a.achievement);
                if (a.is_completed) {
                    completedTargetIds.add(a.target_id);
                }
            });
        }

        // 3. Fetch targets (You might be fetching from 'tasks' or 'targets')
        // Assuming you want to show tasks for the current shift:
        // (If your app uses the 'targets' table, keep it as is. 
        //  If it uses the 'tasks' table for dynamic scheduling, ensure you query that instead).
        
        const { data: targets, error: targetsError } = await supabase
            .from('targets') // OR .from('tasks') if you migrated fully
            .select('target_id, name, target_value');

        if (targetsError) throw targetsError;

        // 4. Filter and Map
        const result = targets
            .filter(t => !completedTargetIds.has(t.target_id)) // 🟢 HIDE COMPLETED
            .map(t => ({
                TargetID: t.target_id,
                TargetName: t.name, // or t.target_description for tasks
                TargetValue: t.target_value, // or t.target_amount for tasks
                Achievement: achievementMap.get(t.target_id) || 0
            }));

        return res.json(result);
    } catch (err) {
        console.error('Error fetching targets:', err);
        return res.status(500).json({ error: 'Error fetching targets' });
    }
});

// -- Technician: update achievement for a target (upsert)
router.post('/targets/:targetId/achievement', verifyToken, async (req, res) => {
    const targetId = parseInt(req.params.targetId);
    const { achievement } = req.body;

    console.log(`📊 Achievement Save: targetId=${targetId}, achievement=${achievement}, userId=${req.userId}`);

    if (achievement == null) return res.status(400).json({ error: 'Missing achievement value' });

    try {
        // Upsert: try to update, if not exists insert
        const { data: existing } = await supabase
            .from('targetachievements')
            .select('achievement_id')
            .eq('target_id', targetId)
            .eq('operator_id', req.userId)
            .single();

        if (existing) {
            // Update existing
            const { error } = await supabase
                .from('targetachievements')
                .update({ achievement })
                .eq('target_id', targetId)
                .eq('operator_id', req.userId);

            if (error) throw error;
            console.log(`   ✓ Updated existing achievement`);
        } else {
            // Insert new
            const { error } = await supabase
                .from('targetachievements')
                .insert({
                    target_id: targetId,
                    operator_id: req.userId,
                    achievement
                });

            if (error) throw error;
            console.log(`   ✓ Inserted new achievement`);
        }

        // Note: Rollover is now handled via /finalize-shift endpoint with AI analysis
        // handleShiftHandover is no longer auto-triggered here to prevent duplicates

        return res.json({ ok: true });
    } catch (err) {
        console.error('Error updating achievement:', err);
        return res.status(500).json({ error: 'Error updating achievement' });
    }
});

// -- Technician: Get tasks for a specific date and shift (Hides Completed)
router.get('/tasks', verifyToken, async (req, res) => {
    try {
        const { date, shift } = req.query;

        if (!date || !shift) {
        return res.status(400).json({ error: 'Missing required query parameters: date, shift' });
        }

        // 1. Normalize Shift Name
        const shiftMap = {
        'First': 'First Shift', 'Second': 'Second Shift', 'Third': 'Third Shift',
        'First Shift': 'First Shift', 'Second Shift': 'Second Shift', 'Third Shift': 'Third Shift'
        };
        const normalizedShift = shiftMap[shift] || shift;

        // 2. Fetch Tasks
        const { data: tasks, error } = await supabase
        .from('tasks')
        .select('task_id, target_description, priority, is_rollover')
        .eq('date', date)
        .eq('shift', normalizedShift)
        .order('is_rollover', { ascending: false, nullsFirst: false })
        .order('priority', { ascending: true });

        if (error) throw error;

        // 3. Fetch Achievements to check "is_completed"
        const taskIds = (tasks || []).map(t => t.task_id);
        const achievementMap = new Map();
        const completedSet = new Set();

        if (taskIds.length > 0) {
        const { data: achievements } = await supabase
            .from('targetachievements')
            .select('target_id, achievement, is_completed') // 🟢 Fetch is_completed
            .eq('operator_id', req.userId)
            .in('target_id', taskIds);

        (achievements || []).forEach(a => {
            achievementMap.set(a.target_id, a.achievement);
            if (a.is_completed) {
                completedSet.add(a.target_id); // 🟢 Mark this ID as hidden
            }
        });
        }

        // 4. Filter & Transform
        // We REMOVE any task that is in the completedSet
        const result = (tasks || [])
            .filter(t => !completedSet.has(t.task_id)) // 🟢 THE FILTERING LOGIC
            .map(t => ({
                TaskID: t.task_id,
                TargetDescription: t.target_description,
                isRollover: t.is_rollover || false,
                savedAchievement: achievementMap.get(t.task_id) || null
            }));

        return res.json(result);

    } catch (err) {
        console.error('Error fetching tasks:', err);
        return res.status(500).json({ error: 'Error fetching tasks', details: err.message });
    }
});


// AI AGENT TRIGGER: FINALIZE SHIFT & ROLLOVER
router.post('/finalize-shift', verifyToken, async (req, res) => {
    try {
        const { date, shift } = req.body;
        console.log(`\n🤖 AI Agent Activated: Finalizing ${shift} on ${date}`);

        // 1. GATHER DATA (The Context)
        // Fetch all tasks and achievements for the current shift
        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select(`
                task_id, target_amount, target_unit, target_description, production_rate,
                targetachievements ( achievement )
            `)
            .eq('date', date)
            .eq('shift', shift);

        if (tasksError) throw tasksError;

        // Format data for the AI
        const shiftTasks = tasks.map(t => {
            const achievement = t.targetachievements?.[0]?.achievement 
                ? parseFloat(String(t.targetachievements[0].achievement).match(/[\d.]+/)?.[0] || 0)
                : 0;
            
            return {
                taskId: t.task_id,
                productName: t.target_description,
                targetAmount: t.target_amount,
                targetUnit: t.target_unit,
                achievement: achievement,
                productionRate: t.production_rate || (achievement / 8) || 1 // Fallback rate
            };
        });

        // Get Next Shift info for context
        const { nextShiftName, nextShiftDate } = getNextShift(shift, date);
        const nextDateStr = nextShiftDate.toISOString().split('T')[0];
        
        const { data: nextTasks } = await supabase
            .from('tasks')
            .select('target_amount, target_unit, target_description, target_hours')
            .eq('date', nextDateStr)
            .eq('shift', nextShiftName);

        const nextShiftContext = {
            name: nextShiftName,
            date: nextDateStr,
            tasks: nextTasks || [],
            totalHours: (nextTasks || []).reduce((sum, t) => sum + (t.target_hours || 0), 0)
        };

        const shiftData = {
            shift,
            date,
            tasks: shiftTasks,
            nextShift: nextShiftContext
        };

        // ASK THE BRAIN (Grok Agent)
        // This calls the function we just created in aiLogic.js
        const aiAnalysis = await analyzeShiftRollover(shiftData);

        // EXECUTE WITH HANDS (Shift Handover Utils)
        // This applies the modifications (Add Remaining / Complete Target)
        const executionResults = await executeAIRolloverDecisions(
            aiAnalysis.decisions, 
            { 
                currentDate: date,
                currentShift: shift,
                nextShiftName, 
                nextShiftDate: nextDateStr,
                tasks: shiftTasks 
            }
        );

        // CLEANUP: Mark Achievements as Completed
        const processedTaskIds = aiAnalysis.decisions.map(d => d.taskId);

        if (processedTaskIds.length > 0) {
            console.log(` Marking ${processedTaskIds.length} tasks as COMPLETED...`);

            await supabase
                .from('targetachievements')
                .update({ is_completed: true })
                .in('target_id', processedTaskIds)
                .eq('operator_id', req.userId);
        }

        // RESPOND
        res.json({
            success: true,
            message: "Shift finalized and targets modified successfully.",
            aiSummary: aiAnalysis.summary,
            actions: executionResults
        });

    } catch (err) {
        console.error("❌ Finalize Shift Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
