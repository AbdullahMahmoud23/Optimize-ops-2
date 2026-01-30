import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../config";

function AdminAssignTask() {
    const { token } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    // File upload states
    const [uploadedFile, setUploadedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // Extraction states
    const [extractedData, setExtractedData] = useState(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionError, setExtractionError] = useState(null);

    // Manual entry states
    const [amount, setAmount] = useState('');
    const [unit, setUnit] = useState('كيلو');
    const [description, setDescription] = useState('');
    const [hours, setHours] = useState(''); // New state for hours
    const [selectedShift, setSelectedShift] = useState(null); // null = Auto-distribute

    // Targets states
    const [generatedTargets, setGeneratedTargets] = useState(null);

    // Submission states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');

    // Queue states for multiple job orders
    const [orderQueue, setOrderQueue] = useState([]);

    // File handling
    const handleFileSelect = (file) => {
        if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
            setUploadedFile(file);
            setExtractionError(null);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreview(e.target.result);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
            setCurrentStep(2);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const removeFile = () => {
        setUploadedFile(null);
        setFilePreview(null);
        setExtractedData(null);
        setExtractionError(null);
        setGeneratedTargets(null);
        setCurrentStep(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Generate targets from manual entry with intelligent distribution
    const handleGenerateTargets = () => {
        if (!amount || parseFloat(amount) <= 0) {
            setExtractionError('Please enter a valid amount first');
            return;
        }

        const total = parseFloat(amount);
        const totalHours = parseFloat(hours) || 0;

        // Detect Friday (day 5) - Friday has only 2 shifts (12 hours each)
        const isFriday = new Date(date).getDay() === 5;
        const SHIFT_DURATION = isFriday ? 12 : 8;
        const shiftNames = isFriday
            ? ['First Shift', 'Second Shift']
            : ['First Shift', 'Second Shift', 'Third Shift'];

        // If no hours provided, use even distribution
        if (!totalHours || totalHours <= 0) {
            const perShift = Math.round(total / shiftNames.length);
            setGeneratedTargets({
                shifts: shiftNames.map((name, i) => ({
                    name,
                    target: i === shiftNames.length - 1 ? total - (perShift * (shiftNames.length - 1)) : perShift,
                    hours: null,
                    utilization: null
                })),
                total: total,
                unit: unit,
                distributionType: 'even',
                isFriday: isFriday
            });
        } else {
            // Intelligent time-based distribution
            const productionRate = total / totalHours; // units per hour
            let remainingHours = totalHours;
            let remainingQuantity = total;
            const distribution = [];

            for (const shiftName of shiftNames) {
                if (remainingHours <= 0) {
                    distribution.push({ name: shiftName, target: 0, hours: 0, utilization: 0 });
                    continue;
                }

                const hoursToUse = Math.min(remainingHours, SHIFT_DURATION);
                const quantityForShift = Math.round(hoursToUse * productionRate);
                const utilization = Math.round((hoursToUse / SHIFT_DURATION) * 100);

                distribution.push({
                    name: shiftName,
                    target: quantityForShift,
                    hours: hoursToUse.toFixed(2),
                    utilization: utilization
                });

                remainingHours -= hoursToUse;
                remainingQuantity -= quantityForShift;
            }

            // Handle rounding remainder
            if (remainingQuantity > 0 && distribution.length > 0) {
                const lastWithTarget = distribution.filter(d => d.target > 0).pop();
                if (lastWithTarget) lastWithTarget.target += remainingQuantity;
            }

            setGeneratedTargets({
                shifts: distribution,
                total: total,
                unit: unit,
                totalHours: totalHours,
                distributionType: 'time-based',
                isFriday: isFriday
            });
        }

        setExtractionError(null);
        setCurrentStep(3);
    };

    // Add current order to queue
    const handleAddToQueue = () => {
        if (!amount || parseFloat(amount) <= 0) {
            setExtractionError('Please enter a valid amount first');
            return;
        }

        const newOrder = {
            id: Date.now(),
            description: description || 'Unnamed Order',
            amount: parseFloat(amount),
            unit: unit,
            hours: parseFloat(hours) || 0,
            order_number: extractedData?.order_number || null
        };

        setOrderQueue(prev => [...prev, newOrder]);

        // Reset form for next order
        setAmount('');
        setDescription('');
        setHours('');
        setUploadedFile(null);
        setFilePreview(null);
        setExtractedData(null);
        setGeneratedTargets(null);
        setCurrentStep(1);
        setExtractionError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Remove order from queue
    const removeFromQueue = (id) => {
        setOrderQueue(prev => prev.filter(order => order.id !== id));
    };

    // Calculate queue totals and preview distribution
    const getQueuePreview = () => {
        if (orderQueue.length === 0) return null;

        const totalQuantity = orderQueue.reduce((sum, o) => sum + o.amount, 0);
        const rawTotalHours = orderQueue.reduce((sum, o) => sum + o.hours, 0);

        // Detect Friday (day 5) - Friday has only 2 shifts (12 hours each)
        const isFriday = new Date(date).getDay() === 5;
        const SHIFT_DURATION = isFriday ? 12 : 8;
        const shifts = isFriday
            ? ['First Shift', 'Second Shift']
            : ['First Shift', 'Second Shift', 'Third Shift'];

        // Distribute orders across shifts (FIFO)
        const distribution = shifts.map(name => ({ name, orders: [], totalHours: 0, totalAmount: 0 }));
        let currentShiftIndex = 0;
        let remainingShiftHours = SHIFT_DURATION;

        for (const order of orderQueue) {
            let remainingOrderHours = order.hours;
            const productionRate = order.amount / order.hours;

            while (remainingOrderHours > 0 && currentShiftIndex < shifts.length) {
                const hoursToAssign = Math.min(remainingOrderHours, remainingShiftHours);
                const amountToAssign = Math.round(hoursToAssign * productionRate);

                if (hoursToAssign > 0) {
                    distribution[currentShiftIndex].orders.push({
                        description: order.description,
                        amount: amountToAssign,
                        hours: hoursToAssign
                    });
                    distribution[currentShiftIndex].totalHours += hoursToAssign;
                    distribution[currentShiftIndex].totalAmount += amountToAssign;
                }

                remainingOrderHours -= hoursToAssign;
                remainingShiftHours -= hoursToAssign;

                if (remainingShiftHours <= 0) {
                    currentShiftIndex++;
                    remainingShiftHours = SHIFT_DURATION;
                }
            }
        }

        // Calculate actual total hours used (from distribution, capped at shift limits)
        const actualTotalHours = distribution.reduce((sum, shift) => sum + shift.totalHours, 0);

        return { distribution, totalQuantity, totalHours: actualTotalHours, rawTotalHours };
    };

    // Extract data from uploaded file using AI
    const handleExtract = async () => {
        if (!uploadedFile) {
            setExtractionError('Please upload a file first');
            return;
        }

        setIsExtracting(true);
        setExtractionError(null);

        try {
            const formData = new FormData();
            formData.append('file', uploadedFile);

            const response = await fetch(`${API_URL}/api/admin/tasks/extract`, {
                method: 'POST',
                headers: {
                    'Authorization': token || ''
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.data) {
                // Set extracted data to form fields
                setExtractedData(result.data);

                // Map new API fields to state
                if (result.data.quantity) setAmount(String(result.data.quantity));
                if (result.data.product_name) setDescription(result.data.product_name);
                if (result.data.hours) setHours(String(result.data.hours));

                // Keep unit default or from API if provided
                if (result.data.unit) setUnit(result.data.unit);

                setCurrentStep(2);
            } else {
                setExtractionError(result.error || result.message || 'Failed to extract data');
            }
        } catch (err) {
            console.error('Extraction error:', err);
            setExtractionError('Connection error. Please try again.');
        } finally {
            setIsExtracting(false);
        }
    };

    // Submit handler
    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setSubmissionStatus('error');
            setSubmissionMessage('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);
        setSubmissionStatus(null);

        try {
            const response = await fetch(`${API_URL}/api/admin/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token || ''
                },
                body: JSON.stringify({
                    date,
                    amount: parseFloat(amount),
                    unit,
                    description: description || '',
                    hours: hours ? parseFloat(hours) : 0, // Send hours to backend
                    shift: selectedShift, // Send selected shift or null for all shifts
                    order_number: extractedData?.order_number || null // Send order number from extraction
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSubmissionStatus('success');

                // Format response for display
                let message = 'Target assigned successfully!';
                if (data.distribution && data.distribution.length > 0) {
                    message = `Target distributed across ${data.distribution.length} shift(s)!`;

                    // Transform backend distribution to frontend format
                    setGeneratedTargets({
                        shifts: data.distribution.map(d => ({
                            name: d.shift,
                            target: d.amount,
                            hours: d.hours,
                            utilization: d.utilizationPercent ? parseFloat(d.utilizationPercent) : null
                        })),
                        total: data.summary?.totalQuantity || parseFloat(amount),
                        unit: unit,
                        totalHours: data.summary?.totalHours || null,
                        distributionType: data.summary?.totalHours ? 'time-based' : 'even'
                    });
                }

                setSubmissionMessage(message);

                // Reset after success
                setTimeout(() => {
                    setAmount('');
                    setDescription('');
                    setHours(''); // Reset hours
                    setUploadedFile(null);
                    setFilePreview(null);
                    setGeneratedTargets(null);
                    setCurrentStep(1);
                    setSubmissionStatus(null);
                }, 3000);
            } else {
                setSubmissionStatus('error');
                setSubmissionMessage(data.error || 'Failed to assign target');
            }
        } catch (err) {
            console.error('Error:', err);
            setSubmissionStatus('error');
            setSubmissionMessage('Connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit all queued orders
    const handleSubmitQueue = async () => {
        if (orderQueue.length === 0) {
            setSubmissionStatus('error');
            setSubmissionMessage('Please add orders to the queue first');
            return;
        }

        setIsSubmitting(true);
        setSubmissionStatus(null);

        try {
            // Submit each order SEQUENTIALLY with delay to prevent race condition
            // Each order needs to wait for the previous one to be fully processed
            const results = [];
            for (let i = 0; i < orderQueue.length; i++) {
                const order = orderQueue[i];

                const response = await fetch(`${API_URL}/api/admin/tasks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token || ''
                    },
                    body: JSON.stringify({
                        date,
                        amount: order.amount,
                        unit: order.unit,
                        description: order.description,
                        hours: order.hours,
                        shift: selectedShift, // null = auto-distribute
                        order_number: order.order_number || null
                    })
                });
                const data = await response.json();
                results.push({ order, response, data });

                // Wait 500ms before next order to ensure database is updated
                // This prevents race condition where orders don't see each other's capacity
                if (i < orderQueue.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const successCount = results.filter(r => r.response.ok).length;

            if (successCount === orderQueue.length) {
                setSubmissionStatus('success');
                setSubmissionMessage(`All ${successCount} orders distributed successfully!`);

                // Clear queue after success
                setTimeout(() => {
                    setOrderQueue([]);
                    setGeneratedTargets(null);
                    setCurrentStep(1);
                    setSubmissionStatus(null);
                }, 3000);
            } else {
                setSubmissionStatus('error');
                setSubmissionMessage(`${successCount}/${orderQueue.length} orders succeeded`);
            }
        } catch (err) {
            console.error('Error:', err);
            setSubmissionStatus('error');
            setSubmissionMessage('Connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header Section Card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
                    {/* Header */}
                    <header className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium mb-1">
                                <span className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-xs">📋</span>
                                Factory Dashboard
                            </div>
                            <h1 className="text-3xl font-bold text-indigo-600">Shift Planning</h1>
                            <p className="text-gray-500 mt-1">Upload job orders, extract data automatically, and distribute targets across 3 shifts</p>
                        </div>
                    </header>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-4">
                        {[
                            { num: 1, label: 'Upload' },
                            { num: 2, label: 'Review' },
                            { num: 3, label: 'Targets' }
                        ].map((step, i) => (
                            <div key={step.num} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${currentStep > step.num
                                    ? 'bg-green-500 text-white'
                                    : currentStep === step.num
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-200 text-gray-500'
                                    }`}>
                                    {currentStep > step.num ? '✓' : step.num}
                                </div>
                                <div className="text-sm">
                                    <span className="text-gray-400 text-xs uppercase">Step {step.num}</span>
                                    <p className={`font-medium ${currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {step.label}
                                    </p>
                                </div>
                                {i < 2 && <div className="w-12 h-0.5 bg-gray-200 mx-2" />}
                            </div>
                        ))}
                    </div>

                    {/* Status Badges */}
                    <div className="flex gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${uploadedFile ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            Upload: {uploadedFile ? 'Uploaded' : 'Pending'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${generatedTargets ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            Review: {generatedTargets ? 'Complete' : 'Pending'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${submissionStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            Targets: {submissionStatus === 'success' ? 'Assigned' : 'Pending'}
                        </span>
                    </div>
                </div>

                {/* Status Message */}
                {submissionStatus && (
                    <div className={`p-4 rounded-xl ${submissionStatus === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {submissionMessage}
                    </div>
                )}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Left Column - Job Order Upload & Extraction Review */}
                    <div className="space-y-6">

                        {/* Job Order Upload */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Job Order Upload</h2>
                                    <p className="text-sm text-gray-500 mt-1">Send a PDF or photo.</p>
                                </div>
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                                    Vision Extraction
                                </span>
                            </div>

                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`space-y-3 border-2 border-dashed rounded-xl p-4 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
                                    }`}
                            >
                                {/* Drag & Drop Text */}
                                <p className="text-center text-sm text-gray-500 font-medium">
                                    Drag & drop your file here
                                </p>

                                {/* File Input Row */}
                                <div className="flex items-center gap-0">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-l-lg hover:bg-blue-700 transition"
                                    >
                                        Choose file
                                    </button>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 border-y border-r border-gray-200 bg-white py-2.5 px-4 text-gray-400 text-sm rounded-r-lg cursor-pointer hover:bg-gray-50 transition"
                                    >
                                        {uploadedFile ? uploadedFile.name : 'No file chosen'}
                                    </div>
                                </div>

                                {/* Action Row */}
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handleExtract}
                                        disabled={!uploadedFile || isExtracting}
                                        className="px-5 py-2.5 bg-blue-700 text-white text-sm rounded-lg font-medium hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isExtracting ? '⏳ Extracting...' : 'Upload & Extract'}
                                    </button>
                                    <p className="text-xs text-gray-400">Supported: PDF, JPG, PNG, WEBP</p>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleFileSelect(e.target.files[0])}
                                className="hidden"
                            />
                        </div>

                        {/* Extraction Review */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Extraction Review</h2>
                                    <p className="text-sm text-gray-500">Review and edit extracted data before adding to queue</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddToQueue}
                                        disabled={!amount || !hours}
                                        className="px-4 py-2 bg-green-600 text-white border border-green-600 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        + Add to Queue
                                    </button>
                                    <button
                                        onClick={handleGenerateTargets}
                                        disabled={!amount}
                                        className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg font-medium hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Preview
                                    </button>
                                </div>
                            </div>

                            {extractionError ? (
                                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                                        <span className="text-red-500 text-xl">⚠️</span>
                                    </div>
                                    <p className="text-red-600 font-medium">{extractionError}</p>
                                    <button
                                        onClick={() => setExtractionError(null)}
                                        className="mt-3 text-sm text-indigo-600 hover:underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            ) : generatedTargets ? (
                                <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                                        <span className="text-green-500 text-xl">✓</span>
                                    </div>
                                    <p className="text-green-700 font-medium">Targets preview ready!</p>
                                    <p className="text-sm text-green-600 mt-1">
                                        Total: {generatedTargets.total} {generatedTargets.unit} ({generatedTargets.totalHours}h)
                                    </p>
                                </div>
                            ) : (
                                <div className="p-8 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-gray-400 text-xl">📊</span>
                                    </div>
                                    <p className="text-gray-500">Upload and extract a job order, then add to queue</p>
                                </div>
                            )}
                        </div>

                        {/* Queue Panel */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">📋 Order Queue</h2>
                                    <p className="text-sm text-gray-500">Add multiple orders, then assign all at once</p>
                                </div>
                                {orderQueue.length > 0 && (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                        {orderQueue.length} orders
                                    </span>
                                )}
                            </div>

                            {orderQueue.length > 0 ? (
                                <div className="space-y-2">
                                    {orderQueue.map((order, i) => {
                                        // Color palette matching technician's view
                                        const orderColors = [
                                            { bg: 'bg-blue-50', border: 'border-l-4 border-l-blue-500', badge: 'bg-blue-500' },
                                            { bg: 'bg-green-50', border: 'border-l-4 border-l-green-500', badge: 'bg-green-500' },
                                            { bg: 'bg-purple-50', border: 'border-l-4 border-l-purple-500', badge: 'bg-purple-500' },
                                            { bg: 'bg-orange-50', border: 'border-l-4 border-l-orange-500', badge: 'bg-orange-500' },
                                            { bg: 'bg-pink-50', border: 'border-l-4 border-l-pink-500', badge: 'bg-pink-500' },
                                            { bg: 'bg-teal-50', border: 'border-l-4 border-l-teal-500', badge: 'bg-teal-500' },
                                        ];
                                        const color = orderColors[i % orderColors.length];
                                        return (
                                            <div key={order.id} className={`flex justify-between items-center p-3 rounded-lg border border-gray-100 ${color.bg} ${color.border}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${color.badge}`}>
                                                        {i + 1}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800" dir="rtl">{order.description}</p>
                                                        <p className="text-xs text-gray-400">{order.amount} {order.unit} • {order.hours}h</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeFromQueue(order.id)}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Detailed Queue Preview */}
                                    {(() => {
                                        const preview = getQueuePreview();
                                        if (!preview) return null;

                                        // Detect Friday (day 5) - Friday has 2 shifts (12 hours each)
                                        const isFriday = new Date(date).getDay() === 5;
                                        const SHIFT_DURATION = isFriday ? 12 : 8;
                                        const shiftColors = {
                                            'First Shift': { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-700' },
                                            'Second Shift': { bg: 'bg-green-100', bar: 'bg-green-500', text: 'text-green-700' },
                                            'Third Shift': { bg: 'bg-purple-100', bar: 'bg-purple-500', text: 'text-purple-700' }
                                        };
                                        const orderColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

                                        return (
                                            <div className="mt-4 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <p className="text-sm font-bold text-gray-700">📊 Distribution Preview</p>
                                                    <p className="text-xs text-gray-500">{preview.totalHours.toFixed(2)}h total</p>
                                                </div>

                                                {preview.distribution.map((shift, i) => {
                                                    const utilization = (shift.totalHours / SHIFT_DURATION) * 100;
                                                    const color = shiftColors[shift.name];

                                                    return (
                                                        <div key={shift.name} className={`p-3 rounded-lg ${color.bg} border border-opacity-20`}>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className={`text-sm font-semibold ${color.text}`}>{shift.name}</span>
                                                                <span className="text-xs text-gray-600">{shift.totalHours.toFixed(2)}h / {SHIFT_DURATION}h ({utilization.toFixed(0)}%)</span>
                                                            </div>

                                                            {/* Progress bar */}
                                                            <div className="h-2 bg-white rounded-full overflow-hidden mb-2">
                                                                <div className={`h-full ${color.bar} transition-all`} style={{ width: `${Math.min(utilization, 100)}%` }}></div>
                                                            </div>

                                                            {/* Orders in this shift */}
                                                            {shift.orders.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {shift.orders.map((order, j) => (
                                                                        <div key={j} className="flex items-center gap-2 text-xs">
                                                                            <span className={`w-2 h-2 rounded-full ${orderColors[j % orderColors.length]}`}></span>
                                                                            <span className="text-gray-700" dir="rtl">{order.description}</span>
                                                                            <span className="text-gray-400">({order.amount} {unit})</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400">Empty</p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="p-8 bg-gray-50 border border-gray-200 rounded-xl text-center">
                                    <span className="text-3xl">📭</span>
                                    <p className="text-gray-500 mt-2 text-sm">Queue is empty. Extract orders and click "Add to Queue"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Targets Preview & Manual Entry */}
                    <div className="space-y-6">

                        {/* Targets Preview */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">Targets Preview</h2>
                                <span className={`text-xs px-2 py-1 rounded ${orderQueue.length > 0 || generatedTargets?.distributionType === 'time-based'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {orderQueue.length > 0 ? `📋 Queue (${orderQueue.length})` :
                                        generatedTargets?.distributionType === 'time-based' ? '⏱️ Time-based' : 'No data'}
                                </span>
                            </div>

                            {/* Show Queue Preview if queue has orders */}
                            {orderQueue.length > 0 ? (() => {
                                const preview = getQueuePreview();
                                if (!preview) return null;

                                // Detect Friday (day 5) - Friday has 2 shifts (12 hours each)
                                const isFriday = new Date(date).getDay() === 5;
                                const SHIFT_DURATION = isFriday ? 12 : 8;
                                const maxShifts = isFriday ? 2 : 3;

                                return (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-500 mb-2">
                                            {preview.totalHours.toFixed(2)}h total across {Math.min(Math.ceil(preview.totalHours / SHIFT_DURATION), maxShifts)} shift(s)
                                        </p>

                                        {/* Table View */}
                                        <div className="overflow-hidden rounded-lg border border-gray-200">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Shift</th>
                                                        <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Hours</th>
                                                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Orders</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {preview.distribution.map((shift, i) => {
                                                        const utilization = (shift.totalHours / SHIFT_DURATION) * 100;
                                                        const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

                                                        return (
                                                            <tr key={shift.name} className={rowBg}>
                                                                <td className="px-4 py-3">
                                                                    <span className="font-medium text-gray-800">{shift.name}</span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="font-semibold text-gray-700">{shift.totalHours.toFixed(1)}h</span>
                                                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full ${utilization >= 100 ? 'bg-green-500' :
                                                                                    utilization >= 50 ? 'bg-blue-500' :
                                                                                        utilization > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                                                                    }`}
                                                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                                                            ></div>
                                                                        </div>
                                                                        <span className="text-xs text-gray-400">{utilization.toFixed(0)}%</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {shift.orders.length > 0 ? (
                                                                        <div className="space-y-1">
                                                                            {shift.orders.map((order, j) => (
                                                                                <div key={j} className="text-xs" dir="rtl">
                                                                                    <span className="text-gray-700">{order.description}</span>
                                                                                    <span className="text-gray-400 ml-1">({order.amount})</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-300">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-indigo-50 border-t border-indigo-200">
                                                    <tr>
                                                        <td className="px-4 py-2.5 font-semibold text-indigo-700">Total</td>
                                                        <td className="px-4 py-2.5 text-center font-semibold text-indigo-700">{preview.totalHours.toFixed(2)}h</td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-indigo-700">{preview.totalQuantity} {unit}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })() : generatedTargets ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-500 mb-4">
                                        {generatedTargets.distributionType === 'time-based'
                                            ? `Distributed based on ${generatedTargets.totalHours} hours`
                                            : 'Quantity distributed across 3 shifts'}
                                    </p>
                                    {generatedTargets.shifts.map((shift, i) => (
                                        <div key={i} className={`flex justify-between items-center p-3 rounded-lg ${shift.target > 0 ? 'bg-gray-50' : 'bg-gray-100/50'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-700">{shift.name}</span>
                                                {shift.hours && (
                                                    <span className="text-xs text-gray-400">{shift.hours}h ({shift.utilization}%)</span>
                                                )}
                                            </div>
                                            <span className={`font-semibold ${shift.target > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {shift.target} {generatedTargets.unit}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg border border-indigo-200 mt-3">
                                        <span className="text-sm font-medium text-indigo-700">Total</span>
                                        <span className="font-bold text-indigo-700">
                                            {generatedTargets.total} {generatedTargets.unit}
                                            {generatedTargets.totalHours && (
                                                <span className="text-xs text-indigo-500 ml-2">({generatedTargets.totalHours}h)</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                    <span className="text-4xl mb-3">📊</span>
                                    <p className="text-sm text-center">Add orders to Queue or click "Preview"</p>
                                </div>
                            )}
                        </div>

                        {/* Manual Entry */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Manual Target</h2>
                            <p className="text-sm text-gray-500 mb-6">Use this when no job order is available.</p>

                            <div className="space-y-5">
                                {/* Date */}
                                <div>
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                    />
                                </div>

                                {/* Shift Selection */}
                                <div>
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Shift</label>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => setSelectedShift(null)}
                                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedShift === null
                                                ? 'bg-green-600 text-white border-green-600'
                                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            ⏱️ Auto
                                        </button>
                                        {(() => {
                                            const isFriday = new Date(date).getDay() === 5;
                                            const availableShifts = isFriday
                                                ? ['First Shift', 'Second Shift']
                                                : ['First Shift', 'Second Shift', 'Third Shift'];

                                            // Reset selection if Third Shift was selected on Friday
                                            if (isFriday && selectedShift === 'Third Shift') {
                                                setSelectedShift(null);
                                            }

                                            return availableShifts.map((shift) => (
                                                <button
                                                    key={shift}
                                                    onClick={() => setSelectedShift(shift)}
                                                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedShift === shift
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {shift}
                                                </button>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* Beige Container */}
                                <div className="bg-[#FDFBF7] border border-amber-100 rounded-xl p-5 space-y-4">
                                    <div className="flex gap-4">
                                        {/* Amount */}
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Amount</label>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center"
                                            />
                                        </div>

                                        {/* Unit */}
                                        <div className="w-24">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Unit</label>
                                            <select
                                                value={unit}
                                                onChange={(e) => setUnit(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
                                                dir="rtl"
                                            >
                                                <option value="كيلو">كيلو</option>
                                                <option value="طن">طن</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Product / Description</label>
                                        <input
                                            type="text"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="اسم المنتج"
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
                                            dir="rtl"
                                        />
                                    </div>

                                    {/* Hours */}
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Estimated Hours</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={hours}
                                                onChange={(e) => setHours(e.target.value)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hours</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Section */}
                                {(amount || description) && (
                                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">Preview</h4>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-700" dir="rtl">
                                            <div>
                                                {amount && <span className="font-semibold ml-2">{amount} {unit}</span>}
                                                {amount && description && <span className="mx-2 text-gray-400">|</span>}
                                                {description && <span>{description}</span>}
                                            </div>
                                            {hours && <div className="text-xs bg-white px-2 py-1 rounded border border-blue-100 text-blue-600 font-semibold" dir="ltr">{hours} hours</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !amount}
                                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSubmitting ? 'Assigning...' : 'Assign Single'}
                            </button>
                            <button
                                onClick={handleSubmitQueue}
                                disabled={isSubmitting || orderQueue.length === 0}
                                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSubmitting ? 'Assigning...' : `Assign Queue (${orderQueue.length})`}
                            </button>
                        </div>


                    </div >
                </div >

            </div >
        </div >



    );
}

export default AdminAssignTask;
