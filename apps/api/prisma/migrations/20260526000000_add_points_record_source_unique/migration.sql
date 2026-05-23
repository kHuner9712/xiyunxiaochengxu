-- 上线前需确认：points_records 表中不存在重复的 (source, source_id) 组合
-- 如有重复数据需先清理，否则此 migration 会执行失败
CREATE UNIQUE INDEX idx_points_records_source_source_id ON points_records (source, source_id);
