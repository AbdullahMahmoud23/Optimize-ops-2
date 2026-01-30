/**
 * Supabase Database Client
 * Replaces MySQL connection with Supabase PostgreSQL
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://asujcdxramfbtjrtzlgz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_IVXIvEvnJPdR0eNi3WPtYA_vesMF0cX';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('✅ Connected to Supabase PostgreSQL');

module.exports = supabase;
