/* eslint-disable no-undef */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const supabase = require("../supabaseDb");
const verifyToken = require("../middleware/auth");
const { transcribeAudio, analyzePerformance } = require("../aiLogic");
const { uploadAudioToSupabase } = require("../supabaseStorage");


let ffmpeg;
try {
    ffmpeg = require('fluent-ffmpeg');
    const ffmpegStatic = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegStatic);
} catch (e) {
    console.warn('⚠️ FFmpeg error:', e.message);
    ffmpeg = null;
}

const upload = multer({ dest: 'uploads/' });

// API for uploading audio recordings
router.post("/", verifyToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

        const { shift, type, date } = req.body;
        const operatorId = req.userId;

        console.log('[DEBUG] Audio upload - date:', date, 'shift:', shift, 'type:', type);

        const mimeType = req.file.mimetype || "audio/webm";
        let extension = ".webm";
        if (mimeType.includes("wav")) extension = ".wav";
        if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = ".m4a";
        if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = ".mp3";

        const originalPath = req.file.path;
        const audioPath = `${req.file.path}${extension}`;
        fs.renameSync(originalPath, audioPath);

        const shiftDate = date || new Date().toISOString().slice(0, 10);

        // Insert recording into Supabase
        const { data: recData, error: recError } = await supabase
            .from('recordings')
            .insert({
                operator_id: operatorId,
                shift: shift,
                type: type,
                transcript: null,
                audio_path: audioPath,
                shift_date: shiftDate
            })
            .select()
            .single();

        if (recError) throw recError;

        const recordingId = recData.recording_id;
        console.log('[DEBUG] Recording saved with ID:', recordingId, 'ShiftDate:', shiftDate);

        // Upload to Supabase Storage
        const supabaseResult = await uploadAudioToSupabase(audioPath, recordingId);
        if (supabaseResult) {
            await supabase
                .from('recordings')
                .update({ audio_path: supabaseResult.url })
                .eq('recording_id', recordingId);
            console.log('☁️ AudioPath updated to Supabase URL:', supabaseResult.url);
        }

        res.json({
            message: "Recording uploaded successfully. AI analysis started in background.",
            recordingId
        });

        // Background AI processing
        (async () => {
            try {
                console.log(`🎤 [Bg] Starting AI for Recording ${recordingId}...`);

                const transcript = await transcribeAudio(audioPath);
                if (!transcript) {
                    console.warn(`⚠️ [Bg] No transcript generated for ${recordingId}`);
                    return;
                }

                // Update recording with transcript
                await supabase
                    .from('recordings')
                    .update({ transcript })
                    .eq('recording_id', recordingId);

                // Get Order Count (number of tasks for this specific shift)
                const { count: orderCount } = await supabase
                    .from('tasks')
                    .select('*', { count: 'exact', head: true })
                    .eq('date', shiftDate)
                    .eq('shift', shift);

                console.log(`🔢 Found ${orderCount || 0} active order(s)/task(s) for ${shift} on ${shiftDate}`);

                const faults = await analyzePerformance(transcript, orderCount || 1);
                const faultsArray = Array.isArray(faults) ? faults : (faults.fault_code ? [faults] : []);

                if (faultsArray.length === 0) {
                    console.log(`⚠️ No faults detected in transcript for Recording ${recordingId}`);
                } else {
                    console.log(`📊 Processing ${faultsArray.length} fault(s) for Recording ${recordingId}`);
                }

                // Save each fault as evaluation
                for (const fault of faultsArray) {
                    let correctStandardDuration;
                    if (fault.fault_code === '09' || fault.fault_code === '10') {
                        correctStandardDuration = fault.detected_duration || 0;
                    } else {
                        correctStandardDuration = fault.allowedTime || fault.standard_duration || 0;
                    }

                    console.log(`   📌 Fault: ${fault.fault_code} - ${fault.fault_name}`);

                    await supabase
                        .from('evaluations')
                        .insert({
                            recording_id: recordingId,
                            fault_code: fault.fault_code || "UNKNOWN",
                            fault_name: fault.fault_name || "غير محدد",
                            detected_duration: fault.detected_duration || 0,
                            standard_duration: correctStandardDuration,
                            time_difference: fault.time_difference || 0,
                            performance_status: fault.status || "Variable",
                            score: fault.score || 50,
                            ai_summary: fault.ai_summary || "تم الحفظ تلقائياً",
                            extra_time: fault.extraTime || 0
                        });
                }

                console.log(`✓ ${faultsArray.length} evaluation(s) saved for Recording ${recordingId}`);

                // Calculate shift metrics
                const { data: allEvaluations } = await supabase
                    .from('evaluations')
                    .select('fault_code, detected_duration, standard_duration, extra_time')
                    .eq('recording_id', recordingId);

                const { calculateShiftMetricsFromStored } = require("../aiLogic");
                // Transform for the function (expects camelCase)
                const evalsForCalc = (allEvaluations || []).map(e => ({
                    FaultCode: e.fault_code,
                    DetectedDuration: e.detected_duration,
                    StandardDuration: e.standard_duration,
                    ExtraTime: e.extra_time
                }));
                const shiftMetrics = calculateShiftMetricsFromStored(evalsForCalc, shiftDate);

                console.log(`📊 Shift Metrics: Deducted=${shiftMetrics.totalFaultTime}, Delay=${shiftMetrics.totalDelayTime}, Effective=${shiftMetrics.effectiveWorkingTime}`);

                await supabase
                    .from('recordings')
                    .update({
                        shift_deducted_time: shiftMetrics.totalFaultTime,
                        shift_delay_time: shiftMetrics.totalDelayTime,
                        effective_working_time: shiftMetrics.effectiveWorkingTime
                    })
                    .eq('recording_id', recordingId);

                console.log(`✓ AI Analysis Complete for Recording ${recordingId}`);

            } catch (bgError) {
                console.error(`❌ Error processing Recording ${recordingId}:`, bgError.message);
            }
        })();

        // Convert to MP3
        if (ffmpeg) {
            const mp3Dir = path.join(__dirname, "../uploads/mp3");
            if (!fs.existsSync(mp3Dir)) fs.mkdirSync(mp3Dir, { recursive: true });

            const mp3Path = path.join(mp3Dir, `recording_${recordingId}.mp3`);
            ffmpeg(audioPath)
                .audioBitrate("128k")
                .toFormat("mp3")
                .save(mp3Path)
                .on("error", (e) => console.error("MP3 Error:", e.message));
        }

    } catch (error) {
        console.error("❌ Error initiating upload:", error);
        if (!res.headersSent) res.status(500).json({ error: "Server error processing file" });
    }
});

// Create recording metadata without audio
router.post('/metadata', verifyToken, async (req, res) => {
    try {
        const { shift, type, date } = req.body;
        console.log('[DEBUG] /api/recordings/metadata - received:', { userId: req.userId, shift, type, date });

        const shiftDate = date || new Date().toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('recordings')
            .insert({
                operator_id: req.userId,
                shift: shift || null,
                type: type || null,
                audio_path: null,
                transcript: null,
                shift_date: shiftDate
            })
            .select()
            .single();

        if (error) throw error;

        console.log('[DEBUG] ✓ Insert successful, recordingId:', data.recording_id);
        return res.json({ ok: true, recordingId: data.recording_id });
    } catch (err) {
        console.error('[ERROR] Recording metadata creation failed:', err.message);
        return res.status(500).json({ error: 'Error creating recording metadata', details: err.message });
    }
});

// List recordings for current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const { date, shift, type } = req.query;

        let query = supabase
            .from('recordings')
            .select('recording_id, shift, type, transcript, audio_path, created_at')
            .eq('operator_id', req.userId)
            .order('created_at', { ascending: false });

        if (date) {
            query = query.gte('created_at', `${date}T00:00:00`)
                .lt('created_at', `${date}T23:59:59`);
        }
        if (shift) query = query.eq('shift', shift);
        if (type) query = query.eq('type', type);

        const { data, error } = await query;

        if (error) throw error;

        // Transform to match expected format
        const result = (data || []).map(r => ({
            RecordingID: r.recording_id,
            Shift: r.shift,
            Type: r.type,
            Transcript: r.transcript,
            AudioPath: r.audio_path,
            CreatedAt: r.created_at
        }));

        return res.json(result);
    } catch (err) {
        console.error('Error fetching recordings:', err);
        return res.status(500).json({ error: 'Error fetching recordings' });
    }
});

// Get single recording metadata
router.get('/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('recording_id, shift, type, transcript, audio_path, created_at')
            .eq('recording_id', id)
            .eq('operator_id', req.userId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Recording not found' });

        return res.json({
            RecordingID: data.recording_id,
            Shift: data.shift,
            Type: data.type,
            Transcript: data.transcript,
            AudioPath: data.audio_path,
            CreatedAt: data.created_at
        });
    } catch (err) {
        console.error('Error fetching recording:', err);
        return res.status(500).json({ error: 'Error fetching recording' });
    }
});

// Stream audio file
router.get('/:id/audio', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('audio_path')
            .eq('recording_id', id)
            .eq('operator_id', req.userId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Recording not found' });

        const audioPath = data.audio_path;
        if (!audioPath) return res.status(404).json({ error: 'No audio file for this recording' });

        // Cloud URL - redirect
        if (audioPath.startsWith('https://')) {
            console.log('☁️ Redirecting to cloud URL:', audioPath);
            return res.redirect(audioPath);
        }

        // Local file handling
        const absolutePath = path.isAbsolute(audioPath) ? audioPath : path.join(__dirname, audioPath);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Audio file not found' });

        const stat = fs.statSync(absolutePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        const contentType = 'audio/wav';

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': contentType,
            });
            fs.createReadStream(absolutePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': contentType });
            fs.createReadStream(absolutePath).pipe(res);
        }
    } catch (err) {
        console.error('Error streaming audio:', err);
        return res.status(500).json({ error: 'Error streaming audio' });
    }
});

// Stream MP3 audio
router.get('/:id/mp3', verifyToken, async (req, res) => {
    const id = req.params.id;
    try {
        const { data, error } = await supabase
            .from('recordings')
            .select('recording_id')
            .eq('recording_id', id)
            .eq('operator_id', req.userId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Recording not found' });

        const mp3Path = path.join(__dirname, '../uploads/mp3', `recording_${id}.mp3`);
        if (!fs.existsSync(mp3Path)) {
            return res.status(404).json({ error: 'MP3 file not found. It may still be converting.' });
        }

        const stat = fs.statSync(mp3Path);
        const fileSize = stat.size;
        const range = req.headers.range;
        const contentType = 'audio/mpeg';

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': end - start + 1,
                'Content-Type': contentType,
            });
            fs.createReadStream(mp3Path, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': contentType });
            fs.createReadStream(mp3Path).pipe(res);
        }
    } catch (err) {
        console.error('Error streaming MP3:', err);
        return res.status(500).json({ error: 'Error streaming MP3' });
    }
});

// Get shift metrics
router.get('/stats/extra-time', verifyToken, async (req, res) => {
    try {
        const { date, shift } = req.query;
        const operatorId = req.userId;

        if (!date || !shift) {
            return res.status(400).json({ error: 'date and shift are required' });
        }

        const { data } = await supabase
            .from('recordings')
            .select('shift_deducted_time, shift_delay_time, effective_working_time')
            .eq('operator_id', operatorId)
            .eq('shift', shift)
            .gte('created_at', `${date}T00:00:00`)
            .lt('created_at', `${date}T23:59:59`)
            .order('created_at', { ascending: false })
            .limit(1);

        const { getPerformanceRating, formatShiftTime, getShiftDuration } = require("../aiLogic");
        const SHIFT_DURATION = getShiftDuration(date);
        const shiftDeductedTime = data?.[0]?.shift_deducted_time || 0;
        const shiftDelayTime = data?.[0]?.shift_delay_time || 0;
        const effectiveWorkingTime = data?.[0]?.effective_working_time || SHIFT_DURATION;
        const performanceRating = getPerformanceRating(shiftDelayTime);

        res.json({
            date,
            shift,
            shiftDuration: SHIFT_DURATION,
            shiftDurationFormatted: formatShiftTime(SHIFT_DURATION),
            totalDeductedTime: shiftDeductedTime,
            totalDeductedHours: (shiftDeductedTime / 60).toFixed(2),
            totalDeductedTimeFormatted: formatShiftTime(shiftDeductedTime),
            totalDelayTime: shiftDelayTime,
            totalDelayHours: (shiftDelayTime / 60).toFixed(2),
            totalDelayTimeFormatted: formatShiftTime(shiftDelayTime),
            effectiveWorkingTime,
            effectiveWorkingHours: (effectiveWorkingTime / 60).toFixed(2),
            effectiveWorkingTimeFormatted: formatShiftTime(effectiveWorkingTime),
            performanceRating: performanceRating.rating,
            performanceScore: performanceRating.score,
            recordingCount: data?.length || 0
        });

    } catch (err) {
        console.error('Error fetching shift metrics:', err);
        return res.status(500).json({ error: 'Error fetching shift metrics' });
    }
});

module.exports = router;
