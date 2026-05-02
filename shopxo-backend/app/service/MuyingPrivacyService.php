<?php
namespace app\service;

use think\facade\Log;

class MuyingPrivacyService
{
    const CIPHER = 'AES-256-CBC';
    const IV_LENGTH = 16;
    const HASH_ALGO = 'sha256';

    // [MUYING-二开] 密钥最小长度（原始值需 >= 此值才视为有效）
    const MIN_KEY_LENGTH = 16;

    private static function GetEncryptionKey()
    {
        $key = env('MUYING_PRIVACY_KEY', '');
        if (empty($key)) {
            $key = MyC('muying_privacy_key', '');
        }
        if (empty($key) || strlen($key) < self::MIN_KEY_LENGTH) {
            Log::error('[MuyingPrivacy] 加密密钥未配置或过短（需>=' . self::MIN_KEY_LENGTH . '字符），请设置 MUYING_PRIVACY_KEY 环境变量或 muying_privacy_key 配置项');
            return '';
        }
        return hash('sha256', $key, true);
    }

    // [MUYING-二开] 检查密钥是否可用（fail-closed 前置检查，返回 bool）
    public static function IsKeyAvailable()
    {
        $key = env('MUYING_PRIVACY_KEY', '');
        if (empty($key)) {
            $key = MyC('muying_privacy_key', '');
        }
        return !empty($key) && strlen($key) >= self::MIN_KEY_LENGTH;
    }

    // [MUYING-二开] 断言密钥就绪（生产环境密钥缺失时抛出异常，开发环境仅 warning）
    // 调用方可在 Service 入口统一调用，避免分散检查遗漏
    public static function AssertPrivacyKeyReady()
    {
        if (self::IsKeyAvailable()) {
            return true;
        }

        $is_production = !env('APP_DEBUG', false);
        $msg = '[MuyingPrivacy] 隐私加密密钥未配置或过短（需>=' . self::MIN_KEY_LENGTH . '字符），请设置 MUYING_PRIVACY_KEY 环境变量';

        if ($is_production) {
            Log::critical($msg . ' [PRODUCTION-REJECTED]');
            throw new \RuntimeException('系统隐私配置异常，请联系管理员');
        }

        Log::warning($msg . ' [DEV-WARNING-ONLY]');
        return false;
    }

    // [MUYING-二开] fail-closed：密钥缺失时禁止返回原始值，返回 null 并记录错误
    public static function EncryptSensitive($value)
    {
        if (empty($value)) {
            return $value;
        }
        $key = self::GetEncryptionKey();
        if (empty($key)) {
            Log::error('[MuyingPrivacy] EncryptSensitive 密钥不可用，拒绝明文写入');
            return null;
        }
        $iv = openssl_random_pseudo_bytes(self::IV_LENGTH);
        $encrypted = openssl_encrypt($value, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($encrypted === false) {
            Log::error('[MuyingPrivacy] 加密失败');
            return null;
        }
        return base64_encode($iv . $encrypted);
    }

    public static function DecryptSensitive($value)
    {
        if (empty($value)) {
            return $value;
        }
        $decoded = base64_decode($value, true);
        if ($decoded === false || strlen($decoded) <= self::IV_LENGTH) {
            return $value;
        }
        $key = self::GetEncryptionKey();
        if (empty($key)) {
            return $value;
        }
        $iv = substr($decoded, 0, self::IV_LENGTH);
        $encrypted = substr($decoded, self::IV_LENGTH);
        $decrypted = openssl_decrypt($encrypted, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($decrypted === false) {
            return $value;
        }
        return $decrypted;
    }

    public static function IsEncrypted($value)
    {
        if (empty($value)) {
            return false;
        }
        $decoded = base64_decode($value, true);
        if ($decoded === false) {
            return false;
        }
        return strlen($decoded) > self::IV_LENGTH;
    }

    public static function DecryptIfEncrypted($value)
    {
        if (self::IsEncrypted($value)) {
            return self::DecryptSensitive($value);
        }
        return $value;
    }

    // [MUYING-二开] fail-closed：HashPhone 密钥缺失时拒绝生成无盐 hash
    public static function HashPhone($phone)
    {
        if (empty($phone)) {
            return '';
        }
        $salt = env('MUYING_PRIVACY_KEY', '');
        if (empty($salt)) {
            $salt = MyC('muying_privacy_key', '');
        }
        if (empty($salt) || strlen($salt) < self::MIN_KEY_LENGTH) {
            Log::error('[MuyingPrivacy] HashPhone 密钥不可用，拒绝生成无盐 hash');
            return '';
        }
        return hash(self::HASH_ALGO, strtolower(trim($phone)) . $salt);
    }

    public static function MaskPhone($phone)
    {
        $plain = self::DecryptIfEncrypted($phone);
        if (empty($plain)) {
            return '';
        }
        $plain = trim($plain);
        if (preg_match('/^1[3-9]\d{9}$/', $plain)) {
            return substr($plain, 0, 3) . '****' . substr($plain, -4);
        }
        if (mb_strlen($plain) > 4) {
            return mb_substr($plain, 0, 2) . '****' . mb_substr($plain, -2);
        }
        return '****';
    }

    public static function MaskName($name)
    {
        $plain = self::DecryptIfEncrypted($name);
        if (empty($plain)) {
            return '';
        }
        $plain = trim($plain);
        $len = mb_strlen($plain);
        if ($len <= 1) {
            return $plain;
        }
        if ($len === 2) {
            return mb_substr($plain, 0, 1) . '*';
        }
        return mb_substr($plain, 0, 1) . str_repeat('*', $len - 2) . mb_substr($plain, -1);
    }

    public static function CanViewSensitive($admin)
    {
        if (empty($admin) || empty($admin['id'])) {
            return false;
        }

        if (function_exists('AdminIsPower')) {
            return AdminIsPower('muyingsensitive', 'view') === true;
        }

        $admin_id = intval($admin['id']);
        $role_id = 0;
        try {
            $admin_row = \think\facade\Db::name('Admin')->where(['id' => $admin_id])->field('id,role_id')->find();
            if (empty($admin_row)) {
                return false;
            }
            $role_id = intval($admin_row['role_id']);
        } catch (\Exception $e) {
            return false;
        }

        if ($role_id <= 0) {
            return false;
        }

        try {
            $power = \think\facade\Db::name('Power')
                ->where(['control' => 'Muyingsensitive', 'action' => 'View'])
                ->field('id')
                ->find();
            if (empty($power)) {
                return false;
            }
            $exists = \think\facade\Db::name('RolePower')
                ->where(['role_id' => $role_id, 'power_id' => intval($power['id'])])
                ->count();
            return $exists > 0;
        } catch (\Exception $e) {
            return false;
        }
    }

    public static function CanExportSensitive($admin)
    {
        if (empty($admin) || empty($admin['id'])) {
            return false;
        }

        if (function_exists('AdminIsPower')) {
            return AdminIsPower('muyingsensitive', 'export') === true;
        }

        return self::CanViewSensitive($admin);
    }

    public static function MaskSignupRow($row, $show_full = false)
    {
        if (empty($row)) {
            return $row;
        }
        if ($show_full) {
            if (isset($row['phone'])) {
                $row['phone'] = self::DecryptIfEncrypted($row['phone']);
            }
            if (isset($row['name'])) {
                $row['name'] = self::DecryptIfEncrypted($row['name']);
            }
        } else {
            if (isset($row['phone'])) {
                $row['phone'] = self::MaskPhone($row['phone']);
            }
            if (isset($row['name'])) {
                $row['name'] = self::MaskName($row['name']);
            }
        }
        return $row;
    }

    public static function MaskFeedbackRow($row, $show_full = false)
    {
        if (empty($row)) {
            return $row;
        }
        if ($show_full) {
            if (isset($row['contact'])) {
                $row['contact'] = self::DecryptIfEncrypted($row['contact']);
            }
        } else {
            if (isset($row['contact'])) {
                $row['contact'] = self::MaskPhone($row['contact']);
            }
        }
        return $row;
    }

    public static function GenerateKey()
    {
        return bin2hex(openssl_random_pseudo_bytes(32));
    }
}
