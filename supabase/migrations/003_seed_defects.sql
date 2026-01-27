-- ============================================
-- Supabase Migration: Seed Defects Limits
-- Standard fault durations (from your business logic)
-- ============================================

INSERT INTO defects_limits (defect_name, max_duration_minutes, severity) VALUES
    ('01 - ضبط ألوان (Color adjustment)', 30, 'Medium'),
    ('02 - تغيير كاوتشات (Change rubber)', 30, 'Medium'),
    ('03 - صنفرة السلندر (Cylinder sanding)', 30, 'Medium'),
    ('04 - مراجعة الجودة (Quality review)', 15, 'Low'),
    ('05 - تغيير الاكسات (Change axles)', 15, 'Medium'),
    ('06 - موافقة العميل (Customer approval)', 90, 'High'),
    ('07 - تغيير البكر (Change spool)', 15, 'Low'),
    ('08 - صيانة (Maintenance)', 0, 'Critical'),  -- Variable duration
    ('09 - انقطاع الكهرباء (Power cut)', 0, 'Critical')  -- Variable duration
ON CONFLICT (defect_name) DO NOTHING;
