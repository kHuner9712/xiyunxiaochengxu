<?php
namespace app\service;

/**
 * [MUYING-二开] 轻量 API 限流服务
 * 基于项目已有 MyCache(ThinkPHP Cache) 实现，不引入额外依赖
 * fail-open 策略：缓存不可用时放行请求，不阻塞正常业务
 */
class MuyingRateLimitService
{
    const CACHE_PREFIX = 'muying_rl:';

    /**
     * 检查请求是否在限流窗口内
     * @param string $action     操作标识，如 signup / login / feedback
     * @param string $identifier 用户/IP 标识（仅作缓存 key，不记录明文到日志）
     * @param int    $max        窗口内最大请求数
     * @param int    $window_sec 时间窗口（秒）
     * @return array ['allowed'=>bool, 'remaining'=>int, 'retry_after'=>int(秒)]
     */
    public static function Check($action, $identifier, $max = 10, $window_sec = 60)
    {
        $key = self::CACHE_PREFIX . $action . ':' . $identifier;

        try {
            $data = MyCache($key);
            $now  = time();

            if ($data === null || $data === false || !is_array($data)) {
                $entry = ['t' => $now, 'c' => 1];
                MyCache($key, $entry, $window_sec);
                return ['allowed' => true, 'remaining' => $max - 1, 'retry_after' => 0];
            }

            $start   = intval($data['t']);
            $count   = intval($data['c']);
            $elapsed = $now - $start;

            if ($elapsed >= $window_sec) {
                $entry = ['t' => $now, 'c' => 1];
                MyCache($key, $entry, $window_sec);
                return ['allowed' => true, 'remaining' => $max - 1, 'retry_after' => 0];
            }

            if ($count >= $max) {
                $retry = $window_sec - $elapsed;
                return ['allowed' => false, 'remaining' => 0, 'retry_after' => max(1, $retry)];
            }

            $new_count = $count + 1;
            $remain_ttl = $window_sec - $elapsed;
            $entry = ['t' => $start, 'c' => $new_count];
            MyCache($key, $entry, max(1, $remain_ttl));

            return ['allowed' => true, 'remaining' => $max - $new_count, 'retry_after' => 0];
        } catch (\Exception $e) {
            \think\facade\Log::warning('[RL] cache-down fail-open action=' . $action . ' err=' . $e->getMessage());
            return ['allowed' => true, 'remaining' => $max, 'retry_after' => 0];
        }
    }
}
