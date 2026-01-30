# MySQL to Supabase Migration Guide

## Overview

This guide walks you through migrating your Optimize-Ops application from MySQL (Railway) to Supabase.

### Current Stack
- **Database**: MySQL on Railway
- **Backend**: Express.js with raw SQL
- **Auth**: Custom JWT + Google OAuth
- **Storage**: Cloudinary + local filesystem

### Target Stack
- **Database**: PostgreSQL on Supabase
- **Backend**: Express.js with Supabase client (or Edge Functions)
- **Auth**: Supabase Auth (built-in Google OAuth)
- **Storage**: Supabase Storage

---

## Migration Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGciOiJI...` (for frontend)
   - Service Role Key: `eyJhbGciOiJI...` (for backend/migrations)

### Step 2: Run Database Migrations

In the Supabase SQL Editor, run these files in order:

```
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/migrations/003_seed_defects.sql
```

Or use the Supabase CLI:
```bash
supabase db push
```

### Step 3: Migrate Data

1. Install dependencies:
```bash
npm install @supabase/supabase-js
```

2. Create `.env.supabase` file:
```env
# Existing MySQL (keep your current values)
MYSQL_HOST=your-railway-host
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=railway
MYSQL_PORT=3306

# New Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...
```

3. Run migration script:
```bash
node supabase/data-migration.js
```

### Step 4: Migrate Audio Files to Supabase Storage

1. Create a storage bucket in Supabase:
   - Go to Storage → Create bucket
   - Name: `recordings`
   - Public: No (private bucket)

2. Upload existing files:
```bash
# Example using Supabase CLI
supabase storage cp backend/uploads/*.webm recordings/
supabase storage cp backend/uploads/mp3/*.mp3 recordings/mp3/
```

3. Update `audio_path` in database to use new URLs

### Step 5: Update Backend Code

#### Install Supabase Client
```bash
cd backend
npm install @supabase/supabase-js
```

#### Replace Database Connection

**Before (MySQL):**
```javascript
const db = require('./db');
const [rows] = await db.promise().query('SELECT * FROM operators WHERE Email = ?', [email]);
```

**After (Supabase):**
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await supabase
    .from('operators')
    .select('*')
    .eq('email', email);
```

#### Update Auth Routes

**Before (Custom JWT):**
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET);
```

**After (Supabase Auth):**
```javascript
// Option 1: Use Supabase Auth directly
const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
});

// Option 2: Keep custom JWT but verify against Supabase
```

### Step 6: Update Frontend

#### Install Supabase Client
```bash
npm install @supabase/supabase-js
```

#### Update API Configuration

**src/lib/supabase.js:**
```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

#### Update Auth Context

See Supabase Auth documentation for React integration:
https://supabase.com/docs/guides/auth/auth-helpers/react

---

## Schema Changes Summary

### Column Name Changes (camelCase → snake_case)

| MySQL | PostgreSQL |
|-------|------------|
| OperatorID | operator_id |
| RecordingID | recording_id |
| AudioPath | audio_path |
| CreatedAt | created_at |
| ShiftDate | shift_date |
| TargetID | target_id |
| GoogleID | google_id |

### Type Changes

| MySQL | PostgreSQL |
|-------|------------|
| INT AUTO_INCREMENT | SERIAL |
| VARCHAR(n) | VARCHAR(n) |
| TEXT/LONGTEXT | TEXT |
| DATETIME | TIMESTAMPTZ |
| TINYINT(1) | BOOLEAN |
| JSON | JSONB |
| ENUM | Custom TYPE |

### New Features

1. **Foreign Key Constraints** - Now enforced at database level
2. **Row Level Security** - Built-in access control
3. **Indexes** - Optimized for common queries
4. **Updated_at Trigger** - Automatic timestamp updates

---

## API Endpoint Migration Checklist

- [ ] POST /api/auth/login → Supabase Auth
- [ ] POST /api/auth/google → Supabase Google OAuth
- [ ] POST /api/auth/signup → Supabase Auth signUp
- [ ] GET /api/recordings → supabase.from('recordings').select()
- [ ] POST /api/recordings → supabase.from('recordings').insert()
- [ ] GET /api/technician/targets → supabase.from('targets').select()
- [ ] POST /api/technician/targets/:id/achievement → supabase.from('targetachievements').upsert()
- [ ] GET /api/admin/technicians/performance → Complex query (see below)
- [ ] POST /api/admin/tasks → supabase.from('tasks').insert()
- [ ] POST /api/supervisor/tasks → supabase.from('tasks').insert()

### Complex Query: Performance Dashboard

The performance query requires aggregation. Options:

1. **PostgreSQL Function** - Create a stored function
2. **Multiple Queries** - Fetch data and aggregate in JavaScript
3. **Database View** - Create a materialized view

Example PostgreSQL function:
```sql
CREATE OR REPLACE FUNCTION get_technician_performance(from_date DATE, to_date DATE)
RETURNS TABLE (
    operator_id INT,
    name TEXT,
    total_recordings BIGINT,
    avg_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.operator_id,
        o.name,
        COUNT(r.recording_id) as total_recordings,
        AVG(e.score)::DECIMAL as avg_score
    FROM operators o
    LEFT JOIN recordings r ON o.operator_id = r.operator_id
        AND r.shift_date BETWEEN from_date AND to_date
    LEFT JOIN evaluations e ON r.recording_id = e.recording_id
    GROUP BY o.operator_id, o.name;
END;
$$ LANGUAGE plpgsql;
```

---

## Rollback Plan

If issues occur, you can rollback:

1. Keep MySQL running during migration
2. Update environment variables to point back to MySQL
3. Restart services

---

## Post-Migration Checklist

- [ ] Verify all data migrated correctly
- [ ] Test authentication (email + Google)
- [ ] Test recording upload and playback
- [ ] Test performance dashboard
- [ ] Test task assignment
- [ ] Update CORS settings in Supabase
- [ ] Set up Supabase monitoring/alerts
- [ ] Delete old MySQL database (after verification period)

---

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
