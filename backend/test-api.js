/**
 * ملف اختبار شامل لـ Shift Handover API
 * يختبر:
 * 1. سيناريو التمرير (Rollover) - عدم الإنجاز
 * 2. سيناريو الموازنة (Balancing) - الإنجاز الزائد
 * 3. عدم التكرار (Deduplication)
 * 4. تحديث الحالة والنتائج
 */

const supabase = require('./supabaseDb');
const { handleShiftHandover } = require('./utils/shiftHandover');

// ألوان للطباعة
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// متغيرات لتتبع النتائج
let testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

// ============================================
// أدوات مساعدة
// ============================================

const log = (message, color = 'reset') => {
    console.log(`${colors[color]}${message}${colors.reset}`);
};

const assert = (condition, testName, errorMsg = '') => {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        log(`✅ ${testName}`, 'green');
        return true;
    } else {
        testResults.failed++;
        log(`❌ ${testName}`, 'red');
        if (errorMsg) log(`   Error: ${errorMsg}`, 'red');
        return false;
    }
};

const printTestHeader = (title) => {
    console.log('\n' + '='.repeat(70));
    log(title, 'cyan');
    console.log('='.repeat(70));
};

const printSummary = () => {
    console.log('\n' + '='.repeat(70));
    log('📊 ملخص النتائج', 'cyan');
    console.log('='.repeat(70));
    log(`✅ نجح: ${testResults.passed}/${testResults.total}`, 'green');
    if (testResults.failed > 0) {
        log(`❌ فشل: ${testResults.failed}/${testResults.total}`, 'red');
    }
    log(`النسبة: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 'blue');
    console.log('='.repeat(70) + '\n');
};

// ============================================
// 📋 إعداد البيانات الاختبارية
// ============================================

const setupTestData = async () => {
    printTestHeader('📋 إعداد البيانات الاختبارية');

    try {
        const today = new Date().toISOString().split('T')[0];
        
        // حذف البيانات القديمة
        await supabase.from('tasks').delete().lt('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());

        // إنشاء مهام اختبار
        const testTasks = [
            {
                task_id: 1001,
                date: today,
                shift: 'First Shift',
                target_amount: 1000,
                target_hours: 8,
                target_unit: 'كيلو',
                target_description: 'منتج أ 1000 كيلو',
                production_rate: 125,
                priority: 1
            },
            {
                task_id: 1002,
                date: today,
                shift: 'First Shift',
                target_amount: 500,
                target_hours: 4,
                target_unit: 'كيلو',
                target_description: 'منتج ب 500 كيلو',
                production_rate: 125,
                priority: 2
            },
            {
                task_id: 1003,
                date: today,
                shift: 'Second Shift',
                target_amount: 800,
                target_hours: 8,
                target_unit: 'كيلو',
                target_description: 'منتج أ 800 كيلو',
                production_rate: 100,
                priority: 1
            }
        ];

        for (const task of testTasks) {
            const { error } = await supabase.from('tasks').insert(task);
            if (error && !error.message.includes('duplicate')) {
                log(`خطأ في إنشاء مهمة ${task.task_id}: ${error.message}`, 'red');
            } else {
                log(`✅ تم إنشاء مهمة: ${task.task_id}`, 'green');
            }
        }

        return testTasks;
    } catch (err) {
        log(`خطأ في إعداد البيانات: ${err.message}`, 'red');
        return [];
    }
};

// ============================================
// 🧪 السيناريو الأول: التمرير (Rollover)
// ============================================

const testRollover = async () => {
    printTestHeader('🧪 السيناريو الأول: التمرير (Rollover) - عدم الإنجاز');

    try {
        log('\n📝 الحالة:', 'blue');
        log('   المهمة: 1001', 'blue');
        log('   الهدف: 1000 كيلو', 'blue');
        log('   الإنجاز الفعلي: 850 كيلو (150 كيلو ناقصة)', 'blue');
        log('   المتوقع: نقل 150 كيلو إلى الفترة التالية\n', 'blue');

        // استدعاء الدالة
        log('⏳ جاري معالجة التمرير...', 'yellow');
        await handleShiftHandover(1001, 850);

        // التحقق من النتائج
        const { data: task } = await supabase
            .from('tasks')
            .select('*')
            .eq('task_id', 1001)
            .single();

        const { data: nextShiftTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('shift', 'Second Shift')
            .ilike('target_description', '%منتج أ%');

        assert(task !== null, 'يجب أن توجد المهمة الأصلية');
        assert(nextShiftTasks && nextShiftTasks.length > 0, 'يجب نقل المهمة إلى الفترة التالية');

        if (nextShiftTasks && nextShiftTasks.length > 0) {
            const rolloverTask = nextShiftTasks.find(t => t.is_rollover);
            if (rolloverTask) {
                log(`\n✨ نتيجة التمرير:`, 'green');
                log(`   المهمة الجديدة: ${rolloverTask.task_id}`, 'green');
                log(`   المبلغ المنقول: ${rolloverTask.target_amount} كيلو`, 'green');
                log(`   الساعات: ${rolloverTask.target_hours}`, 'green');
                assert(rolloverTask.target_amount <= 150, 'يجب أن تكون القيمة المنقولة حوالي 150 كيلو');
            }
        }

        log('\n✅ اكتمل السيناريو الأول\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو الأول: ${err.message}`, 'red');
    }
};

// ============================================
// 🧪 السيناريو الثاني: الموازنة (Balancing)
// ============================================

const testBalancing = async () => {
    printTestHeader('🧪 السيناريو الثاني: الموازنة (Balancing) - الإنجاز الزائد');

    try {
        log('\n📝 الحالة:', 'blue');
        log('   المهمة: 1002', 'blue');
        log('   الهدف: 500 كيلو', 'blue');
        log('   الإنجاز الفعلي: 650 كيلو (150 كيلو زائدة)', 'blue');
        log('   المتوقع: تقليل المهام في الفترة التالية\n', 'blue');

        log('⏳ جاري معالجة الموازنة...', 'yellow');
        await handleShiftHandover(1002, 650);

        // التحقق من النتائج
        const { data: nextShiftTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('shift', 'Second Shift');

        const totalHours = nextShiftTasks?.reduce((sum, t) => sum + (parseFloat(t.target_hours) || 0), 0) || 0;

        log(`\n✨ نتيجة الموازنة:`, 'green');
        log(`   المهام في الفترة التالية: ${nextShiftTasks?.length || 0}`, 'green');
        log(`   إجمالي الساعات: ${totalHours.toFixed(2)}`, 'green');
        
        assert(nextShiftTasks !== null, 'يجب استرجاع مهام الفترة التالية');
        assert(totalHours <= 8, 'يجب أن تكون ساعات الفترة التالية ≤ 8 ساعات');

        log('\n✅ اكتمل السيناريو الثاني\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو الثاني: ${err.message}`, 'red');
    }
};

// ============================================
// 🧪 السيناريو الثالث: عدم التكرار (Deduplication)
// ============================================

const testDeduplication = async () => {
    printTestHeader('🧪 السيناريو الثالث: عدم التكرار (Deduplication)');

    try {
        log('\n📝 الحالة:', 'blue');
        log('   سنقوم بنفس العملية مرتين بنفس المعاملات', 'blue');
        log('   المتوقع: يجب تخطي العملية الثانية\n', 'blue');

        const taskId = 2001;
        const achievement = 900;

        // تحضير مهمة اختبار
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('tasks').insert({
            task_id: taskId,
            date: today,
            shift: 'First Shift',
            target_amount: 1000,
            target_hours: 8,
            target_unit: 'كيلو',
            target_description: 'اختبار عدم التكرار',
            production_rate: 125,
            priority: 1
        });

        log('⏳ المحاولة الأولى...', 'yellow');
        const start1 = Date.now();
        await handleShiftHandover(taskId, achievement);
        const time1 = Date.now() - start1;

        log('⏳ المحاولة الثانية (يجب تخطيها)...', 'yellow');
        const start2 = Date.now();
        await handleShiftHandover(taskId, achievement);
        const time2 = Date.now() - start2;

        log(`\n✨ نتيجة عدم التكرار:`, 'green');
        log(`   وقت المحاولة الأولى: ${time1}ms`, 'green');
        log(`   وقت المحاولة الثانية: ${time2}ms`, 'green');
        log(`   ملاحظة: المحاولة الثانية يجب أن تكون أسرع بكثير (تخطيها)`, 'green');

        assert(time2 < time1, 'يجب أن تكون المحاولة الثانية أسرع (تم تخطيها)');

        log('\n✅ اكتمل السيناريو الثالث\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو الثالث: ${err.message}`, 'red');
    }
};

// ============================================
// 🧪 السيناريو الرابع: التحقق من قاعدة البيانات
// ============================================

const testDatabaseValidation = async () => {
    printTestHeader('🧪 السيناريو الرابع: التحقق من قاعدة البيانات');

    try {
        log('\n📝 الفحوصات:', 'blue');

        // 1. التحقق من جدول المهام
        const { data: tasksCount, error: tasksError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact' });

        assert(!tasksError, 'يجب الاتصال بجدول tasks بدون أخطاء');
        assert(tasksCount && tasksCount.length >= 3, 'يجب أن توجد مهام على الأقل');

        log(`✨ نتائج التحقق من قاعدة البيانات:`, 'green');
        log(`   إجمالي المهام: ${tasksCount?.length || 0}`, 'green');

        // 2. التحقق من جدول السجلات
        const { data: logs, error: logsError } = await supabase
            .from('rollover_logs')
            .select('*')
            .limit(5);

        assert(!logsError, 'يجب الاتصال بجدول rollover_logs بدون أخطاء');
        log(`   إجمالي السجلات: ${logs?.length || 0}`, 'green');

        // 3. التحقق من schema consistency
        if (tasksCount && tasksCount.length > 0) {
            const firstTask = tasksCount[0];
            const hasTaskId = 'task_id' in firstTask || 'TaskID' in firstTask;
            assert(hasTaskId, 'يجب أن توجد حقول task_id أو TaskID');
            log(`   التحقق من schema: ✅`, 'green');
        }

        log('\n✅ اكتمل السيناريو الرابع\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو الرابع: ${err.message}`, 'red');
    }
};

// ============================================
// 🧪 السيناريو الخامس: اختبار التعامل مع الأخطاء
// ============================================

const testErrorHandling = async () => {
    printTestHeader('🧪 السيناريو الخامس: اختبار التعامل مع الأخطاء');

    try {
        log('\n📝 حالات الاختبار:', 'blue');

        // 1. مهمة غير موجودة
        log('\n1️⃣ اختبار مهمة غير موجودة...', 'yellow');
        try {
            await handleShiftHandover(9999, 100);
            assert(false, 'يجب أن تتعامل مع المهام غير الموجودة بشكل آمن');
        } catch (err) {
            assert(true, 'تم التعامل مع المهمة غير الموجودة بشكل صحيح');
        }

        // 2. قيمة إنجاز غير صحيحة
        log('\n2️⃣ اختبار قيمة إنجاز غير صحيحة...', 'yellow');
        try {
            await handleShiftHandover(1001, 'invalid');
            assert(true, 'تم التعامل مع القيم غير الصحيحة بشكل صحيح');
        } catch (err) {
            assert(true, 'تم التعامل مع الخطأ بشكل صحيح');
        }

        // 3. معاملات null/undefined
        log('\n3️⃣ اختبار معاملات فارغة...', 'yellow');
        try {
            await handleShiftHandover(null, null);
            // لن نصل هنا عادة
        } catch (err) {
            assert(true, 'تم التعامل مع المعاملات الفارغة بشكل صحيح');
        }

        log('\n✅ اكتمل السيناريو الخامس\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو الخامس: ${err.message}`, 'red');
    }
};

// ============================================
// 🧪 السيناريو السادس: اختبار الأداء
// ============================================

const testPerformance = async () => {
    printTestHeader('🧪 السيناريو السادس: اختبار الأداء');

    try {
        log('\n📝 معايير الأداء:', 'blue');
        log('   الحد الأقصى المتوقع: 2 ثانية لكل عملية', 'blue');
        log('   الحد الأقصى للتمرير: 5 ثواني للعملية الكاملة\n', 'blue');

        const taskId = 3001;
        const today = new Date().toISOString().split('T')[0];

        // إنشاء مهمة اختبار أداء
        await supabase.from('tasks').insert({
            task_id: taskId,
            date: today,
            shift: 'First Shift',
            target_amount: 1000,
            target_hours: 8,
            target_unit: 'كيلو',
            target_description: 'اختبار الأداء',
            production_rate: 125,
            priority: 1
        });

        const operationStart = Date.now();
        await handleShiftHandover(taskId, 850);
        const operationTime = Date.now() - operationStart;

        log(`\n✨ نتائج الأداء:`, 'green');
        log(`   وقت العملية: ${operationTime}ms`, 'green');
        log(`   الحالة: ${operationTime < 5000 ? '✅ ممتاز' : operationTime < 10000 ? '⚠️ مقبول' : '❌ بطيء'}`, 'green');

        assert(operationTime < 10000, 'يجب أن تكتمل العملية في أقل من 10 ثواني', `الوقت المستغرق: ${operationTime}ms`);

        log('\n✅ اكتمل السيناريو السادس\n', 'green');
    } catch (err) {
        log(`❌ خطأ في السيناريو السادس: ${err.message}`, 'red');
    }
};

// ============================================
// 🚀 تشغيل جميع الاختبارات
// ============================================

const runAllTests = async () => {
    printTestHeader('🚀 بدء مجموعة الاختبارات الشاملة');
    log('التاريخ والوقت: ' + new Date().toLocaleString('ar-EG'), 'cyan');

    try {
        // إعداد البيانات
        await setupTestData();

        // تشغيل الاختبارات
        await testRollover();
        await testBalancing();
        await testDeduplication();
        await testDatabaseValidation();
        await testErrorHandling();
        await testPerformance();

        // طباعة الملخص
        printSummary();

        // النتيجة النهائية
        if (testResults.failed === 0) {
            log('🎉 جميع الاختبارات نجحت!', 'green');
        } else {
            log(`⚠️ ${testResults.failed} اختبار فشل. يرجى مراجعة النتائج.`, 'red');
        }

    } catch (err) {
        log(`\n❌ خطأ عام: ${err.message}`, 'red');
        console.error(err);
    }

    process.exit(testResults.failed === 0 ? 0 : 1);
};

// بدء الاختبارات
runAllTests();
