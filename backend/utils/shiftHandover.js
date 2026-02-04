const supabase = require("../supabaseDb");
const redis = require('redis');
const NodeCache = require('node-cache');

// ============================================
// إصلاح 5: معالجة الأخطاء ومنطق إعادة المحاولة
// إصلاح: تحصين المستقبل - ذاكرة التخزين الموزعة والقفل المتفائل
// ============================================

let redisClient = null;
let isRedisAvailable = false;

const initializeRedis = async () => {
    try {
        redisClient = redis.createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            socket: { reconnectStrategy: (retries) => retries > 5 ? new Error('Redis failed') : Math.min(retries * 50, 500) }
        });

        redisClient.on('error', () => {
            console.warn('⚠️ Redis unavailable - falling back to local cache');
            isRedisAvailable = false;
        });
        redisClient.on('connect', () => {
            console.log('✅ Connected to Redis');
            isRedisAvailable = true;
        });

        await redisClient.connect();
    } catch (err) {
        console.warn('⚠️ Redis init skipped, using local cache:', err.message);
        isRedisAvailable = false;
    }
};

initializeRedis().catch(err => console.warn('Redis startup warning:', err.message));

const rolloverCacheLocal = new NodeCache({
    stdTTL: 5,
    checkperiod: 1,
    useClones: false,
    maxKeys: 10000
});

/**
 * فحص عدم التكرار الموزع (Redis مع خيار بديل ذاكرة تخزين محلية)
 * يعمل عبر عدة نسخ من الخادم
 * @param {string} cacheKey - المفتاح المراد التحقق منه
 * @param {number} ttl - مدة البقاء بالثواني
 * @returns {Promise<boolean>} صحيح إذا كان يجب تخطيه (تمت معالجته بالفعل)
 */
const checkAndSetDistributedCache = async (cacheKey, ttl = 5) => {
    try {
        if (isRedisAvailable && redisClient) {
            const existing = await redisClient.get(cacheKey);
            if (existing) return true;
            await redisClient.setEx(cacheKey, ttl, '1');
            return false;
        }
    } catch (err) {
        console.warn(`⚠️ فشل فحص Redis: ${err.message}`);
    }

    // العودة إلى ذاكرة التخزين المحلية
    if (rolloverCacheLocal.has(cacheKey)) return true;
    rolloverCacheLocal.set(cacheKey, true, ttl);
    return false;
};

/**
 * تنفيذ عملية قاعدة البيانات مع منطق إعادة المحاولة للأخطاء العابرة
 * @param {Function} operation - دالة غير متزامنة للتنفيذ
 * @param {number} maxRetries - الحد الأقصى لعدد المحاولات (الافتراضي: 3)
 * @param {number} delayMs - التأخير بين المحاولات بالميلي ثانية (الافتراضي: 500)
 * @param {string} operationName - الاسم للتسجيل
 * @returns {Promise} نتيجة العملية الناجحة
 */
const executeWithRetry = async (operation, maxRetries = 3, delayMs = 500, operationName = 'Database operation') => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;

            // عدم إعادة المحاولة للأخطاء الدائمة
            if (err.message?.includes('FOREIGN KEY') || err.message?.includes('UNIQUE')) {
                console.error(`❌ ${operationName} - خطأ دائم: ${err.message}`);
                throw err;
            }

            if (attempt < maxRetries) {
                const delay = delayMs * attempt; // تراجع أسي
                console.warn(`⚠️ ${operationName} - المحاولة ${attempt}/${maxRetries} فشلت. إعادة محاولة في ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`❌ ${operationName} - فشل بعد ${maxRetries} محاولات: ${err.message}`);
            }
        }
    }

    throw lastError;
};

/**
 * التحقق مما إذا كان الخطأ عابرًا (يمكن إعادة المحاولة)
 * @param {Error} error - الخطأ المراد التحقق منه
 * @returns {boolean} صحيح إذا كان الخطأ عابرًا
 */
const isTransientError = (error) => {
    const message = error?.message || '';
    return message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('timeout') ||
        message.includes('Connection refused') ||
        error.code === 'ECONNRESET';
};

// ============================================
// 🔧 FIX 3: Normalized Product Matching Helper
// ============================================

/**
 * Normalize product name for consistent matching
 * Removes amounts, units, tags and extra whitespace
 * @param {string} description - Raw task description
 * @returns {string} Normalized product name
 */
const normalizeProductName = (description) => {
    if (!description) return '';
    return description
        .replace(/\d+\.?\d*\s*(كيلو|طن|kilometer|ton|units|kg|t)/gi, '') // Remove amounts
        .replace(/\[.*?\]|\(.*?\)/g, '') // Remove tags like [CASCADE], (Rollover)
        .replace(/CASCADE|ROLLOVER|PULL/gi, '') // Remove markers
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .toLowerCase();
};

/**
 * Check if two product names match (normalized comparison)
 * @param {string} desc1 - First description
 * @param {string} desc2 - Second description
 * @returns {boolean} True if products match
 */
const productsMatch = (desc1, desc2) => {
    const norm1 = normalizeProductName(desc1);
    const norm2 = normalizeProductName(desc2);
    // Exact normalized match or one contains the other completely
    return norm1 === norm2 ||
        (norm1.length > 3 && norm2.startsWith(norm1)) ||
        (norm2.length > 3 && norm1.startsWith(norm2));
};

// ============================================
// تكوين الفترات
// ============================================

// الأيام العادية: 3 فترات (8 ساعات لكل منها)
const NORMAL_SHIFT_ORDER = ['First Shift', 'Second Shift', 'Third Shift'];

// الجمعة: فترتان (12 ساعة لكل منها)
const FRIDAY_SHIFT_ORDER = ['First Shift', 'Second Shift'];

/**
 * الحصول على تكوين الفترة بناءً على التاريخ
 * @param {string|Date} date - التاريخ المراد التحقق منه
 * @returns {string[]} مصفوفة أسماء الفترات لهذا اليوم
 */
const getShiftConfig = (date) => {
    const dayOfWeek = new Date(date).getDay();
    // الجمعة = 5 في JavaScript (0 = الأحد)
    return dayOfWeek === 5 ? FRIDAY_SHIFT_ORDER : NORMAL_SHIFT_ORDER;
};

/**
 * الحصول على اسم وتاريخ الفترة التالية بناءً على الفترة والتاريخ الحاليين
 * @param {string} currentShift - اسم الفترة الحالية
 * @param {string|Date} currentDate - التاريخ الحالي
 * @returns {{nextShiftName: string, nextShiftDate: Date}}
 */
const getNextShift = (currentShift, currentDate) => {
    const date = new Date(currentDate);
    const shiftOrder = getShiftConfig(date);
    const currentShiftIndex = shiftOrder.indexOf(currentShift);

    let nextShiftDate = new Date(date);
    let nextShiftName = '';

    // إذا كانت آخر فترة في اليوم -> الانتقال إلى الفترة الأولى من اليوم التالي
    if (currentShiftIndex === shiftOrder.length - 1) {
        nextShiftDate.setDate(nextShiftDate.getDate() + 1);
        // الحصول على تكوين فترة اليوم التالي (قد يكون الجمعة)
        const nextDayShiftOrder = getShiftConfig(nextShiftDate);
        nextShiftName = nextDayShiftOrder[0];
    } else {
        nextShiftName = shiftOrder[currentShiftIndex + 1];
    }

    return { nextShiftName, nextShiftDate };
};

// ============================================
// تسجيل التمرير/الموازنة
// ============================================

/**
 * تسجيل حدث تمرير/موازنة لرؤية المسؤول
 * @param {Object} logData - البيانات المراد تسجيلها
 */
const logRolloverEvent = async (logData) => {
    try {
        // استخدام منطق إعادة المحاولة للتسجيل لضمان الحفاظ على السجلات
        await executeWithRetry(
            () => supabase.from('rollover_logs').insert({
                task_id: logData.taskId,
                original_task_description: logData.description,
                achievement: logData.achievement,
                target_amount: logData.targetAmount,
                difference: logData.difference,
                action_type: logData.actionType, // 'تمرير' أو 'موازنة'
                next_shift: logData.nextShift,
                next_date: logData.nextDate,
                time_affected: logData.timeAffected,
                details: logData.details
            }),
            2, // محاولتان للتسجيل (أقل أهمية من العمليات الرئيسية)
            300,
            `تسجيل حدث ${logData.actionType} للمهمة ${logData.taskId}`
        );
        console.log(`📝 تم تسجيل حدث ${logData.actionType} للمهمة ${logData.taskId}`);
    } catch (err) {
        // عدم فشل العملية الرئيسية إذا فشل التسجيل
        console.error('⚠️ فشل تسجيل حدث التمرير:', err.message);
    }
};


const handleShiftHandover = async (taskId, achievement) => {
    const operations = []; // تتبع العمليات للتراجع المحتمل

    try {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 بدأت عملية تسليم الفترة');
        console.log('='.repeat(60));

        // 🔧 إصلاح 2: عدم التكرار مع Redis (آمن الموزع)
        // 🚀 يعمل الآن عبر عدة نسخ من الخادم
        const cacheKey = `rollover:${taskId}:${achievement}`;
        const isDuplicate = await checkAndSetDistributedCache(cacheKey, 5);

        if (isDuplicate) {
            console.log(`⚠️ تخطي التمرير المكرر للمهمة ${taskId} (ذاكرة ${isRedisAvailable ? 'Redis' : 'محلية'})`);
            console.log('='.repeat(60) + '\n');
            return;
        }

        // تنظيف الإدخالات القديمة (أقدم من فترة تنظيف ذاكرة التخزين)
        // تم التعامل معها بواسطة NodeCache تلقائيًا عبر TTL وmax حدود

        console.log(`🔄 معالجة التسليم للمهمة ${taskId}، الإنجاز: ${achievement}`);

        // 1. الحصول على تفاصيل المهمة الحالية
        let currentTask = null;

        // محاولة TaskID أولاً (أحرف كبيرة)
        const { data: taskUpper, error: fetchError } = await supabase
            .from('tasks')
            .select('*')
            .eq('TaskID', taskId)
            .single();

        if (fetchError || !taskUpper) {
            // محاولة task_id بأحرف صغيرة (فحص عدم تطابق المخطط)
            const { data: taskLower, error: fetchErrorLower } = await supabase
                .from('tasks')
                .select('*')
                .eq('task_id', taskId)
                .single();

            if (fetchErrorLower || !taskLower) {
                console.error('❌ لم يتم العثور على المهمة للتسليم:', taskId);
                return;
            }
            currentTask = taskLower;
        } else {
            currentTask = taskUpper;
        }

        // 2. تحليل الإنجاز وحساب الفرق
        // قد يأتي الإنجاز كنص ("1158 كيلو") - استخراج الرقم
        const achievementNum = typeof achievement === 'string'
            ? parseFloat(achievement.match(/[\d.]+/)?.[0] || '0')
            : parseFloat(achievement) || 0;

        const targetAmount = parseFloat(currentTask.target_amount) || 0;
        const diff = achievementNum - targetAmount;

        console.log(`📊 الإنجاز: ${achievementNum}، الهدف: ${targetAmount}، الفرق: ${diff}`);

        // التحقق من صحة الأرقام
        if (isNaN(achievementNum) || isNaN(targetAmount)) {
            console.error('❌ إنجاز أو هدف غير صحيح:', { achievement, targetAmount: currentTask.target_amount });
            return;
        }

        // إذا كان متطابقًا تقريبًا (-5 إلى +5 التسامح)، لا حاجة للإجراء
        if (Math.abs(diff) < 5) {
            console.log('✅ الإنجاز ضمن التسامح، لا حاجة لتمرير');
            return;
        }

        // 3. Determine Next Shift (with Friday support)
        const { nextShiftName, nextShiftDate } = getNextShift(currentTask.shift, currentTask.date);
        const nextShiftDateStr = nextShiftDate.toISOString().split('T')[0];

        console.log(`📅 Next shift: ${nextShiftName} on ${nextShiftDateStr}`);

        // 4. Get Next Shift Tasks (ordered by priority DESC = lowest priority first)
        // 🚀 Include version_number for Optimistic Locking protection
        const { data: nextTasks } = await supabase
            .from('tasks')
            .select('*, version_number')
            .eq('date', nextShiftDateStr)
            .eq('shift', nextShiftName)
            .order('priority', { ascending: false });

        // Calculate production rate with fallback
        const targetHours = parseFloat(currentTask.target_hours) || 8; // Default to 8 hours if null
        let productionRate = parseFloat(currentTask.production_rate);

        // 🔧 FIX 1: Robust Production Rate Validation
        if (!productionRate || isNaN(productionRate) || productionRate <= 0) {
            // Try to calculate from target
            if (targetAmount > 0 && targetHours > 0) {
                productionRate = targetAmount / targetHours;
                console.log(`📊 Production rate calculated from target: ${productionRate.toFixed(2)} units/hour`);
            } else {
                // Last resort fallback
                productionRate = 1;
                console.warn(`⚠️ Could not calculate production rate, using fallback: 1 unit/hour`);
            }
        }

        // Final validation
        if (!productionRate || isNaN(productionRate) || productionRate <= 0) {
            console.error('❌ Critical error - Invalid production rate:', {
                provided: currentTask.production_rate,
                calculated: targetAmount / targetHours,
                fallback: 1
            });
            productionRate = 1; // Absolute fallback
        }

        console.log(`📈 Production Rate: ${productionRate.toFixed(2)} units/hour (from ${currentTask.production_rate ? 'DB' : 'calculation'})`);

        // Validate production rate
        if (!productionRate || isNaN(productionRate) || productionRate <= 0) {
            console.error('❌ Invalid production rate calculated:', { production_rate: currentTask.production_rate, targetAmount, targetHours });
            return;
        }

        // 🔧 FIX 3: Schema Normalization - Handle both TaskID and task_id
        // Preferred: use task_id (lowercase) for consistency
        // This helper normalizes both column name formats
        const getTaskIdField = (task) => {
            // Return the field name (TaskID or task_id)
            if (task.hasOwnProperty('task_id')) return 'task_id';
            if (task.hasOwnProperty('TaskID')) return 'TaskID';
            console.warn('⚠️ Task has neither task_id nor TaskID:', task);
            return 'task_id'; // default fallback
        };

        const getTaskId = (task) => {
            // Return the actual ID value
            return task.task_id || task.TaskID;
        };

        const taskIdField = getTaskIdField(currentTask);

        if (diff < 0) {
            // ============================================
            // CASE 1: UNDER-ACHIEVEMENT (ROLLOVER)
            // ============================================
            const remainingAmount = Math.abs(diff);
            const timeNeeded = remainingAmount / productionRate;

            console.log(`📉 Rollover: ${remainingAmount} units (${timeNeeded.toFixed(2)} hrs) to ${nextShiftName}`);

            // A. Check Capacity in Next Shift
            // Get shift duration dynamically (8 hrs normal, 12 hrs Friday)
            const { getShiftDuration } = require('../aiLogic');  // FIXED: aiLogic is in backend/, not backend/utils/
            const SHIFT_DURATION = (nextShiftDateStr && getShiftDuration)
                ? getShiftDuration(nextShiftDateStr) / 60  // Convert minutes to hours
                : 8;

            const totalTaskHours = (nextTasks || []).reduce((sum, t) => sum + (parseFloat(t.target_hours) || 0), 0);
            const availableHours = SHIFT_DURATION - totalTaskHours;


            console.log(`📊 Shift capacity: ${totalTaskHours.toFixed(2)}/${SHIFT_DURATION} hrs used, ${availableHours.toFixed(2)} hrs available`);

            // B. Extract product name for merging check
            const extractProductName = (desc) => {
                return desc
                    .replace(/\d+\.?\d*\s*(كيلو|طن|kilometer|ton)/gi, '')
                    .replace(/\(.*?\)/g, '')
                    .trim();
            };

            const currentProductName = extractProductName(currentTask.target_description);

            // ============================================
            // NEW LOGIC: MAKE SPACE IF NEEDED, THEN ADD ROLLOVER
            // ============================================

            // Step 1: Check if we need to deduct from next shift to make space
            if (timeNeeded > availableHours) {
                const timeToDeduct = timeNeeded - availableHours;
                console.log(`⚠️ Need to free ${timeToDeduct.toFixed(2)} hrs. Deducting from next shift tasks...`);

                // Get all tasks in next shift (sorted by priority, lowest first to preserve important tasks)
                const { data: deductTasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('date', nextShiftDateStr)
                    .eq('shift', nextShiftName)
                    .order('priority', { ascending: false }); // Lowest priority first

                let timeFreed = 0;
                const tasksToDeduct = []; // Track deductions to cascade

                for (const task of (deductTasks || [])) {
                    if (timeFreed >= timeToDeduct - 0.01) break; // Enough space freed

                    const taskHours = parseFloat(task.target_hours) || 0;
                    if (taskHours <= 0) continue;

                    // 🔧 FIX 4: Calculate rate from actual data, log if missing production_rate
                    const taskAmount = parseFloat(task.target_amount) || 0;
                    let taskRate = parseFloat(task.production_rate);
                    if (!taskRate || taskRate <= 0) {
                        taskRate = taskAmount / taskHours; // Calculate from actual values
                        console.warn(`⚠️ Task ${task.task_id} missing production_rate, calculated: ${taskRate.toFixed(2)} from ${taskAmount}/${taskHours}`);
                    }

                    // How much to deduct from this task
                    const deductHours = Math.min(taskHours, timeToDeduct - timeFreed);
                    const deductAmount = Math.round(taskRate * deductHours);

                    console.log(`   🔻 Deducting ${deductAmount} units (${deductHours.toFixed(2)} hrs) from: ${task.target_description}`);

                    // Update or delete the task
                    const newAmount = Math.max(0, parseFloat(task.target_amount) - deductAmount);
                    const newHours = Math.max(0, taskHours - deductHours);

                    if (newHours < 0.05) {
                        // Delete the task if less than 3 minutes remaining
                        await executeWithRetry(
                            () => supabase.from('tasks').delete().eq(taskIdField, getTaskId(task)),
                            3,
                            500,
                            `Delete task ${getTaskId(task)} (complete)`
                        );
                        console.log(`      ✖ Deleted task (no time remaining)`);
                    } else {
                        // Update the task with retry logic + Optimistic Locking
                        // 🚀 Only succeeds if version hasn't changed (prevents race conditions)
                        const taskId = getTaskId(task);
                        const taskVersion = task.version_number || 0;

                        await executeWithRetry(
                            () => supabase.from('tasks').update({
                                target_amount: newAmount,
                                target_hours: newHours,
                                target_description: `${extractProductName(task.target_description)} ${newAmount} ${task.target_unit}`,
                                version_number: taskVersion + 1
                            }).eq(taskIdField, taskId)
                                .eq('version_number', taskVersion),
                            3,
                            500,
                            `Update task ${taskId} (cascade deduction)`
                        );
                        console.log(`      ↓ Reduced to ${newAmount} units (${newHours.toFixed(2)} hrs)`);
                    }

                    // Store deducted tasks for cascade
                    tasksToDeduct.push({
                        productName: extractProductName(task.target_description),
                        amount: deductAmount,
                        hours: deductHours,
                        rate: taskRate,
                        unit: task.target_unit
                    });

                    timeFreed += deductHours;
                }

                console.log(`   ✅ Freed ${timeFreed.toFixed(2)} hrs of the ${timeToDeduct.toFixed(2)} hrs needed`);

                // Step 2: Cascade deducted tasks to next-next shift
                if (tasksToDeduct.length > 0) {
                    const { nextShiftName: cascadeShiftName, nextShiftDate: cascadeDate } = getNextShift(nextShiftName, nextShiftDateStr);
                    const cascadeDateStr = cascadeDate.toISOString().split('T')[0];

                    for (const deducted of tasksToDeduct) {
                        // 🔧 FIX 3: Use normalized product matching instead of fuzzy ilike
                        const { data: cascadeShiftTasks } = await supabase
                            .from('tasks')
                            .select('*')
                            .eq('date', cascadeDateStr)
                            .eq('shift', cascadeShiftName);

                        const cascadeTask = (cascadeShiftTasks || []).find(t =>
                            productsMatch(t.target_description, deducted.productName)
                        );

                        if (cascadeTask) {
                            // Merge with existing
                            const newAmount = parseFloat(cascadeTask.target_amount) + deducted.amount;
                            const newHours = parseFloat(cascadeTask.target_hours || 0) + deducted.hours;

                            await executeWithRetry(
                                () => supabase.from('tasks').update({
                                    target_amount: newAmount,
                                    target_hours: newHours,
                                    target_description: `${deducted.productName} ${newAmount} ${cascadeTask.target_unit} [Cascade]`,
                                    is_rollover: true,
                                    priority: 0
                                }).eq(taskIdField, getTaskId(cascadeTask)),
                                3,
                                500,
                                `Merge cascade task ${getTaskId(cascadeTask)}`
                            );

                            console.log(`   🔗 Cascaded to ${cascadeShiftName}: merged with existing task (${newAmount} units)`);
                        } else {
                            // Create new task in cascade shift with retry logic
                            await executeWithRetry(
                                () => supabase.from('tasks').insert({
                                    date: cascadeDateStr,
                                    shift: cascadeShiftName,
                                    target_amount: deducted.amount,
                                    target_hours: deducted.hours,
                                    target_unit: deducted.unit,
                                    target_description: `${deducted.productName} ${deducted.amount} ${deducted.unit} [Cascade]`,
                                    production_rate: deducted.rate,
                                    is_rollover: true,
                                    priority: 0
                                }),
                                3,
                                500,
                                `Create cascade task in ${cascadeShiftName}`
                            );

                            console.log(`   🔗 Cascaded to ${cascadeShiftName}: created new task (${deducted.amount} units)`);
                        }
                    }
                }
            }

            // Step 3: NOW add the rollover (space has been made!)
            // Re-fetch next shift tasks after deduction
            const { data: updatedNextTasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('date', nextShiftDateStr)
                .eq('shift', nextShiftName);

            const sameProductTask = updatedNextTasks?.find(t => {
                const taskProductName = extractProductName(t.target_description);
                return taskProductName === currentProductName;
            });

            if (sameProductTask) {
                const newTotalAmount = sameProductTask.target_amount + remainingAmount;
                const newTotalHours = (sameProductTask.target_hours || 0) + timeNeeded;
                const newDescription = `${currentProductName} ${newTotalAmount} ${currentTask.target_unit} [Rollover]`;

                console.log(`   ✓ Merging rollover ${remainingAmount} units → Total: ${newTotalAmount}`);

                const { error } = await supabase.from('tasks').update({
                    target_amount: newTotalAmount,
                    target_hours: newTotalHours,
                    target_description: newDescription,
                    is_rollover: true,
                    original_task_id: getTaskId(currentTask),
                    priority: 0  // Rollover gets highest priority
                }).eq(taskIdField, getTaskId(sameProductTask));

                if (error) throw new Error(`Failed to merge rollover: ${error.message}`);
                operations.push({ type: 'update', table: 'tasks', id: getTaskId(sameProductTask) });
            } else {
                console.log(`   ✓ Creating new rollover task (${remainingAmount} units)`);

                const { error } = await supabase.from('tasks').insert({
                    date: nextShiftDateStr,
                    shift: nextShiftName,
                    target_amount: remainingAmount,
                    target_unit: currentTask.target_unit,
                    target_hours: timeNeeded,
                    target_description: `${currentProductName} ${remainingAmount} ${currentTask.target_unit} [Rollover]`,
                    production_rate: productionRate,
                    is_rollover: true,
                    original_task_id: getTaskId(currentTask),
                    priority: 0 // Highest priority
                });

                if (error) throw new Error(`Failed to create rollover task: ${error.message}`);
                operations.push({ type: 'insert', table: 'tasks' });
            }


            // Log the rollover event
            await logRolloverEvent({
                taskId: getTaskId(currentTask),
                description: currentTask.target_description,
                achievement,
                targetAmount,
                difference: diff,
                actionType: 'rollover',
                nextShift: nextShiftName,
                nextDate: nextShiftDateStr,
                timeAffected: timeNeeded,
                details: `Rolled over ${remainingAmount} units requiring ${timeNeeded.toFixed(2)} hours`
            });

        } else {
            // ============================================
            // CASE 2: OVER-ACHIEVEMENT (BALANCING)
            // ============================================
            const extraAmount = diff;
            const timeSaved = extraAmount / productionRate;

            console.log(`📈 Over-achievement: ${extraAmount} units (${timeSaved.toFixed(2)} hrs) saved for ${nextShiftName}`);

            // Helper to extract product name safely
            const getProd = (desc) => {
                return desc
                    .replace(/\d+\.?\d*\s*(كيلو|طن|kilometer|ton|units)/gi, '')
                    .replace(/\(.*?\)/g, '')
                    .trim();
            };
            const currentProdName = getProd(currentTask.target_description);

            // 🔧 FIX: Use dynamic shift duration instead of hardcoded 8 hours
            const { getShiftDuration } = require('../aiLogic');
            const NEXT_SHIFT_DURATION = (nextShiftDateStr && getShiftDuration)
                ? getShiftDuration(nextShiftDateStr) / 60  // Convert minutes to hours
                : 8;

            // A. Find Same Product in Next Shift (using normalized matching)
            const sameProductTask = nextTasks?.find(t =>
                getProd(t.target_description) === currentProdName
            );

            let nextShiftModified = false;

            // B. Deduct from Same Product in Next Shift (if exists)
            if (sameProductTask) {
                const taskRate = sameProductTask.production_rate || productionRate;
                const taskHours = sameProductTask.target_hours || (sameProductTask.target_amount / taskRate);

                // Surplus units = diff (already calculated as positive)
                const surplusUnits = diff;
                const surplusHours = surplusUnits / taskRate;

                console.log(`   🔍 Found same product in Next Shift: Task ${getTaskId(sameProductTask)} (${sameProductTask.target_amount} units)`);

                if (surplusUnits >= sameProductTask.target_amount - 10) { // Tolerance
                    // Delete entire task
                    const { error } = await supabase.from('tasks').delete().eq(taskIdField, getTaskId(sameProductTask));
                    if (error) throw new Error(`Failed to delete task: ${error.message}`);
                    console.log(`   ✨ Reverse Rollover: Completed Next Shift task ${getTaskId(sameProductTask)} fully.`);
                    operations.push({ type: 'delete', table: 'tasks', id: getTaskId(sameProductTask) });
                    nextShiftModified = true;
                } else {
                    // Reduce task
                    const newAmount = sameProductTask.target_amount - surplusUnits;
                    const newHours = taskHours - surplusHours;
                    const { error } = await supabase.from('tasks').update({
                        target_amount: newAmount,
                        target_hours: newHours,
                        target_description: `${currentProdName} ${newAmount} ${sameProductTask.target_unit}`,
                        adjustment_source: 'reverse_rollover_deduction'
                    }).eq(taskIdField, getTaskId(sameProductTask));

                    if (error) throw new Error(`Failed to reduce task: ${error.message}`);
                    console.log(`   ✨ Reverse Rollover: Reduced Next Shift task by ${surplusUnits} units.`);
                    operations.push({ type: 'update', table: 'tasks', id: getTaskId(sameProductTask) });
                    nextShiftModified = true;
                }
            } else {
                console.log(`   ℹ️ No same product found in Next Shift to deduct surplus from.`);
            }

            // C. Refill Next Shift (Cascade Pull) - Always check capacity after over-achievement
            // 🔧 FIX: Check Pull Forward even if no same product was found
            {
                console.log(`   🔄 Checking Next Shift Capacity for Refill...`);

                // Fetch tasks again to get current state
                const { data: updatedNextTasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('date', nextShiftDateStr)
                    .eq('shift', nextShiftName);

                const currentLoad = (updatedNextTasks || []).reduce((sum, t) => sum + (parseFloat(t.target_hours) || 0), 0);

                // 🔧 FIX: Use dynamic NEXT_SHIFT_DURATION instead of hardcoded availableSpaceInNext
                if (currentLoad < NEXT_SHIFT_DURATION - 0.5) { // 30 min tolerance
                    const hoursNeeded = NEXT_SHIFT_DURATION - currentLoad;
                    console.log(`   ⚠️ Next Shift has gap of ${hoursNeeded.toFixed(2)} hrs. Pulling from Subsequent Shift...`);

                    // Identify Subsequent Shift (Shift+2)
                    const nextShiftDateObj = new Date(nextShiftDateStr + 'T00:00:00Z');
                    const { nextShiftName: subShiftName, nextShiftDate: subShiftDate } = getNextShift(nextShiftName, nextShiftDateObj);
                    const subShiftDateStr = subShiftDate.toISOString().split('T')[0];

                    // Fetch tasks from Shift+2
                    const { data: subTasks } = await supabase
                        .from('tasks')
                        .select('*')
                        .eq('date', subShiftDateStr)
                        .eq('shift', subShiftName)
                        .order('priority', { ascending: true }); // Pull high priority first? Or FIFO?

                    if (subTasks && subTasks.length > 0) {
                        let timeToFill = hoursNeeded;

                        for (const subTask of subTasks) {
                            if (timeToFill <= 0.1) break;

                            // 🔧 FIX 4: Calculate rate properly from task data
                            const subAmount = parseFloat(subTask.target_amount) || 0;
                            const subHours = parseFloat(subTask.target_hours) || 0;
                            let subRate = parseFloat(subTask.production_rate);
                            if (!subRate || subRate <= 0) {
                                subRate = subHours > 0 ? subAmount / subHours : 0;
                                if (subRate > 0) {
                                    console.warn(`⚠️ SubTask ${subTask.task_id} missing production_rate, calculated: ${subRate.toFixed(2)}`);
                                } else {
                                    console.warn(`⚠️ SubTask ${subTask.task_id} has no rate data, skipping`);
                                    continue;
                                }
                            }
                            const subTaskHours = subHours > 0 ? subHours : (subAmount / subRate);

                            // Determine how much to pull
                            const pullHours = Math.min(subTaskHours, timeToFill);
                            const pullAmount = Math.floor(pullHours * subRate);

                            if (pullAmount <= 0) continue;

                            const subProdName = getProd(subTask.target_description);

                            // 1. Create in Next Shift
                            const { error: insertError } = await supabase.from('tasks').insert({
                                date: nextShiftDateStr,
                                shift: nextShiftName,
                                target_amount: pullAmount,
                                target_unit: subTask.target_unit,
                                target_hours: pullHours,
                                target_description: `${subProdName} ${pullAmount} ${subTask.target_unit} [Pulled]`,
                                production_rate: subRate,
                                priority: subTask.priority,
                                is_rollover: true // Track it
                            });

                            if (insertError) {
                                console.error('Failed to pull task:', insertError);
                                continue;
                            }
                            console.log(`      ← Pulled ${pullAmount} units (${pullHours.toFixed(2)} hrs) from ${subShiftName}`);

                            // 2. Reduce/Delete in Subsequent Shift
                            if (pullHours >= subTaskHours - 0.1) {
                                await supabase.from('tasks').delete().eq(taskIdField, getTaskId(subTask));
                                console.log(`      ✖ Deleted original task in ${subShiftName}`);
                            } else {
                                await supabase.from('tasks').update({
                                    target_amount: subTask.target_amount - pullAmount,
                                    target_hours: subTaskHours - pullHours,
                                    target_description: `${subProdName} ${subTask.target_amount - pullAmount} ${subTask.target_unit}`,
                                    adjustment_source: 'pulled_forward'
                                }).eq(taskIdField, getTaskId(subTask));
                                console.log(`      ↓ Reduced original task in ${subShiftName}`);
                            }

                            timeToFill -= pullHours;
                        }
                    } else {
                        console.log(`      ℹ️ No tasks found in ${subShiftName} to pull.`);
                    }
                } else {
                    console.log(`   ✅ Next Shift capacity OK (${currentLoad.toFixed(2)} hrs).`);
                }
            }

            // Log the balancing event
            await logRolloverEvent({
                taskId: getTaskId(currentTask),
                description: currentTask.target_description,
                achievement,
                targetAmount,
                difference: diff,
                actionType: 'balancing',
                nextShift: nextShiftName,
                nextDate: nextShiftDateStr,
                timeAffected: timeSaved,
                details: `Over-achieved by ${extraAmount} units, freed ${timeSaved.toFixed(2)} hours`
            });
        }

        console.log(`✅ Handover completed successfully (${operations.length} operations)`);
        console.log('='.repeat(60));
        console.log(`Summary:
   • Task ID: ${taskId}
   • Achievement: ${achievement}
   • Operations: ${operations.length}
   • Rollover: ${diff < 0 ? 'YES (Under-achievement)' : diff > 0 ? 'YES (Over-achievement)' : 'NO'}
   • Next Shift: ${nextShiftName} on ${nextShiftDateStr}
        `);
        console.log('='.repeat(60) + '\n');

    } catch (err) {
        console.error('❌ Error in Shift Handover:', err);
        console.error(`   Operations performed before error: ${operations.length}`);
        console.error('='.repeat(60) + '\n');
    }

};


/**
 * Execute rollover decisions made by the AI (with Cascade support)
 */
const executeAIRolloverDecisions = async (decisions, context, cascadeChain = []) => {
    const results = [];
    const cascadeQueue = [];

    const { nextShiftName, nextShiftDate, tasks } = context; 


    for (const decision of decisions) {
        try {

            if (decision.action === 'none') {
                results.push({ taskId: decision.taskId, status: 'skipped', reason: decision.reason });
                continue;
            }

            if (decision.action === 'rollover') {
                const isSameProductSwap = decision.deductFromNextShift &&
                    decision.deductFromNextShift.productName === decision.productName;

                // Get Next Shift Data
                const { data: nextShiftTasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('date', nextShiftDate)
                    .eq('shift', nextShiftName);

                const existingTask = (nextShiftTasks || []).find(t =>
                    productsMatch(t.target_description, decision.productName)
                );
                
                // Determine Reliable Production Rate
                let productRate = 0;
                if (existingTask) {
                    productRate = parseFloat(existingTask.production_rate);
                }
                
                if (!productRate || productRate <= 0) {
                    const sourceTask = tasks.find(t => t.taskId === decision.taskId);
                    productRate = parseFloat(sourceTask?.productionRate);
                    
                    if (!productRate || productRate <= 0) productRate = 100;
                }

                // Recalculate Time Needed
                const realHoursNeeded = decision.amountToTransfer / productRate;
                
                const { getShiftDuration } = require('../aiLogic');
                const SHIFT_CAPACITY = getShiftDuration ? getShiftDuration(nextShiftDate) / 60 : 8;
                
                const currentShiftHours = (nextShiftTasks || []).reduce((sum, t) => sum + (parseFloat(t.target_hours) || 0), 0);
                const availableHours = Math.max(0, SHIFT_CAPACITY - currentShiftHours);

                // Fit & Cascade
                const hoursToAdd = Math.min(realHoursNeeded, availableHours);
                let amountToAdd = Math.round(hoursToAdd * productRate);
                amountToAdd = Math.min(amountToAdd, decision.amountToTransfer);
                
                if (availableHours < 0.25) amountToAdd = 0;

                const overflowAmount = decision.amountToTransfer - amountToAdd;
                const overflowHours = overflowAmount / productRate;

                // Add to Next Shift
                if (amountToAdd > 0) {
                    const cleanProductName = decision.productName.replace(/\[.*?\]|\(.*?\)/g, '').trim();
                    if (existingTask) {
                        const newAmount = parseFloat(existingTask.target_amount) + amountToAdd;
                        const newHours = parseFloat(existingTask.target_hours || 0) + hoursToAdd;
                        
                        await executeWithRetry(() => supabase.from('tasks').update({
                            target_amount: newAmount,
                            target_hours: newHours,
                            target_description: `${cleanProductName} ${newAmount} ${existingTask.target_unit} [Rollover]`,
                            is_rollover: true,
                            priority: 0
                        }).eq('task_id', existingTask.task_id));
                        
                        console.log(`   ✅ Merged ${amountToAdd} units into Shift 2`);
                    } else {
                        const sourceTask = tasks.find(t => t.taskId === decision.taskId);
                        
                        await executeWithRetry(() => supabase.from('tasks').insert({
                            date: nextShiftDate,
                            shift: nextShiftName,
                            target_amount: amountToAdd,
                            target_hours: hoursToAdd,
                            target_unit: sourceTask?.targetUnit || 'كيلو',
                            target_description: `${cleanProductName} ${amountToAdd} ${sourceTask?.targetUnit || 'كيلو'} [Rollover]`,
                            production_rate: productRate,
                            is_rollover: true,
                            priority: 0,
                            original_task_id: decision.taskId
                        }));
                    }
                }

                // Handle Overflow (Cascade)
                if (overflowAmount > 0) {
                    const cleanProductName = decision.productName.replace(/\[.*?\]|\(.*?\)/g, '').trim();
                    const sourceTask = tasks.find(t => t.taskId === decision.taskId);
                    
                    cascadeQueue.push({
                        productName: cleanProductName,
                        amount: overflowAmount,
                        time: overflowHours,
                        rate: productRate,
                        unit: sourceTask?.targetUnit || 'كيلو',
                        fromShift: nextShiftName,
                        fromDate: nextShiftDate,
                        reason: 'capacity_overflow',
                        depth: 0
                    });
                }
                
                results.push({ taskId: decision.taskId, status: 'processed', added: amountToAdd, cascaded: overflowAmount });
            }
            else if (decision.action === 'balance') {
                let flame = decision.amountToTransfer;

                const cleanName = decision.productName.replace(/\[.*?\]|\(.*?\)/g, '').trim();

                // A. Fetch The ENTIRE Future Queue
                const { data: futureTasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .gt('date', context.currentDate)
                    .order('date', { ascending: true })
                    .order('shift', { ascending: true });

                // Filter for matching product
                const targetQueue = (futureTasks || []).filter(t => productsMatch(t.target_description, cleanName));

                // B. Extinguish Loop
                for (const task of targetQueue) {
                    if (flame <= 0) break;

                    if (task.target_amount <= flame) {
                        // Fully Burned -> Delete
                        await executeWithRetry(() => supabase.from('tasks').delete().eq('task_id', task.task_id));
                        console.log(`   ❌ Deleted task in ${task.shift} (${task.target_amount} units)`);
                        flame -= task.target_amount;
                    } else {
                        // Partially Burned -> Reduce
                        const newAmount = task.target_amount - flame;
                        const newHours = newAmount / (task.production_rate || 100);
                        
                        await executeWithRetry(() => supabase.from('tasks').update({
                            target_amount: newAmount,
                            target_hours: newHours,
                            target_description: `${cleanName} ${newAmount} [Reduced]`
                        }).eq('task_id', task.task_id));

                        flame = 0;
                    }
                }
                results.push({ taskId: decision.taskId, status: 'balanced', remainingSurplus: flame });
            }

        } catch (err) {
            console.error(`❌ Error executing decision for task ${decision.taskId}:`, err.message);
            results.push({ taskId: decision.taskId, status: 'error', reason: err.message });
        }
    }

    // This loop handles the overflow from Scenario A
    let loops = 0;
    while (cascadeQueue.length > 0 && loops < 20) {
        const item = cascadeQueue.shift();
        loops++;

        try {
            // Find Next Shift relative to the ITEM's date/shift
            const { nextShiftName, nextShiftDate } = getNextShift(item.fromShift, item.fromDate);
            
            // Check Capacity of THIS new shift
            const { data: checkTasks } = await supabase
                .from('tasks')
                .select('target_hours')
                .eq('date', nextShiftDate.toISOString().split('T')[0])
                .eq('shift', nextShiftName);

            const used = (checkTasks || []).reduce((s, t) => s + t.target_hours, 0);
            const limit = nextShiftName.includes('Friday') ? 12 : 8;
            const free = Math.max(0, limit - used);

            // Fit logic
            const hoursNeeded = item.amount / item.rate;
            const hoursIn = Math.min(hoursNeeded, free);
            const amountIn = Math.floor(hoursIn * item.rate);
            
            // Overflow logic
            const remAmount = item.amount - amountIn;

            if (amountIn > 0) {
                // Insert into this shift
                await executeWithRetry(() => supabase.from('tasks').insert({
                    date: nextShiftDate,
                    shift: nextShiftName,
                    target_amount: amountIn,
                    target_hours: hoursIn,
                    target_description: `${item.productName} ${amountIn} [Cascade]`,
                    production_rate: item.rate,
                    priority: 0,
                    is_rollover: true
                }));
            }

            if (remAmount > 0) {
                // Still have overflow? Push back to queue for the shift AFTER this one
                cascadeQueue.push({
                    ...item,
                    amount: remAmount,
                    fromShift: nextShiftName,
                    fromDate: nextShiftDate
                });
            }

        } catch (err) {
            console.error("Cascade Loop Error:", err);
        }
    }
    
    return { results };
};

module.exports = {
    handleShiftHandover,
    getShiftConfig,
    getNextShift,
    logRolloverEvent,
    executeAIRolloverDecisions,
    NORMAL_SHIFT_ORDER,
    FRIDAY_SHIFT_ORDER
};
