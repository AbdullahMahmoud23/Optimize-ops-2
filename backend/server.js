/* eslint-disable no-undef */
require('dotenv').config();

// ========== SUPABASE MIGRATION - Dec 26, 2025 ==========
console.log('🚀 Server starting with Supabase...');
const express = require("express");
const cors = require('cors');
const path = require('node:path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const supabase = require("./supabaseDb");

// Import Routes
const authRoutes = require("./routes/auth");
const recordingRoutes = require("./routes/recordings");
const technicianRoutes = require("./routes/technician");

const { extractJobOrderData } = require("./aiLogic");

const app = express();

// Handle preflight requests FIRST before any other middleware
app.options(/.*/, (req, res) => {
  const origin = req.get('origin');
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  res.sendStatus(200);
});

// CORS configuration - explicitly set all allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://optimize-ops-eight.vercel.app',
  'https://optimize-ops-production.up.railway.app',
  'https://l6hdrvcs-5173.uks1.devtunnels.ms',
  'https://l6hdrvcs-3001.uks1.devtunnels.ms',
  'https://optimize-ops-production-a65c.up.railway.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('📨 CORS Check for origin:', origin);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ No origin provided - allowing request');
      return callback(null, true);
    }

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      const originMatch = origin === allowed ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('vercel.app') ||
        origin.includes('railway.app');
      return originMatch;
    });

    if (isAllowed) {
      console.log('✅ CORS allowed for origin:', origin);
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(null, true); // Still allow for now, frontend can handle
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// console.log('✅ Allowed CORS Origins:', allowedOrigins);

// Apply CORS to all routes
app.use(cors(corsOptions));

// Additional explicit CORS headers middleware
app.use((req, res, next) => {
  const origin = req.get('origin');
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'supabase', origins: allowedOrigins });
});
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount route modules
app.use("/api/auth", authRoutes);
app.use("/api/recordings", recordingRoutes);
app.use("/api/technician", technicianRoutes);

// Import handleShiftHandover from utils (removed duplicate code)
const { handleShiftHandover } = require("./utils/shiftHandover");

// File upload setup
const upload = multer({ dest: 'uploads/' });

// Middleware for JWT verification
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.warn('⚠️  No token provided');
    return res.status(403).json({ error: 'No token provided' });
  }

  // Extract token (handle both "Bearer <token>" and direct token formats)
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    console.warn('⚠️  No token provided');
    return res.status(403).json({ error: 'No token provided' });
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.warn('⚠️  Invalid token:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (!decoded.id) {
      console.warn('⚠️  Token missing id field');
      return res.status(401).json({ error: 'Token missing id field' });
    }
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

// Middleware for admin role verification
const verifyAdmin = (req, res, next) => {
  if (!req.userRole) {
    console.warn('⚠️  User role not set - verifyToken may have failed');
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.userRole !== 'admin') {
    console.warn('⚠️  Unauthorized admin access attempt - user role:', req.userRole);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============================================
// ADMIN ENDPOINTS (Supabase)
// ============================================

// -- Admin: View Rollover/Balancing Logs
app.get('/api/admin/rollover-logs', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, actionType, limit = 50 } = req.query;

    let query = supabase
      .from('rollover_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Filter by date range if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59');
    }
    // Filter by action type (rollover or balancing)
    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json({
      ok: true,
      count: data?.length || 0,
      logs: data || []
    });
  } catch (err) {
    console.error('Error fetching rollover logs:', err);
    return res.status(500).json({ error: 'Error fetching rollover logs' });
  }
});


// Extract Job Order Data

app.post('/api/admin/tasks/extract', verifyToken, verifyAdmin, upload.single('file'), async (req, res) => {
  try {
    // 1. Validation
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log('=== AI VISION EXTRACTION ===');
    console.log('File:', req.file.path);
    console.log('MIME Type:', req.file.mimetype);

    // 2. Call the Central AI Logic (pass MIME type for PDF detection)
    const extractedData = await extractJobOrderData(req.file.path, req.file.mimetype);

    // 3. Cleanup (Delete the temp file)
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e) { console.warn("Cleanup warning:", e.message); }

    // 4. Handle Failure
    if (!extractedData) {
      return res.status(500).json({ error: 'AI failed to analyze the document.' });
    }

    // 5. Success - Map to frontend expected format
    console.log('✓ Extracted data:', extractedData);

    // Map AI response fields to frontend expected fields
    const mappedData = {
      quantity: extractedData.printing_qty_kg || extractedData.quantity || null,
      hours: extractedData.printing_planned_hours || extractedData.hours || null,
      product_name: extractedData.product_name || extractedData.description || 'طباعة',
      unit: extractedData.unit || 'كيلو'
    };

    console.log('✓ Mapped data for frontend:', mappedData);
    return res.json({ ok: true, data: mappedData });

  } catch (err) {
    console.error('Error extracting data:', err);
    // Cleanup if error occurred before deletion
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    return res.status(500).json({ error: 'Server Error', details: err.message });
  }
});

// -- Admin: Assign shift target with intelligent distribution
app.post('/api/admin/tasks', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('=== DEBUG: /api/admin/tasks received ===');
    console.log('req.body:', JSON.stringify(req.body, null, 2));

    const { date, amount, unit, description, shift, hours, order_number } = req.body;

    console.log('Parsed values - date:', date, 'amount:', amount, 'unit:', unit);

    if (!date || !amount || !unit) {
      console.log('VALIDATION FAILED - missing fields');
      return res.status(400).json({ error: 'Missing required fields: date, amount, unit' });
    }

    // 🔧 FIX 6: Require hours for proper production rate calculation
    // Hours are essential for accurate rollover calculations
    if (!hours || hours <= 0) {
      console.warn('⚠️ Hours not provided - production rate will be missing, rollover calculations may fail');
      // Return warning instead of hard error to maintain backwards compatibility
      // But log it clearly for debugging
    }

    console.log('=== ASSIGN TARGET (Intelligent Distribution) ===');
    console.log('Date:', date);
    console.log('Amount:', amount, unit);
    console.log('Description:', description);
    console.log('Hours:', hours || 'Not provided');
    console.log('Shift:', shift || 'Auto-distribute');
    console.log('Order Number:', order_number || 'Not provided');

    // Detect Friday (day 5) - Friday has only 2 shifts (12 hours each)
    const isFriday = new Date(date).getDay() === 5;
    const SHIFT_DURATION = isFriday ? 12 : 8; // 12 hours on Friday, 8 hours on other days
    const shifts = isFriday
      ? ['First Shift', 'Second Shift']
      : ['First Shift', 'Second Shift', 'Third Shift'];

    console.log(`📅 Day: ${isFriday ? 'Friday (2 shifts, 12hrs each)' : 'Regular (3 shifts, 8hrs each)'}`);

    // If specific shift is selected OR no hours provided, use old logic
    if (shift || !hours || hours <= 0) {
      const shiftsToAssign = shift ? [shift] : shifts;
      const targetPerShift = shift ? amount : Math.floor(amount / shifts.length);

      // 🔧 FIX 6: Calculate production_rate even without hours using assumed shift duration
      // This ensures rollover calculations have valid rate data
      const hoursPerShift = hours && hours > 0
        ? (hours / shiftsToAssign.length)
        : SHIFT_DURATION; // Use shift duration as fallback

      const calculatedRate = targetPerShift / hoursPerShift;
      console.log(`📈 Production rate (${hours ? 'calculated' : 'assumed from shift duration'}): ${calculatedRate.toFixed(2)} ${unit}/hr`);

      const insertPromises = shiftsToAssign.map(shiftName =>
        supabase
          .from('tasks')
          .insert({
            date: date,
            shift: shiftName,
            target_amount: targetPerShift,
            target_unit: unit,
            target_hours: hoursPerShift, // 🔧 FIX 5: Always set target_hours
            target_description: description || '',
            production_rate: parseFloat(calculatedRate.toFixed(2)),
            priority: 10,  // 🔧 Normal tasks get priority 10, rollover gets 0 (shows first)
            order_number: order_number || null
          })
          .select()
      );

      const results = await Promise.all(insertPromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(errors[0].error.message);

      const tasks = results.map(r => r.data?.[0]).filter(Boolean);
      console.log('✓ Targets assigned (even distribution):', tasks);

      return res.json({
        ok: true,
        message: `Target assigned to ${shiftsToAssign.length} shift(s)`,
        targets: tasks,
        distribution: tasks.map(t => ({
          shift: t.shift,
          amount: t.target_amount,
          hours: hoursPerShift.toFixed(2),
          production_rate: calculatedRate.toFixed(2)
        })),
        warning: !hours ? 'Hours not provided - using shift duration for production rate calculation' : undefined
      });
    }

    // ========== INTELLIGENT DISTRIBUTION BASED ON HOURS ==========
    console.log('📊 Using intelligent time-based distribution...');

    // Calculate production rate (quantity per hour)
    const productionRate = amount / hours;
    console.log('Production rate:', productionRate.toFixed(2), unit + '/hour');

    // Get existing tasks for this date to calculate remaining capacity
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('shift, target_amount, target_hours')
      .eq('date', date);

    // Calculate used hours per shift from existing tasks (dynamic based on Friday)
    const shiftUsedHours = isFriday
      ? { 'First Shift': 0, 'Second Shift': 0 }
      : { 'First Shift': 0, 'Second Shift': 0, 'Third Shift': 0 };

    // Sum up hours from existing tasks for each shift
    if (existingTasks && existingTasks.length > 0) {
      for (const task of existingTasks) {
        if (task.target_hours && shiftUsedHours.hasOwnProperty(task.shift)) {
          shiftUsedHours[task.shift] += task.target_hours;
        }
      }
      console.log('📊 Existing shift usage:', shiftUsedHours);
    }

    // Distribute the new order across days (overflow to next day if needed)
    let remainingHours = hours;
    let remainingQuantity = amount;
    const distribution = [];
    let currentDate = new Date(date);
    let daysUsed = 0;
    const MAX_DAYS = 7; // Limit overflow to 7 days max

    while (remainingHours > 0 && remainingQuantity > 0 && daysUsed < MAX_DAYS) {
      const dateStr = currentDate.toISOString().slice(0, 10);

      // Get existing capacity for this date if it's beyond the first day
      let dayShiftUsedHours = { ...shiftUsedHours };
      if (daysUsed > 0) {
        // Query existing tasks for overflow days
        const { data: overflowTasks } = await supabase
          .from('tasks')
          .select('shift, target_hours')
          .eq('date', dateStr);

        dayShiftUsedHours = { 'First Shift': 0, 'Second Shift': 0, 'Third Shift': 0 };
        if (overflowTasks) {
          for (const task of overflowTasks) {
            if (task.target_hours && dayShiftUsedHours.hasOwnProperty(task.shift)) {
              dayShiftUsedHours[task.shift] += task.target_hours;
            }
          }
        }
        if (Object.values(dayShiftUsedHours).some(h => h > 0)) {
          console.log(`📊 Day ${dateStr} existing usage:`, dayShiftUsedHours);
        }
      }

      // Try to fill shifts for this day
      for (const shiftName of shifts) {
        if (remainingHours <= 0 || remainingQuantity <= 0) break;

        const availableHours = SHIFT_DURATION - dayShiftUsedHours[shiftName];
        if (availableHours <= 0) continue;

        const hoursToUse = Math.min(remainingHours, availableHours);
        const quantityForThisShift = Math.round(hoursToUse * productionRate);

        if (quantityForThisShift > 0) {
          distribution.push({
            date: dateStr,
            shift: shiftName,
            amount: quantityForThisShift,
            hours: hoursToUse,
            isPartial: hoursToUse < hours,
            isOverflow: daysUsed > 0
          });

          remainingHours -= hoursToUse;
          remainingQuantity -= quantityForThisShift;
        }
      }

      // Move to next day if there are remaining hours
      if (remainingHours > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        daysUsed++;
        if (daysUsed < MAX_DAYS) {
          console.log(`📅 Day ${date} full, overflow to ${currentDate.toISOString().slice(0, 10)}`);
        }
      }
    }

    // Handle any rounding remainder - add to last shift
    if (remainingQuantity > 0 && distribution.length > 0) {
      distribution[distribution.length - 1].amount += remainingQuantity;
    }

    // Warn if still remaining
    if (remainingHours > 0) {
      console.log(`⚠️ Warning: ${remainingHours.toFixed(2)} hours could not be assigned (reached ${MAX_DAYS} day limit)`);
    }

    console.log('📋 Distribution plan:', distribution);

    // Insert tasks for each shift in the distribution
    const insertPromises = distribution.map(d =>
      supabase
        .from('tasks')
        .insert({
          date: d.date,
          shift: d.shift,
          target_amount: d.amount,
          target_unit: unit,
          target_hours: d.hours,
          target_description: d.isOverflow
            ? `${description} (${d.amount} ${unit}) 📅`
            : `${description} (${d.amount} ${unit})`,
          production_rate: parseFloat(productionRate.toFixed(2)),
          priority: 10,  // 🔧 Normal tasks get priority 10, rollover gets 0 (shows first)
          order_number: order_number || null
        })
        .select()
    );

    const results = await Promise.all(insertPromises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw new Error(errors[0].error.message);

    const tasks = results.map(r => r.data?.[0]).filter(Boolean);

    // Calculate utilization
    const totalAssignedHours = distribution.reduce((sum, d) => sum + d.hours, 0);
    const totalCapacity = shifts.length * SHIFT_DURATION; // 24 hours
    const utilizationPercent = ((totalAssignedHours / totalCapacity) * 100).toFixed(1);

    console.log('✓ Targets assigned with intelligent distribution');
    console.log(`  Total hours: ${totalAssignedHours.toFixed(2)} / ${totalCapacity} (${utilizationPercent}% utilization)`);

    return res.json({
      ok: true,
      message: `Target distributed across ${distribution.length} shift(s) based on ${hours} hours`,
      targets: tasks,
      distribution: distribution.map(d => ({
        shift: d.shift,
        amount: d.amount,
        hours: d.hours.toFixed(2),
        utilizationPercent: ((d.hours / SHIFT_DURATION) * 100).toFixed(1)
      })),
      summary: {
        totalQuantity: amount,
        totalHours: hours,
        shiftsUsed: distribution.length,
        utilizationPercent: utilizationPercent
      }
    });
  } catch (err) {
    console.error('Error assigning target:', err);
    return res.status(500).json({
      error: 'Error assigning target',
      details: err.message
    });
  }
});

// -- Technician: Get tasks for a specific date and shift
app.get('/api/technician/tasks', verifyToken, async (req, res) => {
  try {
    const { date, shift } = req.query;

    if (!date || !shift) {
      return res.status(400).json({ error: 'Missing required query parameters: date, shift' });
    }

    console.log('[DEBUG] Fetching tasks for date:', date, 'shift:', shift);

    // Normalize shift name - handle both 'First' and 'First Shift' formats
    const shiftMap = {
      'First': 'First Shift',
      'Second': 'Second Shift',
      'Third': 'Third Shift',
      'First Shift': 'First Shift',
      'Second Shift': 'Second Shift',
      'Third Shift': 'Third Shift'
    };
    const normalizedShift = shiftMap[shift] || shift;
    console.log('[DEBUG] Normalized shift:', normalizedShift);

    const { data, error } = await supabase
      .from('tasks')
      .select('task_id, target_description, priority, is_rollover')
      .eq('date', date)
      .eq('shift', normalizedShift)
      .order('is_rollover', { ascending: false, nullsFirst: false })  // 🔧 Rollover (true) appears first!
      .order('priority', { ascending: true }); // Then by priority

    if (error) throw error;

    // 🔧 FIX: Fetch saved achievements for this operator and these tasks
    const taskIds = (data || []).map(t => t.task_id);
    let achievementMap = new Map();

    if (taskIds.length > 0) {
      const { data: achievements } = await supabase
        .from('targetachievements')
        .select('target_id, achievement')
        .eq('operator_id', req.userId)
        .in('target_id', taskIds);

      (achievements || []).forEach(a => {
        achievementMap.set(a.target_id, a.achievement);
      });
    }

    // Transform to expected format with saved achievement
    const result = (data || []).map(t => ({
      TaskID: t.task_id,
      TargetDescription: t.target_description,
      isRollover: t.is_rollover || false,
      savedAchievement: achievementMap.get(t.task_id) || null  // 🔧 Include saved achievement
    }));

    console.log('[DEBUG] Found', result.length, 'task(s)');
    return res.json(result);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return res.status(500).json({
      error: 'Error fetching tasks',
      details: err.message
    });
  }
});


// -- Admin: Get technician performance data
app.get('/api/admin/technicians/performance', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('[DEBUG] Fetching technician performance data');
    const startTime = Date.now();

    const { getShiftDuration } = require('./aiLogic');

    // Helper function to normalize dates
    const normalizeDate = (date) => {
      if (!date) return null;
      if (date instanceof Date) return date.toISOString().split('T')[0];
      if (typeof date === 'string' && date.includes('T')) return date.split('T')[0];
      return date;
    };

    // ⚡ OPTIMIZATION: Run all 5 queries in parallel instead of sequential
    const [
      { data: operators, error: opError },
      { data: allRecordings, error: recError },
      { data: allEvaluations, error: evalError },
      { data: allTasks, error: taskError },
      { data: allAchievements, error: achError }
    ] = await Promise.all([
      supabase.from('operators').select('operator_id, email, name'),
      supabase.from('recordings').select('operator_id, shift_date, shift, shift_delay_time, shift_deducted_time, effective_working_time, created_at'),
      supabase.from('evaluations').select('recording_id, extra_time, standard_duration'),
      supabase.from('tasks').select('task_id, date, shift, target_amount, target_unit, target_description'),
      supabase.from('targetachievements').select('target_id, operator_id, achievement')
    ]);

    if (opError) throw opError;
    if (taskError) console.error('[DEBUG /performance] Error fetching tasks:', taskError);

    if (!operators || operators.length === 0) {
      console.log('[DEBUG] No operators found');
      return res.json([]);
    }

    // ⚡ OPTIMIZATION: Pre-build achievement lookup Map for O(1) access
    const achievementsByTaskId = new Map();
    for (const ach of (allAchievements || [])) {
      if (!achievementsByTaskId.has(ach.target_id)) {
        achievementsByTaskId.set(ach.target_id, []);
      }
      achievementsByTaskId.get(ach.target_id).push(ach);
    }

    // Build lookup maps
    const recordingsByOperator = new Map();
    for (const rec of (allRecordings || [])) {
      const opId = rec.operator_id;
      if (!recordingsByOperator.has(opId)) {
        recordingsByOperator.set(opId, []);
      }
      recordingsByOperator.get(opId).push(rec);
    }

    // Map tasks by date-shift (with normalized shift names)
    // Normalize shift name for comparison (handle "First" vs "First Shift")
    const normalizeShift = (shift) => {
      if (!shift) return '';
      const s = shift.toLowerCase().trim();
      if (s === 'first' || s === 'first shift') return 'first';
      if (s === 'second' || s === 'second shift') return 'second';
      if (s === 'third' || s === 'third shift') return 'third';
      return s;
    };

    const tasksByDateShift = new Map();
    for (const task of (allTasks || [])) {
      const dateStr = normalizeDate(task.date);
      const normalizedShift = normalizeShift(task.shift);
      const key = `${dateStr}-${normalizedShift}`;
      if (!tasksByDateShift.has(key)) {
        tasksByDateShift.set(key, []);
      }
      // ⚡ OPTIMIZATION: Use Map lookup O(1) instead of filter O(n)
      const taskId = task.TaskID || task.task_id;
      const taskAchievements = achievementsByTaskId.get(taskId) || [];
      tasksByDateShift.get(key).push({
        ...task,
        achievements: taskAchievements
      });
    }

    // Process each operator
    const technicians = [];

    for (const op of operators) {
      const recordings = recordingsByOperator.get(op.operator_id) || [];
      const shiftsMap = new Map();
      const shiftPercentages = [];

      for (const row of recordings) {
        let dateStr = row.shift_date || (row.created_at ? row.created_at.split('T')[0] : null);
        if (!dateStr) continue;

        if (dateStr instanceof Date) {
          dateStr = dateStr.toISOString().split('T')[0];
        } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }

        const normalizedShift = normalizeShift(row.shift);
        const key = `${dateStr}-${normalizedShift}`;
        if (shiftsMap.has(key)) continue;
        shiftsMap.set(key, true);

        // Get target and achievement
        let targetAmount = 0;
        let achievementAmount = 0;

        const tasks = tasksByDateShift.get(key) || [];
        if (tasks.length > 0) {
          let totalTargetAmount = 0;
          let totalAchievementAmount = 0;

          for (const task of tasks) {
            // Use target_amount from column, or fallback to parsing target_description for old tasks
            let taskTarget = parseFloat(task.target_amount);

            if (!taskTarget || isNaN(taskTarget)) {
              // Fallback: extract from target_description for old tasks
              const desc = task.target_description || '';
              const numMatch = desc.match(/([\d.]+)/);
              if (numMatch) {
                taskTarget = parseFloat(numMatch[1]);
              } else {
                taskTarget = 0;
              }
            }

            totalTargetAmount += taskTarget;

            // Get achievement for this operator
            const opAchievement = (task.achievements || []).find(a => a.operator_id === op.operator_id);
            if (opAchievement && opAchievement.achievement) {
              const achStr = String(opAchievement.achievement || '');
              // Extract number from achievement string (e.g., "1158 كيلو" -> 1158)
              const achMatch = achStr.match(/([\d.]+)/);
              if (achMatch) {
                let achAmount = parseFloat(achMatch[1]);

                // Convert units if needed
                const achHasTon = achStr.includes('طن');
                const targetHasTon = (task.target_unit || '').includes('طن');

                if (targetHasTon && !achHasTon) {
                  achAmount = achAmount / 1000; // كيلو to طن
                } else if (!targetHasTon && achHasTon) {
                  achAmount = achAmount * 1000; // طن to كيلو
                }
                totalAchievementAmount += achAmount;
              }
            }
          }

          targetAmount = totalTargetAmount > 0 ? totalTargetAmount : 100;
          achievementAmount = totalAchievementAmount;
        }

        // Calculate achievement percentage with dynamic shift duration
        const shiftDuration = getShiftDuration(dateStr); // Friday = 720, others = 480
        const allowedFaultTime = row.shift_deducted_time || 0;
        const actualWorkingTime = Math.max(0, shiftDuration - allowedFaultTime);
        const workingTimeRatio = actualWorkingTime / shiftDuration;
        const adjustedTarget = targetAmount * workingTimeRatio;

        let achievementPercentage = 0;
        if (adjustedTarget > 0) {
          achievementPercentage = (achievementAmount / adjustedTarget) * 100;
        } else if (achievementAmount > 0) {
          achievementPercentage = 100;
        }

        if (achievementPercentage > 100) achievementPercentage = 100;

        shiftPercentages.push(achievementPercentage);
      }

      // Calculate average
      let avgPercentage = 0;
      if (shiftPercentages.length > 0) {
        avgPercentage = shiftPercentages.reduce((sum, p) => sum + p, 0) / shiftPercentages.length;
      }
      const overallScore = Math.round(avgPercentage);

      const status = overallScore >= 80 ? 'Excellent' :
        overallScore >= 60 ? 'Good' :
          overallScore >= 40 ? 'Average' : 'Needs Improvement';

      technicians.push({
        id: op.operator_id,
        email: op.email,
        name: op.name || null,
        performanceLevel: overallScore,
        status: status,
        overallScore: overallScore,
        totalRecordings: recordings.length,
        totalShifts: shiftPercentages.length
      });
    }

    // Sort by overallScore descending
    technicians.sort((a, b) => b.overallScore - a.overallScore);

    const duration = Date.now() - startTime;
    console.log(`[DEBUG] Found ${technicians.length} technicians in ${duration}ms`);
    return res.json(technicians);
  } catch (err) {
    console.error('Error fetching technician performance:', err);
    return res.status(500).json({
      error: 'Error fetching technician performance',
      details: err.message
    });
  }
});

// -- Admin: Get shift-by-shift performance details for a specific technician
app.get('/api/admin/technicians/:operatorId/shifts', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { operatorId } = req.params;
    console.log('[DEBUG] Fetching shift details for operator:', operatorId);

    const { getPerformanceRating, getShiftDuration } = require('./aiLogic');

    // ⚡ OPTIMIZATION: Run queries in parallel
    const [
      { data: recordings, error: recError },
      { data: allTasks, error: taskError },
      { data: achievements, error: achError }
    ] = await Promise.all([
      supabase.from('recordings')
        .select('recording_id, shift_date, shift, shift_delay_time, shift_deducted_time, effective_working_time, created_at')
        .eq('operator_id', operatorId)
        .order('created_at', { ascending: false }),
      supabase.from('tasks')
        .select('task_id, date, shift, target_amount, target_unit, target_description'),
      supabase.from('targetachievements')
        .select('target_id, achievement')
        .eq('operator_id', operatorId)
    ]);

    if (recError) throw recError;
    if (taskError) console.error('[DEBUG /shifts] Error fetching tasks:', taskError);

    // Get evaluations for these recordings
    const recordingIds = (recordings || []).map(r => r.recording_id);
    let evaluations = [];
    if (recordingIds.length > 0) {
      const { data: evalData } = await supabase
        .from('evaluations')
        .select('recording_id, extra_time, standard_duration')
        .in('recording_id', recordingIds);
      evaluations = evalData || [];
    }

    // ⚡ OPTIMIZATION: Build achievement Map for O(1) lookup
    const achievementsByTaskId = new Map();
    for (const ach of (achievements || [])) {
      achievementsByTaskId.set(ach.target_id, ach);
    }



    // Group recordings by date and shift
    const shiftsMap = new Map();

    for (const row of (recordings || [])) {
      let dateStr = row.shift_date || (row.created_at ? row.created_at.split('T')[0] : null);
      if (!dateStr) continue;

      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }

      const key = `${dateStr}-${row.shift}`;
      if (shiftsMap.has(key)) continue;

      // Get target and achievement for this date/shift
      let targetAmount = 0;
      let achievementAmount = 0;
      let targetDescription = '';

      // NEW APPROACH: Get tasks directly from achievement IDs (ignores date matching issues)
      let matchingTasks = [];

      if (achievements?.length > 0) {
        // Get task IDs from achievements
        const taskIds = achievements.map(a => a.target_id);

        // Normalize shift name for comparison (handle "First" vs "First Shift")
        const normalizeShift = (shift) => {
          if (!shift) return '';
          const s = shift.toLowerCase().trim();
          if (s === 'first' || s === 'first shift') return 'first';
          if (s === 'second' || s === 'second shift') return 'second';
          if (s === 'third' || s === 'third shift') return 'third';
          return s;
        };

        const recordingShiftNormalized = normalizeShift(row.shift);

        // Find tasks that match these IDs
        matchingTasks = (allTasks || []).filter(t => {
          const taskId = t.TaskID || t.task_id;
          return taskIds.includes(taskId);
        }).filter(t => {
          // Also filter by date/shift to ensure we only get THIS shift's tasks
          let taskDate = t.date;
          if (typeof taskDate === 'string' && taskDate.includes('T')) {
            taskDate = taskDate.split('T')[0];
          }
          const taskShiftNormalized = normalizeShift(t.shift);
          return taskDate === dateStr && taskShiftNormalized === recordingShiftNormalized;
        });
      }



      if (matchingTasks.length > 0) {
        let totalTargetAmount = 0;
        let totalAchievementAmount = 0;
        const allTargetDescriptions = [];

        for (const task of matchingTasks) {
          // Use target_amount from column, or fallback to parsing target_description for old tasks
          let taskTarget = parseFloat(task.target_amount);

          if (!taskTarget || isNaN(taskTarget)) {
            // Fallback: extract from target_description for old tasks
            const desc = task.target_description || '';
            const numMatch = desc.match(/([\d.]+)/);
            if (numMatch) {
              taskTarget = parseFloat(numMatch[1]);
            } else {
              taskTarget = 0;
            }
          }

          totalTargetAmount += taskTarget;

          // Get description for display
          const taskDesc = task.target_description || `${taskTarget} ${task.target_unit || 'كيلو'}`;
          allTargetDescriptions.push(taskDesc);

          // Get achievement for this task - use TaskID or task_id
          const taskId = task.TaskID || task.task_id;
          const taskAchievement = (achievements || []).find(a => a.target_id === taskId);
          if (taskAchievement && taskAchievement.achievement) {
            const achStr = String(taskAchievement.achievement || '');
            // Extract number from achievement string (e.g., "1158 كيلو" -> 1158)
            const achMatch = achStr.match(/([\d.]+)/);
            if (achMatch) {
              let achAmount = parseFloat(achMatch[1]);

              // Convert units if needed
              const achHasTon = achStr.includes('طن');
              const targetHasTon = (task.target_unit || '').includes('طن');

              if (targetHasTon && !achHasTon) {
                achAmount = achAmount / 1000; // كيلو to طن
              } else if (!targetHasTon && achHasTon) {
                achAmount = achAmount * 1000; // طن to كيلو
              }
              totalAchievementAmount += achAmount;
            }
          }
        }

        targetAmount = totalTargetAmount > 0 ? totalTargetAmount : 100;
        achievementAmount = totalAchievementAmount;
        targetDescription = allTargetDescriptions.join(' + ');
      }

      // Get evaluations for this recording
      const recEvals = evaluations.filter(e => e.recording_id === row.recording_id);
      const totalExtraTime = recEvals.reduce((sum, e) => sum + (e.extra_time || 0), 0);
      const totalAllowedFaultTime = recEvals.reduce((sum, e) => sum + (e.standard_duration || 0), 0);

      const delayTime = totalExtraTime || row.shift_delay_time || 0;
      const allowedFaultTime = row.shift_deducted_time || totalAllowedFaultTime || 0;

      // Calculate dynamic shift duration based on date (Friday = 720, others = 480)
      const shiftDuration = getShiftDuration(dateStr);
      const actualWorkingTime = Math.max(0, shiftDuration - allowedFaultTime);
      const workingTimeRatio = actualWorkingTime / shiftDuration;
      const adjustedTarget = targetAmount * workingTimeRatio;

      let achievementPercentage = 0;
      if (adjustedTarget > 0) {
        achievementPercentage = (achievementAmount / adjustedTarget) * 100;
      } else if (achievementAmount > 0) {
        achievementPercentage = 100;
      }

      let overallScore = Math.round(achievementPercentage);
      if (overallScore >= 100) overallScore = 100;

      let status = 'Needs Improvement';
      if (overallScore >= 100) status = 'Excellent';
      else if (overallScore >= 80) status = 'Very Good';
      else if (overallScore >= 60) status = 'Good';
      else if (overallScore >= 40) status = 'Average';

      const delayRating = getPerformanceRating(delayTime);

      shiftsMap.set(key, {
        date: dateStr,
        shift: row.shift,
        target: targetAmount,
        adjustedTarget: Math.round(adjustedTarget * 10) / 10,
        achievement: achievementAmount,
        achievementPercentage: Math.round(achievementPercentage * 10) / 10,
        targetDescription: targetDescription,
        delayTime: delayTime,
        allowedFaultTime: allowedFaultTime,
        effectiveWorkingTime: actualWorkingTime,
        workingTimeRatio: Math.round(workingTimeRatio * 100),
        overallScore: overallScore,
        status: status,
        delayRating: delayRating.rating,
        message: achievementAmount > 0 || adjustedTarget > 0
          ? `تم إنجاز ${achievementAmount} من ${Math.round(adjustedTarget)} ${overallScore >= 100 ? '✅' : ''}`
          : 'لم يتم تسجيل الإنجاز'
      });
    }

    const shifts = Array.from(shiftsMap.values());
    console.log('[DEBUG] Found', shifts.length, 'shifts for operator', operatorId);

    return res.json(shifts);
  } catch (err) {
    console.error('Error fetching shift details:', err);
    return res.json([]);
  }
});

// -- Admin: Get recordings for a specific technician's shift
app.get('/api/admin/technicians/:operatorId/recordings', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const { date, shift } = req.query;

    console.log('[DEBUG] Fetching recordings for operator:', operatorId, 'date:', date, 'shift:', shift);

    let query = supabase
      .from('recordings')
      .select('recording_id, shift, type, transcript, audio_path, shift_date, created_at')
      .eq('operator_id', operatorId);

    if (date) {
      query = query.eq('shift_date', date);
    }
    if (shift) {
      query = query.eq('shift', shift);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to expected format
    const result = (data || []).map(r => ({
      RecordingID: r.recording_id,
      Shift: r.shift,
      Type: r.type,
      Transcript: r.transcript,
      AudioPath: r.audio_path,
      date: r.shift_date,
      CreatedAt: r.created_at
    }));

    console.log('[DEBUG] Found', result.length, 'recordings');
    return res.json(result);
  } catch (err) {
    console.error('Error fetching recordings:', err);
    return res.status(500).json({ error: 'Error fetching recordings' });
  }
});

// -- Admin: Stream audio file for any recording
app.get('/api/admin/recordings/:id/audio', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('audio_path')
      .eq('recording_id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Recording not found' });

    const audioPath = data.audio_path;
    if (!audioPath) return res.status(404).json({ error: 'No audio file for this recording' });

    // Cloud URL - redirect
    if (audioPath.startsWith('https://')) {
      console.log('☁️ Redirecting to cloud URL:', audioPath);
      return res.redirect(audioPath);
    }

    // Legacy: Local file handling
    const absolutePath = path.isAbsolute(audioPath) ? audioPath : path.join(__dirname, audioPath);

    if (!absolutePath.includes('uploads')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Audio file not found on server' });
    }

    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(audioPath).toLowerCase();
    let contentType = 'audio/webm';
    if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.m4a') contentType = 'audio/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
      });
      const stream = fs.createReadStream(absolutePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      });
      const stream = fs.createReadStream(absolutePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('Error streaming audio:', err);
    return res.status(500).json({ error: 'Error streaming audio' });
  }
});

// -- Supervisor: Assign shift target (same as admin)
app.post('/api/supervisor/tasks', verifyToken, async (req, res) => {
  try {
    const { date, target } = req.body;

    if (!date || !target) {
      return res.status(400).json({ error: 'Missing required fields: date, target' });
    }

    console.log('=== SUPERVISOR ASSIGN TASK (ALL SHIFTS) ===');
    console.log('Date:', date);
    console.log('Target:', target);

    // Insert task for all 3 shifts
    const shifts = ['First Shift', 'Second Shift', 'Third Shift'];
    const insertPromises = shifts.map(shift =>
      supabase
        .from('tasks')
        .insert({
          date: date,
          shift: shift,
          target_description: target
        })
        .select()
    );

    const results = await Promise.all(insertPromises);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error(errors[0].error.message);
    }

    const taskIds = results.map(r => r.data?.[0]?.task_id).filter(Boolean);
    console.log('✓ Tasks assigned successfully for all shifts, taskIds:', taskIds);

    return res.json({
      ok: true,
      message: 'Task assigned successfully for all shifts',
      taskIds: taskIds
    });
  } catch (err) {
    console.error('Error assigning task:', err);
    return res.status(500).json({
      error: 'Error assigning task',
      details: err.message
    });
  }
});

// -- Get evaluations for current user
app.get('/api/evaluations', verifyToken, async (req, res) => {
  try {
    // First get recording IDs for this user
    const { data: recordings } = await supabase
      .from('recordings')
      .select('recording_id')
      .eq('operator_id', req.userId);

    if (!recordings || recordings.length === 0) {
      return res.json([]);
    }

    const recordingIds = recordings.map(r => r.recording_id);

    // Then get evaluations for those recordings
    const { data: evaluations, error } = await supabase
      .from('evaluations')
      .select('*')
      .in('recording_id', recordingIds);

    if (error) throw error;

    return res.json(evaluations || []);
  } catch (err) {
    console.error('Error fetching evaluations:', err);
    return res.status(500).json({ error: 'Error fetching evaluations' });
  }
});

// -- Get stops for current user
app.get('/api/stops', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stops')
      .select('*')
      .eq('operator_id', req.userId);

    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error('Error fetching stops:', err);
    return res.status(500).json({ error: 'Error fetching stops' });
  }
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason?.message || reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error?.message || error);
  console.error('Stack:', error?.stack);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log('✅ Connected to Supabase PostgreSQL');
});
