<?php
namespace app\service;

use think\facade\Db;
use app\service\ResourcesService;
use app\service\MuyingPrivacyService;
use app\extend\muying\MuyingStage;

class FeedbackService
{
    private static $SENSITIVE_WORDS = [
        '加微信', '加我微信', '加V', '加v', '加薇', '加威',
        '微信号', '薇信号', '威信号',
        '扫二维码', '扫码加', '扫码领', '扫码关注',
        '转账', '打款', '汇款', '充值', '代开',
        '兼职', '刷单', '返利', '日赚', '月入',
        '赌博', '博彩', '彩票预测', '六合彩',
        '代孕', '卖卵', '捐精',
        '色情', '约炮', '裸聊',
    ];

    private static $CONTACT_PATTERNS = [
        '/1[3-9]\d{9}/',
        '/[wWＷ]{0,3}[eEＥ]?[iIＩ]?[xXＸ][iIＩ]?[nNＮ]{0,3}[:：]?\s*[a-zA-Z0-9_\-]{5,}/',
        '/[qQＱ]{1}[:：]?\s*\d{5,12}/',
        '/[微薇威][信芯心][:：]?\s*[a-zA-Z0-9_\-]{5,}/',
    ];

    public static function FeedbackWhere($params = [])
    {
        $where = [
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
            ['review_status', '=', 'approved'],
        ];

        if (!empty($params['stage'])) {
            $where[] = ['stage', '=', MuyingStage::Normalize($params['stage'])];
        }

        return $where;
    }

    public static function FeedbackContentCheck($content)
    {
        if (empty($content)) {
            return '';
        }

        foreach (self::$SENSITIVE_WORDS as $word) {
            if (mb_stripos($content, $word) !== false) {
                return '内容包含敏感词汇，请修改后重新提交';
            }
        }

        foreach (self::$CONTACT_PATTERNS as $pattern) {
            if (preg_match($pattern, $content)) {
                return '内容包含联系方式，不允许在反馈中留联系方式';
            }
        }

        return '';
    }

    public static function FeedbackCreate($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'content',
                'error_msg'    => '反馈内容不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        if (empty($params['user']) || empty($params['user']['id'])) {
            return DataReturn(MyLang('user_info_incorrect_tips'), -1);
        }

        if (!empty($params['content']) && mb_strlen($params['content']) > 500) {
            return DataReturn('反馈内容不能超过500字', -1);
        }

        $content = strip_tags(trim($params['content']));
        $check_result = self::FeedbackContentCheck($content);
        if ($check_result !== '') {
            return DataReturn($check_result, -1);
        }

        $normalized = '';
        if (!empty($params['stage'])) {
            $normalized = MuyingStage::Normalize($params['stage']);
        }

        $user_id = intval($params['user']['id']);
        $user_row = Db::name('User')->where(['id' => $user_id])->find();

        $contact_plain = !empty($params['contact']) ? strip_tags(trim($params['contact'])) : '';
        $data = [
            'user_id'       => $user_id,
            'nickname'      => !empty($user_row['nickname']) ? strip_tags(trim($user_row['nickname'])) : '用户' . $user_id,
            'avatar'        => !empty($user_row['avatar']) ? trim($user_row['avatar']) : '',
            'content'       => $content,
            'stage'         => $normalized,
            'contact'       => !empty($contact_plain) ? MuyingPrivacyService::EncryptSensitive($contact_plain) : '',
            'contact_hash'  => !empty($contact_plain) ? MuyingPrivacyService::HashPhone($contact_plain) : '',
            'review_status' => 'pending',
            'is_enable'     => 1,
            'add_time'      => time(),
            'upd_time'      => time(),
        ];

        $id = Db::name('MuyingFeedback')->insertGetId($data);
        if ($id <= 0) {
            return DataReturn('提交失败，请重试', -100);
        }

        return DataReturn('提交成功，审核通过后将在首页展示', 0);
    }

    public static function FeedbackTotal($where)
    {
        return (int) Db::name('MuyingFeedback')->where($where)->count();
    }

    public static function FeedbackList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'sort_level desc, id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('MuyingFeedback')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                if (!empty($v['avatar'])) {
                    $v['avatar'] = ResourcesService::AttachmentPathViewHandle($v['avatar']);
                }
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function FeedbackAdminWhere($params = [])
    {
        $where = [
            ['is_delete_time', '=', 0],
        ];

        if (isset($params['is_enable']) && $params['is_enable'] !== '') {
            $where[] = ['is_enable', '=', intval($params['is_enable'])];
        }

        if (!empty($params['review_status'])) {
            $where[] = ['review_status', '=', trim($params['review_status'])];
        }

        if (!empty($params['stage'])) {
            $where[] = ['stage', '=', MuyingStage::Normalize($params['stage'])];
        }

        if (!empty($params['awd'])) {
            $where[] = ['content', 'like', '%' . trim($params['awd']) . '%'];
        }

        return $where;
    }

    public static function FeedbackAdminTotal($where)
    {
        return (int) Db::name('MuyingFeedback')->where($where)->count();
    }

    public static function FeedbackAdminList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('MuyingFeedback')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['is_enable_text'] = $v['is_enable'] == 1 ? '显示' : '隐藏';
                $v['review_status_text'] = self::GetReviewStatusText($v['review_status'] ?? 'pending');
                $v['review_time_text'] = empty($v['review_time']) ? '' : date('Y-m-d H:i:s', $v['review_time']);
                $v = MuyingPrivacyService::MaskFeedbackRow($v, false);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function FeedbackAdminListHandle($data, $params = [])
    {
        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['is_enable_text'] = $v['is_enable'] == 1 ? '显示' : '隐藏';
                $v['review_status_text'] = self::GetReviewStatusText($v['review_status'] ?? 'pending');
                $v['review_time_text'] = empty($v['review_time']) ? '' : date('Y-m-d H:i:s', $v['review_time']);
                $v = MuyingPrivacyService::MaskFeedbackRow($v, false);
            }
        }
        return $data;
    }

    public static function GetReviewStatusText($status)
    {
        $map = [
            'pending'  => '待审核',
            'approved' => '已通过',
            'rejected' => '已驳回',
        ];
        return $map[$status] ?? '未知';
    }

    public static function FeedbackReview($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => MyLang('data_id_error_tips'),
            ],
            [
                'checked_type' => 'in',
                'key_name'     => 'review_status',
                'checked_data' => ['approved', 'rejected'],
                'error_msg'    => '审核状态参数错误',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $id = intval($params['id']);
        $row = Db::name('MuyingFeedback')->where(['id' => $id, 'is_delete_time' => 0])->find();
        if (empty($row)) {
            return DataReturn('记录不存在', -1);
        }

        $admin_id = 0;
        if (!empty($params['admin']) && !empty($params['admin']['id'])) {
            $admin_id = intval($params['admin']['id']);
        }

        $update = [
            'review_status'   => $params['review_status'],
            'review_admin_id' => $admin_id,
            'review_time'     => time(),
            'upd_time'        => time(),
        ];

        if (!empty($params['review_remark'])) {
            $update['review_remark'] = trim($params['review_remark']);
        }

        if ($params['review_status'] === 'approved') {
            $update['is_enable'] = 1;
        }

        $result = Db::name('MuyingFeedback')->where(['id' => $id])->update($update);
        if ($result !== false) {
            return DataReturn('审核操作成功', 0);
        }
        return DataReturn('审核操作失败', -100);
    }

    public static function FeedbackStatusUpdate($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => MyLang('data_id_error_tips'),
            ],
            [
                'checked_type' => 'in',
                'key_name'     => 'state',
                'checked_data' => [0, 1],
                'error_msg'    => MyLang('form_status_range_message'),
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $status_result = Db::name('MuyingFeedback')->where(['id' => intval($params['id'])])->update([
            'is_enable' => intval($params['state']),
            'upd_time'  => time(),
        ]);
        if ($status_result !== false) {
            return DataReturn(MyLang('edit_success'), 0);
        }
        return DataReturn(MyLang('edit_fail'), -100);
    }

    public static function FeedbackDelete($params = [])
    {
        if (empty($params['ids'])) {
            return DataReturn(MyLang('data_id_error_tips'), -1);
        }
        if (!is_array($params['ids'])) {
            $params['ids'] = explode(',', $params['ids']);
        }

        $del_result = Db::name('MuyingFeedback')->where(['id' => $params['ids']])->update([
            'is_delete_time' => time(),
            'upd_time'       => time(),
        ]);
        if ($del_result !== false) {
            return DataReturn(MyLang('delete_success'), 0);
        }
        return DataReturn(MyLang('delete_fail'), -100);
    }
}
