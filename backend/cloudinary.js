/**
 * Cloudinary Configuration for Audio Storage
 * Provides persistent cloud storage for recordings
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Force deploy update
/**
 * Check if Cloudinary is properly configured
 */
function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

/**
 * Upload audio file to Cloudinary
 * @param {string} filePath - Local path to the audio file
 * @param {number} recordingId - Recording ID for naming
 * @returns {Promise<{url: string, publicId: string} | null>}
 */
async function uploadAudio(filePath, recordingId) {
    // Re-read environment variables (in case they were updated)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    console.log(`☁️ Cloudinary Config Check:`);
    console.log(`   - CLOUD_NAME: ${cloudName ? cloudName : 'NOT SET'}`);
    console.log(`   - API_KEY: ${apiKey ? '***' + apiKey.slice(-4) : 'NOT SET'}`);
    console.log(`   - API_SECRET: ${apiSecret ? '***' + apiSecret.slice(-4) : 'NOT SET'}`);

    if (!cloudName || !apiKey || !apiSecret) {
        console.warn('⚠️ Cloudinary not configured - audio will be stored locally only');
        return null;
    }

    // Re-configure cloudinary with trimmed values
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
    });

    try {
        console.log(`☁️ Uploading recording ${recordingId} to Cloudinary...`);
        console.log(`   - File path: ${filePath}`);

        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'video', // Cloudinary uses 'video' for audio files
            folder: 'optimize-ops/recordings',
            public_id: `recording_${recordingId}`,
            overwrite: true
        });

        console.log(`✅ Cloudinary upload successful!`);
        console.log(`   - URL: ${result.secure_url}`);

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('❌ Cloudinary upload failed:', error.message);
        console.error('   - Full error:', JSON.stringify(error, null, 2));
        return null;
    }
}

/**
 * Delete audio file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
async function deleteAudio(publicId) {
    if (!isCloudinaryConfigured()) return;

    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
        console.log(`🗑️ Deleted from Cloudinary: ${publicId}`);
    } catch (error) {
        console.error('❌ Cloudinary delete failed:', error.message);
    }
}

/**
 * Get Cloudinary URL for a recording
 * @param {string} audioPath - AudioPath from database
 * @returns {boolean} - Whether the path is a Cloudinary URL
 */
function isCloudinaryUrl(audioPath) {
    return audioPath && audioPath.startsWith('https://res.cloudinary.com');
}

module.exports = {
    uploadAudio,
    deleteAudio,
    isCloudinaryConfigured,
    isCloudinaryUrl
};
