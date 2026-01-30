/**
 * Supabase Storage Helper
 * Uploads audio files to Supabase Storage bucket
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://asujcdxramfbtjrtzlgz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_IVXIvEvnJPdR0eNi3WPtYA_vesMF0cX';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET_NAME = 'recordings';

/**
 * Check if Supabase Storage is configured
 */
function isSupabaseConfigured() {
    return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/**
 * Upload audio file to Supabase Storage
 * @param {string} localPath - Path to local audio file
 * @param {number} recordingId - Recording ID for naming
 * @returns {Promise<{url: string, path: string} | null>}
 */
async function uploadAudioToSupabase(localPath, recordingId) {
    if (!isSupabaseConfigured()) {
        console.warn('⚠️ Supabase Storage not configured');
        return null;
    }

    try {
        // Read file
        const fileBuffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath) || '.webm';
        const fileName = `recording_${recordingId}${ext}`;

        // Determine content type
        let contentType = 'audio/webm';
        if (ext === '.wav') contentType = 'audio/wav';
        if (ext === '.mp3') contentType = 'audio/mpeg';
        if (ext === '.m4a') contentType = 'audio/mp4';

        console.log(`☁️ Uploading to Supabase Storage: ${fileName}`);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileBuffer, {
                contentType,
                upsert: true // Overwrite if exists
            });

        if (error) {
            console.error('❌ Supabase Storage upload error:', error.message);
            return null;
        }

        // Get public URL (signed URL for private bucket)
        const { data: urlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry

        const publicUrl = urlData?.signedUrl;

        console.log(`✅ Uploaded to Supabase: ${fileName}`);

        return {
            url: publicUrl,
            path: data.path
        };

    } catch (err) {
        console.error('❌ Supabase upload error:', err.message);
        return null;
    }
}

/**
 * Get signed URL for a recording
 * @param {string} filePath - Path in storage bucket
 * @param {number} expiresIn - Seconds until expiry (default 1 hour)
 */
async function getSignedUrl(filePath, expiresIn = 3600) {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        console.error('Error getting signed URL:', error.message);
        return null;
    }

    return data.signedUrl;
}

/**
 * Delete a recording from storage
 * @param {string} filePath - Path in storage bucket
 */
async function deleteAudio(filePath) {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

    if (error) {
        console.error('Error deleting audio:', error.message);
        return false;
    }

    return true;
}

module.exports = {
    supabase,
    uploadAudioToSupabase,
    getSignedUrl,
    deleteAudio,
    isSupabaseConfigured
};
