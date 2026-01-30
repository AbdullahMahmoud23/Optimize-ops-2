/**
 * ADVANCED TEST CASES: Pull Forward Logic
 * أمثلة قوية وواقعية لاختبار الـ Pull Forward
 */

// ============================================
// EXAMPLE 1: Pull Forward - نفس المنتج
// ============================================

const Example1_SameProductPullForward = {
    scenario: 'الفني أنتج أكثر من المطلوب بنفس المنتج',
    
    setup: {
        date: '2025-01-21',
        shifts: [
            {
                name: 'First Shift',
                product: 'شيبس',
                target: 2000,
                rate: 250, // كيلو/ساعة
                hours: 8
            },
            {
                name: 'Second Shift',
                product: 'شيبس',
                target: 2000,
                rate: 250,
                hours: 8
            },
            {
                name: 'Third Shift',
                product: 'شيبس',
                target: 1000,
                rate: 250,
                hours: 4
            }
        ]
    },

    execution: {
        achievement: 2500, // +500 كيلو
        freeHours: 2, // 500 / 250
    },

    process: [
        '1️⃣ First Shift Over-Achievement:',
        '   Target: 2000 كيلو',
        '   Achievement: 2500 كيلو',
        '   Extra: 500 كيلو = 2 ساعات',
        '',
        '2️⃣ Reduce from Second Shift (Same Product):',
        '   شيبس 2000 - 500 = 1500 كيلو',
        '   ساعات: 8 - 2 = 6 ساعات',
        '   الفراغ: 2 ساعة',
        '',
        '3️⃣ Pull Forward من Third Shift:',
        '   Third فيها: شيبس 1000 (4 ساعات)',
        '   نسحب: 2 ساعة × 250 = 500 كيلو',
        '',
        '4️⃣ النتيجة النهائية:',
        '   First: ✅ (اكتمل)',
        '   Second: شيبس 1500 + 500 (من Third) = 2000 (8h) ✅',
        '   Third: شيبس 1000 - 500 = 500 (2h) ✅'
    ],

    expectedResult: {
        firstShift: {
            status: 'completed',
            product: 'شيبس',
            finalAmount: 2500
        },
        secondShift: {
            status: 'balanced',
            product: 'شيبس',
            originalTarget: 2000,
            afterReduction: 1500,
            afterPullForward: 2000, // ممتلئ بالكامل
            hours: 8
        },
        thirdShift: {
            status: 'reduced',
            product: 'شيبس',
            originalTarget: 1000,
            afterPullForward: 500,
            hours: 2
        }
    },

    expectedLogs: [
        '📈 Over-achievement: 500 units (2.00 hrs) saved for Second Shift',
        '   ✨ Reverse Rollover: Reduced Second Shift task by 500 units',
        '   💡 Second Shift has 2.00 hrs spare. Attempting Pull Forward...',
        '      ← Pulled 500 units (2.00 hrs) from Third Shift',
        '         ↓ Reduced to 500 units (2.00 hrs)',
        '   ✅ Pulled 2.00 hrs to fill Next Shift'
    ]
};

// ============================================
// EXAMPLE 2: Pull Forward - منتجات مختلفة
// ============================================

const Example2_DifferentProductsPullForward = {
    scenario: 'Pull Forward مع منتجات مختلفة ومعدلات إنتاج مختلفة',

    setup: {
        date: '2025-01-21',
        shifts: [
            {
                name: 'First Shift',
                product: 'شيبس',
                target: 2000,
                rate: 250,
                hours: 8
            },
            {
                name: 'Second Shift',
                product: 'بسكويت',
                target: 1600, // معدل مختلف
                rate: 200,
                hours: 8
            },
            {
                name: 'Third Shift',
                product: 'كورن فليكس',
                target: 900,
                rate: 300, // معدل أسرع
                hours: 3
            }
        ]
    },

    execution: {
        firstShiftAchievement: 2500, // +500 شيبس
        freeHours: 2, // 500 / 250
    },

    process: [
        '1️⃣ First Shift (شيبس) Over-Achievement:',
        '   Target: 2000, Achievement: 2500',
        '   Extra: 500 كيلو = 2 ساعات فاضية',
        '',
        '2️⃣ تقليل من Second Shift (بسكويت - معدل مختلف):',
        '   بسكويت 1600 - 500 = 1100 كيلو',
        '   (ملاحظة: ناقصنا 500 كيلو من منتج مختلف)',
        '   الساعات المحررة: 500 / 200 = 2.5 ساعات',
        '',
        '3️⃣ Second Shift الآن:',
        '   بسكويت 1100 كيلو = 5.5 ساعات',
        '   الفراغ: 8 - 5.5 = 2.5 ساعات',
        '',
        '4️⃣ Pull Forward من Third Shift (كورن فليكس):',
        '   معدل الإنتاج: 300 كيلو/ساعة (مختلف!)',
        '   نسحب: 2.5 ساعة × 300 = 750 كيلو',
        '',
        '5️⃣ النتيجة النهائية:',
        '   First: ✅ شيبس 2500',
        '   Second: بسكويت 1100 + كورن 750 (Mixed!) = 8h ✅',
        '   Third: كورن 900 - 750 = 150 (0.5h) ✅'
    ],

    expectedResult: {
        firstShift: {
            product: 'شيبس',
            finalAmount: 2500,
            hours: 10 // فنيش بدري
        },
        secondShift: {
            originalProduct: 'بسكويت',
            originalTarget: 1600,
            afterReduction: 1100,
            pulledProduct: 'كورن فليكس',
            pulledAmount: 750,
            mixedProducts: true,
            totalHours: 8,
            status: 'FULL'
        },
        thirdShift: {
            product: 'كورن فليكس',
            originalTarget: 900,
            afterPullForward: 150,
            hours: 0.5
        }
    },

    expectedLogs: [
        '📈 Over-achievement: 500 units (2.00 hrs) saved',
        '📉 Deducting 500 units from بسكويت (2.50 hrs)',
        '💡 Second Shift has 2.50 hrs spare. Attempting Pull Forward...',
        '   ← Pulled 750 units (2.50 hrs) from Third Shift',
        '   ✅ Pulled 2.50 hrs to fill Next Shift',
        '📊 Mixed products in Second Shift:',
        '   - بسكويت: 1100 كيلو',
        '   - كورن فليكس: 750 كيلو (Pulled)'
    ]
};

// ============================================
// EXAMPLE 3: Pull Forward + Cascade معاً
// ============================================

const Example3_PullForwardWithCascade = {
    scenario: 'Pull Forward يسبب Cascade في الـ Shift التالي',

    setup: {
        date: '2025-01-21',
        shifts: [
            {
                name: 'First Shift',
                product: 'شيبس',
                target: 2000,
                rate: 250,
                hours: 8
            },
            {
                name: 'Second Shift',
                product: 'بسكويت',
                target: 1600,
                rate: 200,
                hours: 8,
                isFull: true // ممتلئ بالكامل
            },
            {
                name: 'Third Shift',
                product: 'كورن فليكس',
                target: 900,
                rate: 300,
                hours: 3,
                isFull: true // ممتلئ أيضاً
            },
            {
                name: 'Next Day - First Shift',
                product: 'تين',
                target: 800,
                rate: 200,
                hours: 4
            }
        ]
    },

    execution: {
        firstShiftAchievement: 2500, // +500
    },

    process: [
        '1️⃣ First Shift Over-Achievement:',
        '   Achievement: 2500 (Target: 2000)',
        '   Extra: 500 كيلو = 2 ساعات',
        '',
        '2️⃣ حاولنا تقليل من Second Shift:',
        '   لكن Second ممتلئ (8/8 ساعات)',
        '   نحتاج نفرغ 2 ساعة',
        '',
        '3️⃣ Cascade (تفريغ المكان):',
        '   نخفف من أقل أولوية في Second',
        '   ننقل المخفف للـ Third',
        '   Third ممتلئ أيضاً → يحصل Cascade لـ Next Day',
        '',
        '4️⃣ النتيجة (الشلال):',
        '   First: ✅ 2500 (Completed)',
        '   Second: (After deduction + pullforward)',
        '   Third: (After cascade)',
        '   Next Day First: (استقبال الـ cascade)',
    ],

    expectedResult: {
        firstShift: {
            status: 'over_achieved',
            finalAmount: 2500
        },
        secondShift: {
            status: 'adjusted',
            cascadeOccurred: true,
            message: 'فيه تسلسل من العمليات'
        },
        thirdShift: {
            status: 'cascaded',
            cascadeOccurred: true
        },
        nextDayFirstShift: {
            status: 'received_cascaded_work',
            cascadedFrom: 'Today Third Shift'
        }
    },

    note: 'هذا السيناريو الأخطر - تسلسل طويل من الـ cascades',
    expectedLogs: [
        '⚠️ Need to free 2.00 hrs. Deducting from next shift tasks...',
        '🔻 Deducting ... from Second Shift',
        '🔗 Cascaded to Third Shift',
        '⚠️ Need to free ... from Third Shift (already full)',
        '🔻 Deducting ... from Third Shift',
        '🔗 Cascaded to [Next Day] First Shift'
    ]
};

// ============================================
// EXAMPLE 4: Pull Forward - حالة حدية (Edge Case)
// ============================================

const Example4_EdgeCasePullForward = {
    scenario: 'Pull Forward مع فراغ صغير جداً',

    setup: {
        secondShift: {
            capacity: 8,
            used: 7.9, // فراغ: 0.1 ساعة فقط = 6 دقائق
            product: 'شيبس'
        },
        thirdShift: {
            capacity: 8,
            used: 3,
            product: 'كورن',
            rate: 300
        }
    },

    execution: {
        firstShiftExtra: 300, // 300 / 150 = 2 ساعات
        afterReduction: 1.9, // بعد التقليل
        availableInSecond: 6.1 // بالدقائق
    },

    process: [
        '1️⃣ First Shift Over-Achievement: 300 كيلو = 2 ساعات',
        '',
        '2️⃣ Second Shift بعد التقليل:',
        '   المستخدم: 7.9 ساعات',
        '   الفراغ: 0.1 ساعة فقط (6 دقائق) ❌',
        '   قليل جداً للـ Pull Forward',
        '',
        '3️⃣ القرار:',
        '   ✅ ما نسحب (الفراغ قليل)',
        '   ✅ نترك Second بدون Pull Forward',
        '   ✅ نترك الفراغ الصغير كـ maintenance/buffer'
    ],

    expectedResult: {
        secondShift: {
            status: 'nearly_full',
            used: 7.9,
            available: 0.1,
            pullForwardAttempted: false,
            reason: 'فراغ أقل من 0.5 ساعة (عتبة الـ tolerance)'
        }
    },

    expectedLogs: [
        '📊 Next Shift capacity: 7.90/8 hrs used, 0.10 hrs available',
        '   ℹ️ Next Shift has 0.10 hrs spare (less than 0.5h threshold)',
        '   → Not enough space for Pull Forward'
    ]
};

// ============================================
// EXAMPLE 5: Pull Forward - No Available Tasks
// ============================================

const Example5_NoPullableTasksAvailable = {
    scenario: 'محاولة Pull Forward لكن الـ Shift التالي فارغ',

    setup: {
        secondShift: {
            current: {
                capacity: 8,
                used: 6,
                available: 2
            }
        },
        thirdShift: {
            current: {
                capacity: 8,
                used: 0, // فارغ بالكامل
                tasks: []
            }
        }
    },

    execution: {
        firstShiftExtra: 400, // 400 / 150 = 2.67 ساعات
    },

    process: [
        '1️⃣ First Shift: +400 كيلو (2.67 ساعات)',
        '',
        '2️⃣ Second Shift:',
        '   المستخدم: 6 ساعات',
        '   الفراغ: 2 ساعة',
        '',
        '3️⃣ حاولنا Pull Forward من Third:',
        '   لكن Third فارغ بالكامل',
        '   ما فيه مهام للسحب',
        '',
        '4️⃣ القرار:',
        '   ✅ نترك Second كما هو',
        '   ✅ Second 6 + 2 فراغ',
        '   → لا يتم Pull Forward'
    ],

    expectedResult: {
        secondShift: {
            status: 'partially_used',
            used: 6,
            available: 2,
            pullForwardAttempted: true,
            pullForwardSucceeded: false,
            reason: 'No tasks in Third Shift'
        },
        thirdShift: {
            status: 'empty',
            used: 0
        }
    },

    expectedLogs: [
        '💡 Second Shift has 2.00 hrs spare. Attempting Pull Forward...',
        '   ℹ️ No tasks in Third Shift to pull',
        '   → Pull Forward not possible'
    ]
};

// ============================================
// EXAMPLE 6: Complex Real-World Scenario
// ============================================

const Example6_ComplexRealWorld = {
    scenario: 'سيناريو واقعي معقد - يوم عمل كامل مع تعقيدات',

    date: '2025-01-22',
    shifts: [
        {
            name: 'First Shift',
            product: 'شيبس',
            target: 2000,
            rate: 250,
            achievement: 2600 // +600
        },
        {
            name: 'Second Shift',
            product: 'بسكويت',
            target: 1600,
            rate: 200,
            tasks: [
                { product: 'بسكويت', amount: 1600, rate: 200, priority: 10 },
                { product: 'شيبس', amount: 300, rate: 250, priority: 50 } // أولوية أقل
            ],
            totalHours: 8
        },
        {
            name: 'Third Shift',
            product: 'كورن',
            target: 900,
            rate: 300,
            totalHours: 3
        }
    ],

    fullExecution: [
        '📊 === SHIFT HANDOVER - COMPLEX SCENARIO ===',
        '',
        '🔄 FIRST SHIFT PROCESSING:',
        '   ├─ Product: شيبس',
        '   ├─ Target: 2000 كيلو',
        '   ├─ Achievement: 2600 كيلو ✅',
        '   ├─ Extra: 600 كيلو',
        '   └─ Extra Hours: 2.4 ساعات (600 / 250)',
        '',
        '🎯 STRATEGY:',
        '   1. تقليل من Same Product في Second',
        '   2. سحب من Third إذا في فراغ',
        '   3. معالجة Cascade إذا لزم الأمر',
        '',
        '⚙️ SECOND SHIFT ADJUSTMENT:',
        '   ├─ Original: بسكويت 1600 (8h)',
        '   ├─ Reduce: شيبس 300 (Priority: 50) ← DELETE',
        '   ├─ Reduce: بسكويت 600 (Priority: 10) ← 1000 instead',
        '   ├─ New state: بسكويت 1000 (5h) + vacancy 3h',
        '   └─ ✅ Ready for Pull Forward',
        '',
        '📥 PULL FORWARD FROM THIRD:',
        '   ├─ Available in Second: 3 ساعات',
        '   ├─ Pull from Third: كورن 900 × (2.4 / 3) = 720',
        '   ├─ Pull Hours: 2.4 (كورن معدل: 300)',
        '   ├─ Third after pull: 900 - 720 = 180 (0.6h)',
        '   └─ Second now: بسكويت 1000 + كورن 720 = 8h ✅',
        '',
        '📋 FINAL STATE:',
        '   First Shift:',
        '      └─ شيبس: 2600 (مكتمل)',
        '   ',
        '   Second Shift:',
        '      ├─ بسكويت: 1000 كيلو (5.0 ساعات)',
        '      ├─ كورن: 720 كيلو (2.4 ساعات) [PULLED]',
        '      ├─ شيبس: 300 (ملغى - كان أولوية منخفضة)',
        '      └─ إجمالي: 8.0 ساعات ✅',
        '   ',
        '   Third Shift:',
        '      ├─ كورن: 180 كيلو (0.6 ساعات)',
        '      └─ الفني يخلص بسرعة وقت للصيانة/تجهيز',
        '',
        '✅ === HANDOVER COMPLETED ==='
    ],

    expectedLogs: [
        '📈 Over-achievement: 600 units (2.40 hrs) saved',
        '📉 Deducting 600 units from بسكويت',
        '💡 Second Shift has 2.40 hrs spare. Attempting Pull Forward...',
        '   ← Pulled 720 units (2.40 hrs) from Third Shift',
        '   ↓ Reduced from 900 to 180 units',
        '✅ Pulled 2.40 hrs to fill Next Shift',
        '✅ Handover completed successfully (operations)'
    ]
};

module.exports = {
    Example1_SameProductPullForward,
    Example2_DifferentProductsPullForward,
    Example3_PullForwardWithCascade,
    Example4_EdgeCasePullForward,
    Example5_NoPullableTasksAvailable,
    Example6_ComplexRealWorld
};
