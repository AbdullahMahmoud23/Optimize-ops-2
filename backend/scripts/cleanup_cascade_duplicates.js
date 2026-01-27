const supabase = require('../supabaseDb');

/**
 * Cleanup duplicate CASCADE tasks created by the infinite loop bug
 * This script:
 * 1. Finds all tasks with multiple [CASCADE] tags in description
 * 2. Deletes them from the database
 * 3. Reports statistics
 */
async function cleanupDuplicateCascades() {
    console.log('🧹 Starting CASCADE duplicate cleanup...\n');

    try {
        // Step 1: Find all CASCADE tasks
        const { data: cascadeTasks, error: fetchError } = await supabase
            .from('tasks')
            .select('*')
            .ilike('target_description', '%[CASCADE]%');

        if (fetchError) {
            console.error('❌ Error fetching tasks:', fetchError.message);
            return;
        }

        console.log(`📊 Found ${cascadeTasks.length} tasks with [CASCADE] tag\n`);

        const toDelete = [];
        const stats = {
            total: cascadeTasks.length,
            duplicates: 0,
            valid: 0
        };

        // Step 2: Identify duplicates (more than one [CASCADE] tag)
        for (const task of cascadeTasks) {
            const cascadeCount = (task.target_description.match(/\[CASCADE\]/g) || []).length;

            if (cascadeCount > 1) {
                toDelete.push(task.task_id);
                stats.duplicates++;
                console.log(`❌ Duplicate: Task ${task.task_id} - ${task.target_description.substring(0, 80)}...`);
            } else {
                stats.valid++;
            }
        }

        console.log(`\n📈 Statistics:`);
        console.log(`   Total CASCADE tasks: ${stats.total}`);
        console.log(`   Valid (single tag): ${stats.valid}`);
        console.log(`   Duplicates (multiple tags): ${stats.duplicates}`);

        // Step 3: Delete duplicates
        if (toDelete.length > 0) {
            console.log(`\n🗑️ Deleting ${toDelete.length} duplicate tasks...`);

            const { error: deleteError } = await supabase
                .from('tasks')
                .delete()
                .in('task_id', toDelete);

            if (deleteError) {
                console.error('❌ Deletion failed:', deleteError.message);
            } else {
                console.log(`✅ Successfully deleted ${toDelete.length} duplicate tasks!`);
            }
        } else {
            console.log('\n✅ No duplicate CASCADE tasks found! Database is clean.');
        }

        // Step 4: Check remaining tasks count
        const { count: remainingCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true });

        console.log(`\n📊 Total tasks remaining in database: ${remainingCount}`);

    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
        console.error(err);
    }

    process.exit(0);
}

// Run the cleanup
cleanupDuplicateCascades();
