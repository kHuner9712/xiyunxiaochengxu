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

    public static function CheckMimeType($mime, $allowed_mimes = [])
    {
        if (empty($allowed_mimes)) {
            $allowed_mimes = self::ALLOWED_IMAGE_MIMES;
        }
        if (!in_array(strtolower($mime), $allowed_mimes)) {
            Log::warning('[MuyingUpload] MIME 类型不在白名单: mime=' . $mime);
            return DataReturn('文件类型不支持', -1);
        }
        return DataReturn('success', 0);
    }

    public static function CheckAvatarUpload($file_field)
    {
        if (empty($_FILES[$file_field])) {
            return DataReturn('请选择要上传的头像', -1);
        }

        $file = $_FILES[$file_field];
        $name = isset($file['name']) ? $file['name'] : '';
        $size = isset($file['size']) ? intval($file['size']) : 0;
        $type = isset($file['type']) ? $file['type'] : '';

        $ext_ret = self::CheckDangerousExtension($name);
        if ($ext_ret['code'] != 0) {
            return $ext_ret;
        }

        $size_ret = self::CheckFileSize($size, self::MAX_AVATAR_SIZE);
        if ($size_ret['code'] != 0) {
            return $size_ret;
        }

        if (!empty($type)) {
            $mime_ret = self::CheckMimeType($type, self::ALLOWED_AVATAR_MIMES);
            if ($mime_ret['code'] != 0) {
                return $mime_ret;
            }
        }

        return DataReturn('success', 0);
    }

    public static function CheckImageUpload($file_field, $max_size = 0)
    {
        if (empty($_FILES[$file_field])) {
            return DataReturn('请选择要上传的图片', -1);
        }

        $file = is_array($_FILES[$file_field]) && isset($_FILES[$file_field]['name'])
            ? $_FILES[$file_field]
            : $_FILES[$file_field];

        if (is_array($file) && isset($file['name'])) {
            $name = $file['name'];
            $size = intval($file['size']);
            $type = $file['type'];
        } else {
            return DataReturn('文件信息异常', -1);
        }

        $ext_ret = self::CheckDangerousExtension($name);
        if ($ext_ret['code'] != 0) {
            return $ext_ret;
        }

        $max = $max_size > 0 ? $max_size : self::MAX_FEEDBACK_IMAGE_SIZE;
        $size_ret = self::CheckFileSize($size, $max);
        if ($size_ret['code'] != 0) {
            return $size_ret;
        }

        if (!empty($type)) {
            $mime_ret = self::CheckMimeType($type, self::ALLOWED_IMAGE_MIMES);
            if ($mime_ret['code'] != 0) {
                return $mime_ret;
            }
        }

        return DataReturn('success', 0);
    }
}
