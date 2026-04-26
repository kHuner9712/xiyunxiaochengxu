<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;

class MuyingContentComplianceService
{
    const RISK_HIGH = 'high';
    const RISK_LOW = 'low';

    const CONTENT_TYPE_GOODS = 'goods';
    const CONTENT_TYPE_ARTICLE = 'article';
    const CONTENT_TYPE_ACTIVITY = 'activity';

    const ACTION_BLOCKED = 'blocked';
    const ACTION_CONFIRMED = 'confirmed';

    private static $DEFAULT_HIGH_RISK_WORDS = [
        '治疗', '诊断', '治愈', '疗效', '处方',
        '药到病除', '根治', '医生推荐', '医院专用',
        '孕检报告解读', '在线问诊', '医疗级',
    ];

    private static $DEFAULT_LOW_RISK_WORDS = [
        '100%安全', '无副作用', '绝对安全',
    ];

    private static $CONTENT_FIELD_MAP = [
        self::CONTENT_TYPE_GOODS => [
            'title', 'simple_desc', 'content_web', 'selling_point', 'stage',
        ],
        self::CONTENT_TYPE_ARTICLE => [
            'title', 'content',
        ],
        self::CONTENT_TYPE_ACTIVITY => [
            'title', 'content',
        ],
    ];

    public static function ScanContent($content_type, $params)
    {
        $fields = self::$CONTENT_FIELD_MAP[$content_type] ?? [];
        if (empty($fields)) {
            return DataReturn('未知内容类型', -1);
        }

        $all_words = self::GetAllWords();
        $hits = [];

        foreach ($fields as $field) {
            $text = isset($params[$field]) ? trim($params[$field]) : '';
            if (empty($text)) {
                continue;
            }

            foreach ($all_words as $word_item) {
                $word = $word_item['word'];
                $risk = $word_item['risk'];
                if (mb_strpos($text, $word) !== false) {
                    $hits[] = [
                        'word'      => $word,
                        'risk'      => $risk,
                        'field'     => $field,
                        'risk_name' => $risk === self::RISK_HIGH ? '高风险' : '低风险',
                    ];
                }
            }
        }

        return $hits;
    }

    public static function ValidateBeforeSave($content_type, $params, $admin = [])
    {
        $hits = self::ScanContent($content_type, $params);

        if (empty($hits)) {
            return DataReturn('校验通过', 0);
        }

        $high_risk_hits = array_filter($hits, function ($h) {
            return $h['risk'] === self::RISK_HIGH;
        });
        $low_risk_hits = array_filter($hits, function ($h) {
            return $h['risk'] === self::RISK_LOW;
        });

        $content_id = isset($params['id']) ? intval($params['id']) : 0;
        $admin_id = !empty($admin) && isset($admin['id']) ? intval($admin['id']) : 0;
        $ip = request()->ip();

        if (!empty($high_risk_hits)) {
            $word_list = array_unique(array_column($high_risk_hits, 'word'));
            $msg = '内容包含高风险敏感词：' . implode('、', $word_list) . '，请修改后保存';

            foreach ($high_risk_hits as $hit) {
                self::LogHit([
                    'content_type' => $content_type,
                    'content_id'   => $content_id,
                    'word'         => $hit['word'],
                    'risk'         => $hit['risk'],
                    'field'        => $hit['field'],
                    'admin_id'     => $admin_id,
                    'action'       => self::ACTION_BLOCKED,
                    'ip'           => $ip,
                ]);
            }

            return DataReturn($msg, -1);
        }

        $force_save = isset($params['force_save']) ? intval($params['force_save']) : 0;
        if (!empty($low_risk_hits) && $force_save !== 1) {
            $word_list = array_unique(array_column($low_risk_hits, 'word'));
            $msg = '内容包含低风险敏感词：' . implode('、', $word_list) . '，如确认无误请勾选"确认保存"后重新提交';

            return DataReturn($msg, -2, [
                'low_risk_words' => $word_list,
                'hits'           => $low_risk_hits,
            ]);
        }

        if (!empty($low_risk_hits) && $force_save === 1) {
            foreach ($low_risk_hits as $hit) {
                self::LogHit([
                    'content_type' => $content_type,
                    'content_id'   => $content_id,
                    'word'         => $hit['word'],
                    'risk'         => $hit['risk'],
                    'field'        => $hit['field'],
                    'admin_id'     => $admin_id,
                    'action'       => self::ACTION_CONFIRMED,
                    'ip'           => $ip,
                ]);
            }
        }

        return DataReturn('校验通过', 0);
    }

    public static function GetAllWords()
    {
        $words = [];

        foreach (self::$DEFAULT_HIGH_RISK_WORDS as $w) {
            $words[] = ['word' => $w, 'risk' => self::RISK_HIGH, 'source' => 'default'];
        }
        foreach (self::$DEFAULT_LOW_RISK_WORDS as $w) {
            $words[] = ['word' => $w, 'risk' => self::RISK_LOW, 'source' => 'default'];
        }

        try {
            $custom_words = Db::name('MuyingContentSensitiveWord')
                ->where('is_enable', 1)
                ->field('word,risk')
                ->select()
                ->toArray();

            foreach ($custom_words as $cw) {
                $words[] = [
                    'word'   => trim($cw['word']),
                    'risk'   => trim($cw['risk']),
                    'source' => 'custom',
                ];
            }
        } catch (\Exception $e) {
            Log::warning('[MuyingContentCompliance] 读取自定义敏感词失败: ' . $e->getMessage());
        }

        return $words;
    }

    public static function GetDefaultWords()
    {
        $result = [];
        foreach (self::$DEFAULT_HIGH_RISK_WORDS as $w) {
            $result[] = ['word' => $w, 'risk' => self::RISK_HIGH, 'risk_name' => '高风险'];
        }
        foreach (self::$DEFAULT_LOW_RISK_WORDS as $w) {
            $result[] = ['word' => $w, 'risk' => self::RISK_LOW, 'risk_name' => '低风险'];
        }
        return $result;
    }

    public static function LogHit($params)
    {
        $data = [
            'content_type' => $params['content_type'] ?? '',
            'content_id'   => intval($params['content_id'] ?? 0),
            'word'         => trim($params['word'] ?? ''),
            'risk'         => trim($params['risk'] ?? ''),
            'field'        => trim($params['field'] ?? ''),
            'admin_id'     => intval($params['admin_id'] ?? 0),
            'action'       => trim($params['action'] ?? ''),
            'ip'           => trim($params['ip'] ?? ''),
            'add_time'     => time(),
        ];

        try {
            Db::name('MuyingContentComplianceLog')->insertGetId($data);
        } catch (\Exception $e) {
            Log::error('[MuyingContentCompliance] 合规日志写入失败: ' . $e->getMessage());
        }
    }

    public static function GetComplianceLogList($params = [])
    {
        $where = [];
        if (!empty($params['content_type'])) {
            $where[] = ['content_type', '=', trim($params['content_type'])];
        }
        if (!empty($params['action'])) {
            $where[] = ['action', '=', trim($params['action'])];
        }
        if (!empty($params['word'])) {
            $where[] = ['word', 'like', '%' . trim($params['word']) . '%'];
        }

        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 20;

        $data = Db::name('MuyingContentComplianceLog')
            ->where($where)
            ->order('id desc')
            ->limit($m, $n)
            ->select()
            ->toArray();

        foreach ($data as &$v) {
            $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            $v['risk_name'] = $v['risk'] === self::RISK_HIGH ? '高风险' : '低风险';
            $v['action_name'] = $v['action'] === self::ACTION_BLOCKED ? '已阻止' : '已确认保存';
            $v['content_type_name'] = self::GetContentTypeName($v['content_type']);
        }
        unset($v);

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function GetComplianceLogCount($params = [])
    {
        $where = [];
        if (!empty($params['content_type'])) {
            $where[] = ['content_type', '=', trim($params['content_type'])];
        }
        if (!empty($params['action'])) {
            $where[] = ['action', '=', trim($params['action'])];
        }
        return (int) Db::name('MuyingContentComplianceLog')->where($where)->count();
    }

    public static function GetContentTypeName($type)
    {
        $map = [
            self::CONTENT_TYPE_GOODS   => '商品',
            self::CONTENT_TYPE_ARTICLE => '文章',
            self::CONTENT_TYPE_ACTIVITY => '活动',
        ];
        return $map[$type] ?? $type;
    }

    public static function SaveSensitiveWord($params = [])
    {
        $word = isset($params['word']) ? trim($params['word']) : '';
        $risk = isset($params['risk']) ? trim($params['risk']) : '';

        if (empty($word)) {
            return DataReturn('敏感词不能为空', -1);
        }
        if (!in_array($risk, [self::RISK_HIGH, self::RISK_LOW])) {
            return DataReturn('风险级别无效', -1);
        }

        $existing = Db::name('MuyingContentSensitiveWord')
            ->where('word', $word)
            ->find();
        if (!empty($existing)) {
            return DataReturn('该敏感词已存在', -1);
        }

        $id = Db::name('MuyingContentSensitiveWord')->insertGetId([
            'word'     => $word,
            'risk'     => $risk,
            'is_enable' => 1,
            'add_time' => time(),
            'upd_time' => time(),
        ]);

        if ($id > 0) {
            return DataReturn('添加成功', 0);
        }
        return DataReturn('添加失败', -1);
    }

    public static function DeleteSensitiveWord($params = [])
    {
        if (empty($params['id'])) {
            return DataReturn('ID不能为空', -1);
        }
        $result = Db::name('MuyingContentSensitiveWord')->where('id', intval($params['id']))->delete();
        if ($result !== false) {
            return DataReturn('删除成功', 0);
        }
        return DataReturn('删除失败', -1);
    }

    public static function GetSensitiveWordList($params = [])
    {
        $where = [];
        if (!empty($params['risk'])) {
            $where[] = ['risk', '=', trim($params['risk'])];
        }

        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 50;

        $data = Db::name('MuyingContentSensitiveWord')
            ->where($where)
            ->order('id desc')
            ->limit($m, $n)
            ->select()
            ->toArray();

        foreach ($data as &$v) {
            $v['risk_name'] = $v['risk'] === self::RISK_HIGH ? '高风险' : '低风险';
            $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
        }
        unset($v);

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function GetSensitiveWordCount($params = [])
    {
        $where = [];
        if (!empty($params['risk'])) {
            $where[] = ['risk', '=', trim($params['risk'])];
        }
        return (int) Db::name('MuyingContentSensitiveWord')->where($where)->count();
    }
}
