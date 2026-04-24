<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;

class MuyingAuditLogService
{
    const SCENE_SIGNUP_EXPORT = 'signup_export';
    const SCENE_FEEDBACK_EXPORT = 'feedback_export';
    const SCENE_USER_EXPORT = 'user_export';
    const SCENE_SENSITIVE_VIEW = 'sensitive_view';

    public static function Log($params = [])
    {
        $admin_id = isset($params['admin_id']) ? intval($params['admin_id']) : 0;
        $scene = isset($params['scene']) ? trim($params['scene']) : '';
        $conditions = isset($params['conditions']) ? json_encode($params['conditions'], JSON_UNESCAPED_UNICODE) : '';
        $export_count = isset($params['export_count']) ? intval($params['export_count']) : 0;
        $ip = isset($params['ip']) ? trim($params['ip']) : '';
        $remark = isset($params['remark']) ? trim($params['remark']) : '';

        if (empty($admin_id) || empty($scene)) {
            Log::warning('[MuyingAuditLog] 审计日志缺少必要参数 admin_id=' . $admin_id . ' scene=' . $scene);
            return false;
        }

        $data = [
            'admin_id'     => $admin_id,
            'scene'        => $scene,
            'conditions'   => $conditions,
            'export_count' => $export_count,
            'ip'           => $ip,
            'remark'       => $remark,
            'add_time'     => time(),
        ];

        try {
            return Db::name('MuyingAuditLog')->insertGetId($data);
        } catch (\Exception $e) {
            Log::error('[MuyingAuditLog] 审计日志写入失败: ' . $e->getMessage());
            return false;
        }
    }

    public static function LogExport($admin, $scene, $conditions = [], $export_count = 0, $ip = '')
    {
        $admin_id = 0;
        if (!empty($admin) && !empty($admin['id'])) {
            $admin_id = intval($admin['id']);
        }
        if (empty($ip) && !empty($_SERVER['REMOTE_ADDR'])) {
            $ip = $_SERVER['REMOTE_ADDR'];
        }
        return self::Log([
            'admin_id'     => $admin_id,
            'scene'        => $scene,
            'conditions'   => $conditions,
            'export_count' => $export_count,
            'ip'           => $ip,
        ]);
    }

    public static function LogSensitiveView($admin, $scene, $target_id = 0, $remark = '')
    {
        $admin_id = 0;
        if (!empty($admin) && !empty($admin['id'])) {
            $admin_id = intval($admin['id']);
        }
        $ip = !empty($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        return self::Log([
            'admin_id'     => $admin_id,
            'scene'        => $scene,
            'conditions'   => ['target_id' => $target_id],
            'export_count' => 1,
            'ip'           => $ip,
            'remark'       => $remark,
        ]);
    }

    public static function GetList($params = [])
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('MuyingAuditLog')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            $admin_ids = array_unique(array_column($data, 'admin_id'));
            $admins = Db::name('Admin')->where(['id' => $admin_ids])->column('username', 'id');
            foreach ($data as $k => &$v) {
                $v['admin_username'] = isset($admins[$v['admin_id']]) ? $admins[$v['admin_id']] : '';
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return $data;
    }

    public static function GetTotal($where)
    {
        return (int) Db::name('MuyingAuditLog')->where($where)->count();
    }
}
