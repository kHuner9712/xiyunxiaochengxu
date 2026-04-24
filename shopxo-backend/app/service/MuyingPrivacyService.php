<?php
namespace app\service;

use think\facade\Log;

class MuyingPrivacyService
{
    const CIPHER = 'AES-256-CBC';
    const IV_LENGTH = 16;
    const HASH_ALGO = 'sha256';

    private static function GetEncryptionKey()
    {
        $key = env('MUYING_PRIVACY_KEY', '');
        if (empty($key)) {
            $key = MyC('muying_privacy_key', '');
        }
        if (empty($key)) {
            Log::error('[MuyingPrivacy] 加密密钥未配置，请设置 MUYING_PRIVACY_KEY 环境变量或 muying_privacy_key 配置项');
            return '';
        }
        return hash('sha256', $key, true);
    }

    public static function EncryptSensitive($value)
    {
        if (empty($value)) {
            return $value;
        }
        $key = self::GetEncryptionKey();
        if (empty($key)) {
            return $value;
        }
        $iv = openssl_random_pseudo_bytes(self::IV_LENGTH);
        $encrypted = openssl_encrypt($value, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($encrypted === false) {
            Log::error('[MuyingPrivacy] 加密失败');
            return $value;
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

    public static function HashPhone($phone)
    {
        if (empty($phone)) {
            return '';
        }
        $salt = env('MUYING_PRIVACY_KEY', '');
        if (empty($salt)) {
            $salt = MyC('muying_privacy_key', '');
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
        return true;
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
