<?php
namespace app\service;

use think\facade\Log;

class MuyingUploadSecurityService
{
    const DANGEROUS_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'phtml', 'pht',
        'jsp', 'jspx', 'asp', 'aspx', 'asa', 'ascx',
        'cgi', 'pl', 'py', 'sh', 'bash',
        'htaccess', 'htpasswd',
        'exe', 'bat', 'cmd', 'com', 'msi', 'scr',
        'svg',
    ];

    const DANGEROUS_MIME_PATTERNS = [
        'application/x-httpd-php',
        'application/x-php',
        'text/x-php',
        'application/php',
        'text/php',
        'application/x-executable',
        'application/x-msdos-program',
        'application/x-sh',
        'application/x-cgi',
    ];

    const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
    const MAX_FEEDBACK_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_GENERAL_UPLOAD_SIZE = 20 * 1024 * 1024;

    const ALLOWED_AVATAR_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];

    const ALLOWED_IMAGE_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    ];

    public static function CheckDangerousExtension($filename)
    {
        if (empty($filename)) {
            return DataReturn('文件名不能为空', -1);
        }
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (empty($ext)) {
            return DataReturn('文件缺少扩展名', -1);
        }
        if (in_array($ext, self::DANGEROUS_EXTENSIONS)) {
            Log::warning('[MuyingUpload] 拦截危险后缀文件上传: ext=' . $ext . ' name=' . $filename);
            return DataReturn('不允许上传该类型文件', -1);
        }
        if (preg_match('/\.ph(p\d*|t|tml)$/i', $filename)) {
            Log::warning('[MuyingUpload] 拦截 PHP 变体后缀: name=' . $filename);
            return DataReturn('不允许上传该类型文件', -1);
        }
        return DataReturn('success', 0);
    }

    // [MUYING-二开] 使用 finfo_file 检测文件真实 MIME 类型，不信任客户端声明的 type
    public static function DetectRealMimeType($tmp_path)
    {
        if (empty($tmp_path) || !file_exists($tmp_path)) {
            return '';
        }
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $mime = finfo_file($finfo, $tmp_path);
                finfo_close($finfo);
                if ($mime !== false) {
                    return strtolower(trim($mime));
                }
            }
        }
        if (function_exists('mime_content_type')) {
            $mime = mime_content_type($tmp_path);
            if ($mime !== false) {
                return strtolower(trim($mime));
            }
        }
        return '';
    }

    // [MUYING-二开] 检测真实 MIME 是否为危险可执行类型
    public static function CheckDangerousMime($tmp_path)
    {
        $real_mime = self::DetectRealMimeType($tmp_path);
        if (empty($real_mime)) {
            return DataReturn('无法检测文件类型', -1);
        }
        foreach (self::DANGEROUS_MIME_PATTERNS as $dangerous) {
            if ($real_mime === $dangerous || strpos($real_mime, $dangerous) === 0) {
                Log::warning('[MuyingUpload] 拦截危险 MIME 类型: mime=' . $real_mime);
                return DataReturn('文件类型不安全，禁止上传', -1);
            }
        }
        if (preg_match('/\bphp\b/', $real_mime)) {
            Log::warning('[MuyingUpload] 拦截含 php 的 MIME 类型: mime=' . $real_mime);
            return DataReturn('文件类型不安全，禁止上传', -1);
        }
        return DataReturn('success', 0, ['real_mime' => $real_mime]);
    }

    public static function CheckFileSize($size, $max_size = 0)
    {
        if ($max_size <= 0) {
            $max_size = self::MAX_GENERAL_UPLOAD_SIZE;
        }
        if ($size > $max_size) {
            return DataReturn('文件大小超过限制（最大 ' . round($max_size / 1024 / 1024, 1) . 'MB）', -1);
        }
        return DataReturn('success', 0);
    }

    // [MUYING-二开] MIME 白名单校验，优先使用真实 MIME
    public static function CheckMimeType($client_mime, $allowed_mimes = [], $tmp_path = '')
    {
        if (empty($allowed_mimes)) {
            $allowed_mimes = self::ALLOWED_IMAGE_MIMES;
        }
        $real_mime = '';
        if (!empty($tmp_path) && file_exists($tmp_path)) {
            $real_mime = self::DetectRealMimeType($tmp_path);
        }
        $effective_mime = !empty($real_mime) ? $real_mime : strtolower($client_mime);
        if (empty($effective_mime)) {
            return DataReturn('无法确定文件类型', -1);
        }
        if (!in_array($effective_mime, $allowed_mimes)) {
            Log::warning('[MuyingUpload] MIME 类型不在白名单: client_mime=' . $client_mime . ' real_mime=' . $real_mime . ' effective=' . $effective_mime);
            return DataReturn('文件类型不支持', -1);
        }
        return DataReturn('success', 0);
    }

    // [MUYING-二开] 头像上传安全检查（后缀 + 真实 MIME + 大小 + 危险 MIME）
    public static function CheckAvatarUpload($file_field)
    {
        if (empty($_FILES[$file_field])) {
            return DataReturn('请选择要上传的头像', -1);
        }

        $file = $_FILES[$file_field];
        $name = isset($file['name']) ? $file['name'] : '';
        $size = isset($file['size']) ? intval($file['size']) : 0;
        $client_type = isset($file['type']) ? $file['type'] : '';
        $tmp_path = isset($file['tmp_name']) ? $file['tmp_name'] : '';

        $ext_ret = self::CheckDangerousExtension($name);
        if ($ext_ret['code'] != 0) {
            return $ext_ret;
        }

        if (!empty($tmp_path) && file_exists($tmp_path)) {
            $danger_ret = self::CheckDangerousMime($tmp_path);
            if ($danger_ret['code'] != 0) {
                return $danger_ret;
            }
        }

        $size_ret = self::CheckFileSize($size, self::MAX_AVATAR_SIZE);
        if ($size_ret['code'] != 0) {
            return $size_ret;
        }

        $mime_ret = self::CheckMimeType($client_type, self::ALLOWED_AVATAR_MIMES, $tmp_path);
        if ($mime_ret['code'] != 0) {
            return $mime_ret;
        }

        return DataReturn('success', 0);
    }

    // [MUYING-二开] 图片上传安全检查（后缀 + 真实 MIME + 大小 + 危险 MIME）
    public static function CheckImageUpload($file_field, $max_size = 0)
    {
        if (empty($_FILES[$file_field])) {
            return DataReturn('请选择要上传的图片', -1);
        }

        $file = $_FILES[$file_field];
        if (!is_array($file) || !isset($file['name'])) {
            return DataReturn('文件信息异常', -1);
        }

        $name = $file['name'];
        $size = intval($file['size']);
        $client_type = $file['type'];
        $tmp_path = isset($file['tmp_name']) ? $file['tmp_name'] : '';

        $ext_ret = self::CheckDangerousExtension($name);
        if ($ext_ret['code'] != 0) {
            return $ext_ret;
        }

        if (!empty($tmp_path) && file_exists($tmp_path)) {
            $danger_ret = self::CheckDangerousMime($tmp_path);
            if ($danger_ret['code'] != 0) {
                return $danger_ret;
            }
        }

        $max = $max_size > 0 ? $max_size : self::MAX_FEEDBACK_IMAGE_SIZE;
        $size_ret = self::CheckFileSize($size, $max);
        if ($size_ret['code'] != 0) {
            return $size_ret;
        }

        $mime_ret = self::CheckMimeType($client_type, self::ALLOWED_IMAGE_MIMES, $tmp_path);
        if ($mime_ret['code'] != 0) {
            return $mime_ret;
        }

        return DataReturn('success', 0);
    }

    // [MUYING-二开] 通用上传安全检查（不限制 MIME 白名单，但仍拦截危险后缀和危险 MIME）
    public static function CheckGeneralUpload($file_field, $max_size = 0)
    {
        if (empty($_FILES[$file_field])) {
            return DataReturn('请选择要上传的文件', -1);
        }

        $file = $_FILES[$file_field];
        if (!is_array($file) || !isset($file['name'])) {
            return DataReturn('文件信息异常', -1);
        }

        $name = $file['name'];
        $size = intval($file['size']);
        $tmp_path = isset($file['tmp_name']) ? $file['tmp_name'] : '';

        $ext_ret = self::CheckDangerousExtension($name);
        if ($ext_ret['code'] != 0) {
            return $ext_ret;
        }

        if (!empty($tmp_path) && file_exists($tmp_path)) {
            $danger_ret = self::CheckDangerousMime($tmp_path);
            if ($danger_ret['code'] != 0) {
                return $danger_ret;
            }
        }

        $max = $max_size > 0 ? $max_size : self::MAX_GENERAL_UPLOAD_SIZE;
        $size_ret = self::CheckFileSize($size, $max);
        if ($size_ret['code'] != 0) {
            return $size_ret;
        }

        return DataReturn('success', 0);
    }
}
