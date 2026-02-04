/* eslint-disable no-undef */
// backend/aiLogic.js
const OpenAI = require("openai");
const https = require("node:https");
const fs = require("node:fs");
require("dotenv").config();

const { File } = require('node:buffer');
globalThis.File = File;


const executeWithFallback = async (primaryOp, fallbackOp, operationName = 'AI Operation', maxRetries = 3) => {
    let lastError;
    
    // Try primary (Groq) first - fastest and cheapest
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🚀 Attempt ${attempt}/${maxRetries} - ${operationName} (Primary)...`);
            return await primaryOp();
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Primary attempt ${attempt} failed: ${err.message}`);
            
            // Check if it's a transient error (worth retrying)
            if (!isTransientError(err)) {
                console.log(`❌ Permanent error detected, skipping to fallback`);
                break; // Don't retry permanent errors
            }
            
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * attempt, 5000); // exponential backoff, max 5s
                console.log(`   ⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // If primary failed, try fallback (OpenRouter)
    console.log(`🔄 Primary failed, switching to Fallback (${operationName})...`);
    try {
        return await fallbackOp();
    } catch (fallbackErr) {
        console.error(`❌ Fallback also failed: ${fallbackErr.message}`);
        console.error(`📝 Original error: ${lastError.message}`);
        return null;
    }
};


const isTransientError = (error) => {
    const message = error?.message || '';
    const status = error?.status;
    
    // Transient errors (should retry)
    if (message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT') ||
        message.includes('timeout') ||
        message.includes('Connection refused') ||
        message.includes('ECONNRESET') ||
        status === 429 || // Rate limited
        status === 503 || // Service unavailable
        status === 504) { // Gateway timeout
        return true;
    }
    
    // Permanent errors (don't retry)
    if (message.includes('401') || // Unauthorized
        message.includes('403') || // Forbidden
        message.includes('400') || // Bad request
        message.includes('Invalid')) { // Invalid parameter
        return false;
    }
    
    return false;
};

const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    httpAgent: new https.Agent({ family: 4, keepAlive: true }),
    timeout: 30000 // Wait 30 seconds before failing
});

const reasoningClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
        "X-Title": "Factory Ops AI",
    },
    httpAgent: new https.Agent({ family: 4, keepAlive: true }),
    timeout: 30000
});

// 1. Transcribe Function with Retry & Fallback
async function transcribeAudio(filePath) {
    try {
        console.log(`🔍 AI Logic received file: ${filePath}`);

        // Check if file exists and has size
        if (!fs.existsSync(filePath)) {
            console.error("❌ File not found at path:", filePath);
            return null;
        }
        const stats = fs.statSync(filePath);
        console.log(`📄 File Size: ${stats.size} bytes`);
        if (stats.size < 100) {
            console.error("❌ File is too small (empty recording?)");
            return null;
        }

        // Create file stream with proper naming
        const getFileStream = () => {
            const fileStream = fs.createReadStream(filePath);
            fileStream.name = "upload.webm";
            return fileStream;
        };

        // 🚀 Primary: Groq (fastest)
        const primaryTranscribe = async () => {
            const fileStream = getFileStream();
            const transcription = await groqClient.audio.transcriptions.create({
                file: fileStream,
                model: "whisper-large-v3",
                language: "ar",
                response_format: "json",
            });
            return transcription.text;
        };

        // Fallback: OpenRouter if Groq fails
        const fallbackTranscribe = async () => {
            const fileStream = getFileStream();
            const transcription = await reasoningClient.audio.transcriptions.create({
                file: fileStream,
                model: "whisper-1", // or another available model
                language: "ar",
                response_format: "json",
            });
            return transcription.text;
        };

        // Execute with retry + fallback
        const result = await executeWithFallback(
            primaryTranscribe,
            fallbackTranscribe,
            'Transcription',
            3
        );

        if (result) {
            console.log("✅ Transcription Result:", result ? "Text received" : "Empty");
            return result;
        } else {
            console.error("❌ All transcription attempts failed");
            return null;
        }

    } catch (error) {
        console.error("❌ Transcription Error:", error.cause || error);
        if (error.response) console.error("API Details:", error.response.data);
        return null;
    }
}

// 1b. Extract Job Order Data (Vision)
// Supports: JPG, PNG, WEBP, and PDF (converted to image)
// mimeType: passed from multer (e.g., 'application/pdf', 'image/jpeg')
async function extractJobOrderData(filePath, mimeType = null) {
    try {
        if (!fs.existsSync(filePath)) return null;

        const path = require('node:path');
        let imagePath = filePath;
        let tempPdfImage = null;

        // Detect file type from MIME type (preferred) or extension
        const isPdf = mimeType === 'application/pdf' || path.extname(filePath).toLowerCase() === '.pdf';

        // Handle PDF files - convert to image first
        if (isPdf) {
            console.log('📄 PDF detected, converting to image...');
            const os = require('os');
            const platform = os.platform();
            const outputDir = path.dirname(filePath);
            const outputName = `pdf_converted_${Date.now()}`;

            // Expected output file (pdftocairo appends -1.jpg or similar)
            // We'll search for it after conversion

            try {
                if (platform === 'linux') {
                    console.log('🐧 Linux detected. PATH:', process.env.PATH);

                    const { spawnSync } = require('child_process');
                    let conversionSuccess = false;

                    // Strategy 1: Try pdftocairo (Poppler)
                    console.log('Attempting Strategy 1: pdftocairo...');
                    const result1 = spawnSync('pdftocairo', ['-jpeg', '-f', '1', '-l', '1', filePath, path.join(outputDir, outputName)]);

                    if (result1.error) {
                        console.warn('⚠️ pdftocairo error:', result1.error.message);
                    } else if (result1.status !== 0) {
                        console.warn('⚠️ pdftocairo failed:', result1.stderr.toString());
                    } else {
                        let potentialPath = path.join(outputDir, `${outputName}-1.jpg`);
                        if (!fs.existsSync(potentialPath)) potentialPath = path.join(outputDir, `${outputName}.jpg`);
                        if (fs.existsSync(potentialPath)) {
                            tempPdfImage = potentialPath;
                            conversionSuccess = true;
                            console.log('✅ Strategy 1 (pdftocairo) succeeded');
                        }
                    }

                    // Strategy 2: Try convert (ImageMagick) if Strategy 1 failed
                    if (!conversionSuccess) {
                        console.log('Attempting Strategy 2: ImageMagick convert...');
                        const result2 = spawnSync('convert', ['-density', '150', `${filePath}[0]`, '-quality', '90', path.join(outputDir, `${outputName}.jpg`)]);
                        if (result2.error) {
                            console.warn('⚠️ convert error:', result2.error.message);
                        } else if (result2.status !== 0) {
                            console.warn('⚠️ convert failed:', result2.stderr.toString());
                        } else {
                            const potentialPath = path.join(outputDir, `${outputName}.jpg`);
                            if (fs.existsSync(potentialPath)) {
                                tempPdfImage = potentialPath;
                                conversionSuccess = true;
                                console.log('✅ Strategy 2 (ImageMagick) succeeded');
                            }
                        }
                    }

                    if (!conversionSuccess) {
                        throw new Error('All PDF conversion strategies failed on Linux.');
                    }

                } else {
                    console.log('🪟 Windows/Mac detected - using pdf-poppler...');
                    const pdfPoppler = require('pdf-poppler');

                    const opts = {
                        format: 'jpeg',
                        out_dir: outputDir,
                        out_prefix: outputName,
                        page: 1  // Only first page
                    };

                    await pdfPoppler.convert(filePath, opts);
                    // pdf-poppler creates file with -1 suffix for page 1
                    tempPdfImage = path.join(outputDir, `${outputName}-1.jpg`);
                }

                if (fs.existsSync(tempPdfImage)) {
                    imagePath = tempPdfImage;
                    console.log('✅ PDF converted to image:', tempPdfImage);
                } else {
                    console.error('❌ PDF conversion failed - output not found at', tempPdfImage);
                    return null;
                }
            } catch (pdfError) {
                console.error('❌ PDF conversion error:', pdfError.message);
                return null;
            }
        }

        // Use Gemini 3 model from .env
        const model = process.env.OPENROUTER_MODEL || "google/gemini-3-pro-preview";

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // Determine correct MIME type for Vision API
        // For converted PDFs: use image/jpeg (since pdf-poppler outputs JPEG)
        // For images: use the original mimeType or detect from extension
        let imageMimeType = 'image/jpeg'; // default for PDF conversions
        if (!isPdf && mimeType) {
            // Use the original MIME type passed from multer
            imageMimeType = mimeType;
        } else if (!isPdf) {
            // Fallback to extension detection
            const imageExt = path.extname(imagePath).toLowerCase();
            if (imageExt === '.png') imageMimeType = 'image/png';
            else if (imageExt === '.webp') imageMimeType = 'image/webp';
        }

        const completion = await reasoningClient.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this Job Order image (Arabic Table). Extract: 1) 'Input Qty' (الكمية داخل or خام الطباعة) in kg, 2) 'Planned Hours' (ساعات مخطط), 3) 'Product/Client Name' (اسم المنتج or اسم العميل). Return JSON: { \"printing_qty_kg\": number, \"printing_planned_hours\": number, \"product_name\": string }" },
                        { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${base64Image}` } }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        // Cleanup temp PDF image
        if (tempPdfImage && fs.existsSync(tempPdfImage)) {
            try { fs.unlinkSync(tempPdfImage); } catch (e) { /* ignore */ }
        }

        const result = JSON.parse(completion.choices[0].message.content);
        return result;

    } catch (e) {
        console.error("❌ Vision Error:", e.message);
        return null;
    }
}

// Fault code translations to Arabic - EXACT names from reference table
const faultNamesByCode = {
    "01": "التوقف لضبط الالوان اكثر من مرة",
    "02": "التوقف لتغيير عدة كاوتشات لضبط الريجيستر",
    "03": "التوقف لصنفرة خبطات في السلندر",
    "04": "التوقف لمراجعة الالوان والبيانات والمقاسات مع الجودة",
    "05": "التوقف لتغيير الاكسات لضبط الريجيستر",
    "06": "تغير الطلبية / انتظار التجهيزات",
    "07": "التوقف للاعتماد مع العميل وضبط الالوان",
    "08": "التوقف لتغيير بكر الخامة لوجود ترخية او اي مشاكل اخري للخامة من تكسير او تقطيع",
    "09": "التوقف لاعطال الصيانة متنوعة",
    "10": "انقطاع التيار الكهربائي",
    "11": "اعطاء حرارة او انتظار والتوقف علي خامات",
    "12": "تغيير السكينة او اللامات"
};

// Standard durations for each fault code (in minutes)
// Note: Some faults are "per unit" - multiply by quantity
const standardDurations = {
    "01": 30,    // ضبط ألوان
    "02": 30,    // تغيير كاوتشات
    "03": 30,    // صنفرة السلندر (PER CYLINDER - 30 min × number of cylinders)
    "04": 15,    // مراجعة الجودة
    "05": 15,    // تغيير الاكسات (PER AXLE - 15 min × number of axles)
    "06": 90,    // تغير الطلبية / انتظار التجهيزات (DEFAULT 90 min if no quantity, OR 15 min × cylinders)
    "07": 120,   // موافقة العميل
    "08": 15,    // تغيير البكر
    "09": 0,     // صيانة (variable - no penalty)
    "10": 0,     // انقطاع الكهرباء (variable - no penalty)
    "11": 15,    // اعطاء حرارة / توقف خامات
    "12": 10      // تغيير السكينة او اللامات (PER CYLINDER - 10 min × number of cylinders)
};

// Faults that are calculated per unit (quantity based)
// Note: defaultIfNoQuantity = fixed time if technician doesn't specify quantity
const perUnitFaults = {
    "03": { perUnit: 30, unitName: "سلندر", unitNamePlural: "سلندرات", defaultIfNoQuantity: 30 },  // 30 min per cylinder - default to 1 cylinder if not specified
    "05": { perUnit: 15, unitName: "اكس", unitNamePlural: "اكسات", defaultIfNoQuantity: 15 },      // 15 min per axle - default to 1 axle if not specified
    "06": { perUnit: 15, unitName: "سلندر", unitNamePlural: "سلندرات", defaultIfNoQuantity: 90 },  // 15 min per cylinder OR 90 min default
    "12": { perUnit: 10, unitName: "سلندر", unitNamePlural: "سلندرات", defaultIfNoQuantity: 10 }   // 10 min per cylinder (تغيير السكينة/اللامات) - default to 1 cylinder if not specified
};

// Shift configuration for regular days (Saturday to Thursday)
const SHIFT_CONFIG = {
    "First Shift": {
        startTime: "07:30",
        endTime: "15:30",
        durationMinutes: 480  // 8 hours
    },
    "Second Shift": {
        startTime: "15:30",
        endTime: "23:30",
        durationMinutes: 480  // 8 hours
    },
    "Third Shift": {
        startTime: "23:30",
        endTime: "07:30",
        durationMinutes: 480  // 8 hours
    }
};

// Friday shift configuration (only 2 shifts, 12 hours each)
const FRIDAY_SHIFT_CONFIG = {
    "First Shift": {
        startTime: "07:30",
        endTime: "19:30",
        durationMinutes: 720  // 12 hours
    },
    "Second Shift": {
        startTime: "19:30",
        endTime: "07:30",
        durationMinutes: 720  // 12 hours
    }
};

// Helper function to get the correct shift configuration based on day
function getShiftConfig(date) {
    const dayOfWeek = new Date(date).getDay();
    // Friday is day 5 in JavaScript (0 = Sunday, 5 = Friday)
    if (dayOfWeek === 5) {
        return FRIDAY_SHIFT_CONFIG;
    }
    return SHIFT_CONFIG;
}

// Helper function to get shift duration based on day
function getShiftDuration(date) {
    const config = getShiftConfig(date);
    // Return the duration of the first shift (all shifts same duration per day)
    return config["First Shift"].durationMinutes;
}

// 3. Analyze Function - Returns ARRAY of faults (supports multiple faults per recording)
async function analyzePerformance(transcript, orderCount = 1) {
    // Define the rules for the AI to reference - EXACT names from reference table
    const faultRules = `
    أكواد الأعطال والأوقات المسموحة:
    - كود 01: التوقف لضبط الالوان اكثر من مرة (30 دقيقة)
    - كود 02: التوقف لتغيير عدة كاوتشات لضبط الريجيستر (30 دقيقة)
    - كود 03: التوقف لصنفرة خبطات في السلندر (30 دقيقة للسلندر الواحد)
    - كود 04: التوقف لمراجعة الالوان والبيانات والمقاسات مع الجودة (15 دقيقة)
    - كود 05: التوقف لتغيير الاكسات لضبط الريجيستر (15 دقيقة للاكس الواحد)
    - كود 06: تغير الطلبية / انتظار التجهيزات (15 دقيقة للسلندر الواحد)
    - كود 07: التوقف للاعتماد مع العميل وضبط الالوان (120 دقيقة)
    - كود 08: التوقف لتغيير بكر الخامة لوجود ترخية او اي مشاكل اخري للخامة من تكسير او تقطيع (15 دقيقة)
    - كود 09: التوقف لاعطال الصيانة متنوعة (وقت مفتوح)
    - كود 10: انقطاع التيار الكهربائي (وقت مفتوح)
    - كود 11: اعطاء حرارة او انتظار والتوقف علي خامات (15 دقيقة)
    - كود 12: تغيير السكينة او اللامات (10 دقائق للسلندر الواحد)
    `;

    const systemPrompt = `
    أنت مشرف مصنع ذكي. حلل هذا النص المسجل من الفني.
    
    ⚠️ مهم جداً: استخرج فقط الأعطال المذكورة صراحة في النص.
    
    ⚠️⚠️⚠️ قاعدة إلزامية: الفني يجب أن يقول رقم الكود (01-12) فقط ⚠️⚠️⚠️
    ❌ لا تقبل أي وصف للمشكلة بدون ذكر رقم الكود
    ❌ إذا لم يُذكر رقم الكود صراحة، لا تستخرج أي عطل
    ✅ فقط إذا ذكر الفني "كود XX" استخرج العطل
    
    ⚠️ التعرف على رقم الكود - افهم الأرقام بالعامية المصرية:
    - "كود صفر واحد" أو "كود 01" أو "كود واحد" أو "الكود رقم 1" = كود 01
    - "كود صفر اتنين" أو "كود 02" أو "كود اتنين" أو "الكود رقم 2" = كود 02
    - "كود صفر تلاتة" أو "كود 03" أو "كود تلاتة" أو "الكود رقم 3" = كود 03
    - "كود صفر اربعة" أو "كود 04" أو "كود اربعة" أو "الكود رقم 4" = كود 04
    - "كود صفر خمسة" أو "كود 05" أو "كود خمسة" أو "الكود رقم 5" = كود 05
    - "كود صفر ستة" أو "كود 06" أو "كود ستة" أو "الكود رقم 6" = كود 06
    - "كود صفر سبعة" أو "كود 07" أو "كود سبعة" أو "الكود رقم 7" = كود 07
    - "كود صفر تمنية" أو "كود 08" أو "كود تمنية" أو "الكود رقم 8" = كود 08
    - "كود صفر تسعة" أو "كود 09" أو "كود تسعة" أو "الكود رقم 9" = كود 09
    - "كود عشرة" أو "كود 10" أو "الكود رقم 10" = كود 10
    - "كود حداشر" أو "كود 11" أو "الكود رقم 11" = كود 11
    - "كود اتناشر" أو "كود 12" أو "الكود رقم 12" = كود 12
    
    لو الفني قال رقم الكود مباشرة، استخدم اسم العطل الرسمي من القائمة أدناه.
    
    /* ========== DISABLED: Fault Description Recognition ========== 
     * هذه القواعد معطلة - الفني يجب أن يذكر الكود فقط
     * لإعادة التفعيل: أزل علامات التعليق من هذا القسم
     * 
     * قواعد التصنيف المهمة (معطلة):
     * - "ضبط ألوان مع الجودة" أو "مراجعة الألوان مع الجودة" = كود 04 فقط (عطل واحد - 15 دقيقة مسموح)
     * - "اعتماد العميل وضبط الألوان" أو "موافقة العميل وضبط الألوان" = كود 06 فقط (عطل واحد - 90 دقيقة مسموح)
     * - "ضبط ألوان" أو "تعديل الألوان" بدون ذكر "جودة" أو "عميل" = كود 01 (30 دقيقة مسموح)
     * - "صنفرة X سلندرات" = كود 03 مع quantity = X
     * - "تغيير X اكسات" = كود 05 مع quantity = X
     * - "تغيير الطلبية" أو "انتظار التجهيزات" = كود 10 مع quantity = عدد السلندرات (15 دقيقة للسلندر)
     * ========== END DISABLED SECTION ========== */
    
    ⚠️ مهم جداً - فهم الأعداد بالعامية المصرية (كود 03 و 05 و 06 و 12):
    للسلندرات (كود 03 و كود 06 و كود 12):
    - "سلندر" أو "سلندر واحد" = quantity: 1
    - "سلندرين" أو "اتنين سلندر" = quantity: 2
    - "تلات سلندرات" أو "3 سلندرات" = quantity: 3
    - "اربع سلندرات" أو "4 سلندرات" = quantity: 4
    - "خمس سلندرات" أو "5 سلندرات" = quantity: 5
    - "ست سلندرات" أو "6 سلندرات" = quantity: 6
    - "سبع سلندرات" أو "7 سلندرات" = quantity: 7
    - "تمن سلندرات" أو "8 سلندرات" = quantity: 8
    
    للاكسات (كود 05):
    - "اكس" أو "اكس واحد" = quantity: 1
    - "اكسين" أو "اتنين اكس" = quantity: 2
    - "تلات اكسات" أو "3 اكسات" = quantity: 3
    - "اربع اكسات" أو "4 اكسات" = quantity: 4
    - "خمس اكسات" أو "5 اكسات" = quantity: 5
    
    ⚠️ قواعد تحويل الوقت (مهم جداً - detected_duration يجب أن يكون بالدقائق):
    ⚠️⚠️ مهم جداً: افصل رقم الكود عن الوقت! مثلاً:
    - "رقم خمسة نص ساعة" = كود 05 + 30 دقيقة (ليس 5.5 ساعة!)
    - "كود اتناشر نص ساعة" = كود 12 + 30 دقيقة (ليس 12.5 ساعة!)
    - "كود تلاتة ساعة" = كود 03 + 60 دقيقة
    
    - "90 دقيقة" = 90 (دقائق)
    - "60 دقيقة" = 60 (دقائق)
    - "45 دقيقة" = 45 (دقائق)
    - "30 دقيقة" = 30 (دقائق)
    - "20 دقيقة" = 20 (دقائق)
    - "15 دقيقة" = 15 (دقائق)
    - "ساعة" = 60 (دقائق)
    - "ساعة ونص" أو "ساعة ونصف" = 90 (دقائق)
    - "ساعتين" أو "ساعتان" = 120 (دقائق)
    - "ساعتين ونص" أو "ساعتين ونصف" = 150 (دقائق)
    - "3 ساعات" أو "ثلاث ساعات" = 180 (دقائق)
    - "نصف ساعة" أو "نص ساعة" = 30 (دقائق) ⚠️ مهم!
    - "ثلث ساعة" أو "تلت ساعة" أو "تلت ساعه" = 20 (دقائق) ⚠️ مهم!
    - "ربع ساعة" = 15 (دقائق)
    - "ثلاث أرباع ساعة" أو "تلات ارباع ساعة" = 45 (دقائق)
    
    لكل عطل استخرج:
    1. كود العطل (01-09) من القائمة
    2. الوقت المستغرق (detected_duration بالدقائق دائماً!)
    3. للأكواد 03 و 05: استخرج العدد (عدد السلندرات/الاكسات)
    4. الحالة: "Excellent" (ضمن الوقت), "Late" (تأخير), "Critical" (تأخير كبير), "Variable" (مفتوح)
    
    ${faultRules}

    مثال - لو الفني قال "ضبط ألوان مع الجودة لمدة ساعتين وتغيير 4 سلندرات لمدة ساعتين":
    {
        "faults": [
            {
                "fault_code": "04",
                "fault_name": "التوقف لمراجعة الالوان والبيانات والمقاسات مع الجودة",
                "detected_duration": 120,
                "quantity": 1,
                "standard_duration": 15,
                "time_difference": 105,
                "status": "Critical",
                "score": 20,
                "ai_summary": "تأخير 105 دقيقة في مراجعة الألوان مع الجودة"
            },
            {
                "fault_code": "03",
                "fault_name": "التوقف لصنفرة خبطات في السلندر",
                "detected_duration": 120,
                "quantity": 4,
                "standard_duration": 120,
                "time_difference": 0,
                "status": "Excellent",
                "score": 100,
                "ai_summary": "تم صنفرة 4 سلندرات في الوقت المسموح"
            }
        ]
    }
    
    ⚠️ لا تفصل "ضبط ألوان مع الجودة" إلى عطلين! هو عطل واحد (كود 04)
    ⚠️ يجب إرجاع JSON صالح فقط.
    ⚠️ إذا ذُكر عطل واحد فقط، أرجعه داخل مصفوفة "faults".
    ⚠️ إذا لم يُذكر أي عطل، أرجع: { "faults": [] }
    `;

    try {
        const primaryAnalyze = async () => {
            const completion = await reasoningClient.chat.completions.create({
                model: "x-ai/grok-beta",
                messages: [
                    { role: "system", content: "You are a Factory Supervisor Agent. Response must be valid JSON only." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2
            });
        };

        const fallbackAnalyze = async () => {
            console.log('⚠️ Grok unavailable, using Gemini Fallback...');
            const completion = await reasoningClient.chat.completions.create({
                model: "google/gemini-flash-1.5",
                messages: [
                    { role: "system", content: "Return JSON only." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });
        };

        const result = await executeWithFallback(
            primaryAnalyze,
            fallbackAnalyze,
            'Performance Analysis',
            3
        );

        if (!result) {
            console.error("❌ All AI analysis attempts failed");
            return { faults: [] };
        }

        // Handle both old format (single fault) and new format (faults array)
        let faults = [];
        if (result.faults && Array.isArray(result.faults)) {
            faults = result.faults;
        } else if (result.fault_code) {
            // Old format - single fault, convert to array
            faults = [result];
        }

        // Process each fault
        faults = faults.map(fault => {
            // Override fault_name with our approved Arabic names if code exists
            if (fault.fault_code && faultNamesByCode[fault.fault_code]) {
                fault.fault_name = faultNamesByCode[fault.fault_code];
            }

            // IMPORTANT: Validate quantity for per-unit faults
            // If quantity is undefined/null/0, it means technician didn't specify a count
            // For per-unit faults, we should use the default value instead of AI guessing
            let quantity = fault.quantity;
            const isPerUnitFault = perUnitFaults[fault.fault_code];

            if (isPerUnitFault) {
                // Log what AI extracted for debugging
                console.log(`   🔢 Fault ${fault.fault_code}: AI extracted quantity = ${fault.quantity || 'undefined'}`);

                // If quantity is undefined, null, 0, or wasn't explicitly mentioned,
                // set it to 1 so defaultIfNoQuantity kicks in
                if (!quantity || quantity <= 0) {
                    quantity = 1;
                    console.log(`   ⚠️ No quantity specified for Code ${fault.fault_code}, using default (1 unit)`);
                }
            } else {
                quantity = quantity || 1;
            }

            // Calculate extra time (overage beyond standard)
            const extraTimeData = calculateExtraTime(fault.fault_code, fault.detected_duration, quantity, orderCount);
            fault.extraTime = extraTimeData.extraTime;
            fault.countsPenalty = extraTimeData.countsPenalty;
            fault.extraTimeReason = extraTimeData.reason;
            fault.allowedTime = extraTimeData.allowedTime;
            fault.quantity = quantity; // Store the validated quantity

            console.log(`   📌 Fault ${fault.fault_code}: Duration=${fault.detected_duration}min, Qty=${quantity}, Allowed=${fault.allowedTime}min, Delay=${fault.extraTime}min`);

            return fault;
        });

        console.log(`📊 AI detected ${faults.length} fault(s) in transcript`);
        return faults;

    } catch (error) {
        console.error("❌ Analysis Error:", error.message);
        // Fallback - return empty array
        return [];
    }
}

// 4. Calculate Extra Time (Delay) for a fault
// This calculates how much time OVER the allowed standard was spent
// Used for performance evaluation, NOT for shift deduction
// For per-unit faults (03, 05), quantity must be provided
// orderCount: Number of active orders/targets (multiplies time for specific faults)
function calculateExtraTime(faultCode, detectedDuration, quantity = 1, orderCount = 1) {
    let standard = standardDurations[faultCode] || 0;

    // List of faults that multiply by Order Count (per order)
    const perOrderFaults = ["01", "02", "04", "07", "08", "11"];

    // For variable faults (08, 09), no delay is counted
    if (standard === 0) {
        return {
            extraTime: 0,
            allowedTime: 0,
            countsPenalty: false,
            reason: "وقت مفتوح - لا يُحسب تأخير"
        };
    }

    // Apply Order Count Multiplier for specific faults
    if (perOrderFaults.includes(faultCode)) {
        // Example: Code 01 (30 min) * 2 Orders = 60 min allowed
        standard = standard * Math.max(1, orderCount);
    }

    // For per-unit faults (03, 05, 06, 12), multiply by quantity
    // Exception: If quantity not specified (=1) and defaultIfNoQuantity exists, use the default × orderCount
    if (perUnitFaults[faultCode]) {
        const faultConfig = perUnitFaults[faultCode];

        // Check if quantity was NOT specified (default 1) AND this fault has a default fallback
        if (quantity <= 1 && faultConfig.defaultIfNoQuantity) {
            // Use the fixed default time (NOT multiplied by orderCount)
            // defaultIfNoQuantity is already the total allowed time when quantity not specified
            standard = faultConfig.defaultIfNoQuantity;
        } else {
            // Normal calculation: perUnit × quantity
            standard = faultConfig.perUnit * quantity;
        }
    }

    // Calculate delay (time over allowed)
    const delay = Math.max(0, detectedDuration - standard);

    return {
        extraTime: delay,
        allowedTime: standard,
        countsPenalty: delay > 0,
        reason: delay > 0
            ? `تأخير ${delay} دقيقة عن الوقت المسموح (${standard} دقيقة)`
            : `ضمن الوقت المسموح (${standard} دقيقة)`
    };
}

// 5. Calculate Shift Metrics for a technician
// Aggregates all faults for a shift and calculates:
// - Total allowed fault time (deducted from shift) - ONLY the standard/allowed time
// - Total delay time (extra time over allowed, for evaluation only)
// - Effective working time remaining
// Parameters:
//   evaluations: Array of fault evaluations
//   date: Optional date string to determine shift duration (Friday = 12h, others = 8h)
//   orderCount: Number of active orders (for fault time multiplication)
function calculateShiftMetrics(evaluations, date = null, orderCount = 1) {
    // Get correct shift duration based on day (Friday = 720 min, others = 480 min)
    const SHIFT_DURATION = date ? getShiftDuration(date) : 480;

    let totalAllowedFaultTime = 0;  // Only allowed time (deducted from shift)
    let totalDelayTime = 0;         // Only delays over allowed time (for evaluation)

    evaluations.forEach(evaluation => {
        const faultCode = evaluation.FaultCode || evaluation.fault_code;
        const detectedDuration = evaluation.DetectedDuration || evaluation.detected_duration || 0;
        const quantity = evaluation.Quantity || evaluation.quantity || 1;

        // Calculate allowed time and delay for this fault
        const delayData = calculateExtraTime(faultCode, detectedDuration, quantity, orderCount);

        // Add ONLY the allowed time to total fault time (for shift deduction)
        // For variable faults (08, 09), add the full detected duration
        if (delayData.allowedTime === 0) {
            // Variable fault (maintenance, power cut) - add full duration
            totalAllowedFaultTime += detectedDuration;
        } else {
            // FIX: Use the MINIMUM of (actual time, allowed time)
            // If technician finished faster than allowed, only deduct actual time
            const timeToDeduct = Math.min(delayData.allowedTime, detectedDuration);
            totalAllowedFaultTime += timeToDeduct;
        }

        // Add delay (extra time over allowed) for evaluation
        if (delayData.countsPenalty) {
            totalDelayTime += delayData.extraTime;
        }
    });

    // Calculate effective working time (shift - allowed fault time only)
    // Delay does NOT reduce effective working time
    const effectiveWorkingTime = Math.max(0, SHIFT_DURATION - totalAllowedFaultTime);

    return {
        shiftDuration: SHIFT_DURATION,
        totalFaultTime: totalAllowedFaultTime,  // Only allowed time (for backward compatibility)
        totalDelayTime,                          // Total delay over allowed time (for evaluation only)
        effectiveWorkingTime,                    // Time remaining for actual work
        effectiveWorkingHours: (effectiveWorkingTime / 60).toFixed(2),
        totalDelayHours: (totalDelayTime / 60).toFixed(2)
    };
}

// 5b. Calculate Shift Metrics using STORED values from database
// This uses the StandardDuration and ExtraTime already calculated and stored
// instead of recalculating them (which caused bugs with quantity-based faults)
// Parameters:
//   evaluations: Array of stored evaluations from database
//   date: Optional date string to determine shift duration (Friday = 12h, others = 8h)
function calculateShiftMetricsFromStored(evaluations, date = null) {
    // Get correct shift duration based on day (Friday = 720 min, others = 480 min)
    const SHIFT_DURATION = date ? getShiftDuration(date) : 480;

    let totalAllowedFaultTime = 0;  // Sum of StandardDuration (allowed time)
    let totalDelayTime = 0;         // Sum of ExtraTime (delay)

    evaluations.forEach(evaluation => {
        const standardDuration = evaluation.StandardDuration || 0;
        const extraTime = evaluation.ExtraTime || 0;
        const faultCode = evaluation.FaultCode || evaluation.fault_code;

        // For variable faults (09, 10) with StandardDuration = 0, use full DetectedDuration
        if (standardDuration === 0 && (faultCode === '09' || faultCode === '10')) {
            totalAllowedFaultTime += evaluation.DetectedDuration || 0;
        } else {
            // FIX: Use the MINIMUM of (actual time, allowed time)
            // If technician finished faster than allowed, only deduct actual time
            const detectedDuration = evaluation.DetectedDuration || 0;
            const timeToDeduct = Math.min(standardDuration, detectedDuration);
            totalAllowedFaultTime += timeToDeduct;
        }

        totalDelayTime += extraTime;
    });

    // Calculate effective working time (shift - allowed fault time only)
    const effectiveWorkingTime = Math.max(0, SHIFT_DURATION - totalAllowedFaultTime);

    console.log(`   📊 Stored Metrics Calculation (Shift Duration: ${SHIFT_DURATION} mins):`);
    console.log(`      Total Allowed Fault Time: ${totalAllowedFaultTime} mins`);
    console.log(`      Total Delay Time: ${totalDelayTime} mins`);
    console.log(`      Effective Working Time: ${effectiveWorkingTime} mins`);

    return {
        shiftDuration: SHIFT_DURATION,
        totalFaultTime: totalAllowedFaultTime,
        totalDelayTime,
        effectiveWorkingTime,
        effectiveWorkingHours: (effectiveWorkingTime / 60).toFixed(2),
        totalDelayHours: (totalDelayTime / 60).toFixed(2)
    };
}

// 6. Get Performance Rating based on delay time
function getPerformanceRating(delayMinutes) {
    if (delayMinutes <= 30) return { rating: "ممتاز", score: 100 };
    if (delayMinutes <= 60) return { rating: "جيد", score: 80 };
    if (delayMinutes <= 120) return { rating: "متوسط", score: 60 };
    return { rating: "ضعيف", score: 40 };
}

// 7. Format time in minutes to readable Arabic format
function formatShiftTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins} دقيقة`;
    if (mins === 0) return `${hours} ساعة`;
    return `${hours} ساعة و ${mins} دقيقة`;
}


function calculateOverallScore(target, actualAchievement, allowedFaultTime = 0, delayTime = 0, shiftDuration = 480) {
    // Step 1: Calculate actual working time (delay is NOT deducted)
    const actualWorkingTime = Math.max(0, shiftDuration - allowedFaultTime);

    // Step 2: Calculate adjusted target
    const workingTimeRatio = actualWorkingTime / shiftDuration;
    const adjustedTarget = target * workingTimeRatio;

    // Step 3: Calculate achievement percentage
    let achievementPercentage = 0;
    if (adjustedTarget > 0) {
        achievementPercentage = (actualAchievement / adjustedTarget) * 100;
    } else if (actualAchievement > 0) {
        achievementPercentage = 100; // If no target but has achievement, consider it 100%
    }

    // Step 4: Determine final score
    let overallScore = Math.round(achievementPercentage);
    if (overallScore >= 100) {
        overallScore = 100; // Cap at 100%
    }

    // Get delay rating (for display only)
    const delayRating = getPerformanceRating(delayTime);

    // Determine status based on score
    let status = "ضعيف";
    let statusEn = "Needs Improvement";
    if (overallScore >= 100) {
        status = "ممتاز";
        statusEn = "Excellent";
    } else if (overallScore >= 80) {
        status = "جيد جداً";
        statusEn = "Very Good";
    } else if (overallScore >= 60) {
        status = "جيد";
        statusEn = "Good";
    } else if (overallScore >= 40) {
        status = "متوسط";
        statusEn = "Average";
    }

    return {
        // Main score
        overallScore,
        status,
        statusEn,

        // Target calculations
        originalTarget: target,
        adjustedTarget: Math.round(adjustedTarget * 10) / 10,
        actualAchievement,
        achievementPercentage: Math.round(achievementPercentage * 10) / 10,

        // Time calculations
        shiftDuration,
        allowedFaultTime,
        delayTime,
        actualWorkingTime,
        workingTimeRatio: Math.round(workingTimeRatio * 100),

        // Delay info (for display only, doesn't affect score if target is met)
        delayRating: delayRating.rating,

        // Message
        message: overallScore >= 100
            ? "التارجت متحقق بالكامل ✅"
            : `نسبة الإنجاز ${Math.round(achievementPercentage)}% من التارجت المعدل`
    };
}

// AI-Powered Rollover Analysis
async function analyzeShiftRollover(shiftData) {
    const { shift, date, tasks, nextShift } = shiftData;

    // 1. Prepare Prompt (Standard)
    const tasksSummary = tasks.map(t => {
        const diff = t.achievement - t.targetAmount;
        return `- taskId: ${t.taskId}
  المنتج: ${t.productName}
  التارجت: ${t.targetAmount} ${t.targetUnit}
  الإنجاز: ${t.achievement} ${t.targetUnit}
  الفرق: ${diff >= 0 ? '+' : ''}${diff} ${t.targetUnit}
  معدل الإنتاج: ${t.productionRate} ${t.targetUnit}/ساعة`;
    }).join('\n\n');

    const prompt = `أنت مشرف مصنع ذكي. حلل نتائج الوردية وقرر الـ Rollover.

 بيانات الوردية الحالية:
- التاريخ: ${date}
- الوردية: ${shift}

 المهام والإنجازات:
${tasksSummary}

 الورديات المتاحة للـ Cascade:
🔹 الوردية التالية: ${nextShift.name} (${nextShift.date})
${nextShift.tasks?.length ? nextShift.tasks.map(t => `   - ${t.productName}: ${t.targetAmount} ${t.targetUnit}`).join('\n') : '   (لا توجد مهام)'}

 قاعدة أساسية: لا تتجاوز 8 ساعات في أي وردية! 

 القواعد:
1. العجز (Shortage) -> "rollover": رحّل الكمية المتبقية للوردية التالية.
2. الفائض (Surplus) -> "balance": اخصم الكمية الزائدة من مهام المستقبل (Extinguish Queue).

أرجع JSON فقط:
{
  "decisions": [
    {
      "taskId": number,
      "productName": string,
      "action": "rollover" | "balance" | "none",
      "amountToTransfer": number,
      "timeToTransfer": number,
      "deductFromNextShift": null, 
      "reason": "string"
    }
  ],
  "summary": "ملخص عربي"
}`;

    try {
        const primaryAnalyze = async () => {
            const completion = await reasoningClient.chat.completions.create({
                model: "x-ai/grok-4.1-fast",
                messages: [
                    { role: "system", content: "You are a Factory Supervisor Agent. Response must be valid JSON only. Do not use Markdown." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2
            });

            const content = completion.choices[0].message.content;
            return JSON.parse(content);
        };

        const fallbackAnalyze = async () => {
            const completion = await reasoningClient.chat.completions.create({
                model: "google/gemini-3-flash-preview",
                messages: [
                    { role: "system", content: "Return valid JSON only." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content;
            
            // Cleanup Markdown if present
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
        };

        // Execute with Retry
        let result = await executeWithFallback(
            primaryAnalyze,
            fallbackAnalyze,
            'Rollover Agent (Grok 4.1)',
            2
        );

        if (!result) throw new Error('Agent returned empty response');

        // Structure Validation
        if (!result.decisions || !Array.isArray(result.decisions)) {
            if (result.result && result.result.decisions) {
                result = result.result;
            } else if (result.decisions && !Array.isArray(result.decisions)) {
                result.decisions = [result.decisions];
            } else {
                throw new Error('Invalid JSON structure from Agent');
            }
        }

        console.log('✅ Agent Decision Complete:', result.summary);
        return result;

    } catch (error) {
        console.error('❌ Switching to OFFLINE MODE:', error.message);
        return offlineRolloverAnalysis(shiftData);
    }
}

// OFFLINE FALLBACK
// Calculates rollover using simple math if AI is down
function offlineRolloverAnalysis(shiftData) {
    const { tasks } = shiftData;
    const decisions = [];
    const summaryParts = [];

    tasks.forEach(task => {
        const diff = task.achievement - task.targetAmount;
        const tolerance = 5; 

        // CASE 1: Shortage (Rollover)
        if (diff < -tolerance) {
            const amount = Math.abs(diff);
            
            // 🔧 FIX: Better Rate Estimation
            // 1. Use provided rate
            // 2. Or calculate from target (assuming 8h shift)
            // 3. Or fallback to 100 (never 1)
            let rate = task.productionRate;
            if (!rate || rate <= 0) {
                rate = (task.targetAmount > 0) ? (task.targetAmount / 8) : 100;
            }
            
            const time = amount / rate;
            
            decisions.push({
                taskId: task.taskId,
                productName: task.productName,
                action: 'rollover',
                amountToTransfer: amount,
                timeToTransfer: time,
                reason: `Offline: Shortage of ${amount} detected`
            });
            summaryParts.push(`ترحيل ${amount} من ${task.productName}`);
        } 
        // CASE 2: Surplus (Balance)
        else if (diff > tolerance) {
            const amount = Math.abs(diff);
            
            let rate = task.productionRate;
            if (!rate || rate <= 0) {
                rate = (task.targetAmount > 0) ? (task.targetAmount / 8) : 100;
            }
            const time = amount / rate;
            
            decisions.push({
                taskId: task.taskId,
                productName: task.productName,
                action: 'balance',
                amountToTransfer: amount,
                timeToTransfer: time,
                reason: `Offline: Surplus of ${amount} detected`
            });
            summaryParts.push(`خصم فائض ${amount} من ${task.productName}`);
        }
        else {
            decisions.push({
                taskId: task.taskId,
                productName: task.productName,
                action: 'none',
                amountToTransfer: 0,
                timeToTransfer: 0,
                reason: 'Offline: Target met'
            });
        }
    });

    return {
        decisions: decisions,
        cascadeChain: [],
        summary: summaryParts.length > 0 ? summaryParts.join('، ') : 'تم تحقيق المستهدف',
        fallback: true
    };
}

module.exports = {
    transcribeAudio,
    analyzePerformance,
    calculateExtraTime,
    calculateShiftMetrics,
    calculateShiftMetricsFromStored,
    getPerformanceRating,
    formatShiftTime,
    calculateOverallScore,
    faultNamesByCode,
    standardDurations,
    perUnitFaults,
    SHIFT_CONFIG,
    FRIDAY_SHIFT_CONFIG,
    getShiftConfig,
    getShiftDuration,
    extractJobOrderData,
    analyzeShiftRollover,
    offlineRolloverAnalysis,
};