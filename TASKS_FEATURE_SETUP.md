# Tasks Feature Setup Guide

## Overview::
This guide explains how to set up the new Tasks feature for assigning shift targets to technicians.

## What's New
- **Admin Task Assignment**: Admins can now assign production targets for specific dates and shifts
- **Technician Task Tracking**: Technicians see assigned targets in their RecordAudio page and can record their achievements

## Setup Instructions

### Step 1: Run Database Migration
The Tasks feature requires a new `tasks` table in the database. Run the migration:

```bash
cd backend
node run-migrations.js
```

This will automatically create the `tasks` table with the proper schema.

### Step 2: Backend Changes
The following new endpoints have been added:

#### Admin Endpoint
- **`POST /api/admin/tasks`** - Assign a target for a specific date and shift
  - Headers: `Authorization: <JWT_TOKEN>`
  - Body: `{ date: "2025-12-06", shift: "First", target: "طن شيبسي شطة و ليمون 10" }`
  - Response: `{ ok: true, taskId: 123 }`

#### Technician Endpoint
- **`GET /api/technician/tasks?date=2025-12-06&shift=First`** - Get targets for a specific date and shift
  - Headers: `Authorization: <JWT_TOKEN>`
  - Response: `[{ TaskID: 123, TargetDescription: "..." }]`

### Step 3: Frontend Changes
Two components have been updated:

#### Tasks.jsx (Admin Page)
- Now includes JWT authentication
- Sends target description to the backend
- Displays success/error messages

#### RecordAudio.jsx (Technician Page)
- Automatically fetches targets when date/shift is changed
- Displays targets in a dynamic table under "Target Achievements"
- Technicians can enter their achievement values
- Fixed: `ddisabled` attribute typo

## Database Schema

```sql
CREATE TABLE tasks (
  TaskID INT AUTO_INCREMENT PRIMARY KEY,
  Date DATE NOT NULL,
  Shift VARCHAR(50) NOT NULL,
  TargetDescription LONGTEXT NOT NULL,
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_date_shift (Date, Shift)
);
```

## Workflow

1. **Admin assigns a target**:
   - Navigate to Admin Panel → Tasks
   - Select a date
   - Choose a shift (First, Second, Third)
   - Enter the target description
   - Click "Assign Target"

2. **Technician views targets**:
   - Navigate to Daily Recording Portal
   - Select a date
   - Choose a shift
   - Assigned targets automatically appear in "Target Achievements" table
   - Enter achievement value and save

## Troubleshooting

### "Tasks table not found" error
- Run the migration: `node run-migrations.js`
- Check database connection in `.env`

### Empty targets list for technician
- Verify admin assigned targets for that date/shift
- Check browser network tab for API response

### Authentication errors
- Ensure JWT token is being sent in headers
- Verify token expiry (default: 24 hours)

## Files Modified
- `backend/server.js` - Added two new endpoints
- `backend/run-migrations.js` - Migration runner (new file)
- `backend/migrations/002_create_tasks_table.sql` - Create tasks table (new file)
- `src/pages/admin/Tasks.jsx` - Added authentication
- `src/pages/technician/RecordAudio.jsx` - Added target fetching and display
