<?php
// +----------------------------------------------------------------------
// | ShopXO 国内领先企业级B2C免费开源电商系统
// +----------------------------------------------------------------------
// | Copyright (c) 2011~2099 http://shopxo.net All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( https://opensource.org/licenses/mit-license.php )
// +----------------------------------------------------------------------
// | Author: Devil
// +----------------------------------------------------------------------
namespace app\admin\form;

use think\facade\Db;
use app\service\ActivityService;
use app\extend\muying\MuyingStage;

/**
 * 活动报名动态表格
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  1.0.0
 * @date     2026-04-17
 * @desc     description
 */
class Activitysignup
{
    public $condition_base = [
        ['is_delete_time', '=', 0],
    ];

    public function Run($params = [])
    {
        return [
            'base' => [
                'key_field'     => 'id',
                'is_search'     => 1,
                'is_delete'     => 0,
                'is_middle'     => 0,
            ],
            'form' => [
                [
                    'view_type'         => 'checkbox',
                    'is_checked'        => 0,
                    'checked_text'      => MyLang('reverse_select_title'),
                    'not_checked_text'  => MyLang('select_all_title'),
                    'align'             => 'center',
                    'width'             => 80,
                ],
                [
                    'label'         => 'ID',
                    'view_type'     => 'field',
                    'view_key'      => 'id',
                    'width'         => 80,
                    'is_copy'       => 1,
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'input',
                        'where_type'        => '=',
                    ],
                ],
                [
                    'label'             => '活动标题',
                    'view_type'         => 'field',
                    'view_key'          => 'activity_title',
                    'is_sort'           => 1,
                    'width'             => 160,
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'activity_id',
                        'where_type'        => 'in',
                        'data'              => $this->ActivityList(),
                        'data_key'          => 'id',
                        'data_name'         => 'title',
                        'is_multiple'       => 0,
                    ],
                ],
                [
                    'label'         => '姓名',
                    'view_type'     => 'field',
                    'view_key'      => 'name',
                    'width'         => 100,
                    'search_config' => [
                        'form_type'         => 'input',
                        'where_type'        => 'like',
                    ],
                ],
                [
                    'label'         => '手机',
                    'view_type'     => 'field',
                    'view_key'      => 'phone',
                    'width'         => 130,
                    'search_config' => [
                        'form_type'         => 'input',
                        'where_type'        => 'like',
                    ],
                ],
                // [MUYING-二开] 增加阶段筛选列
                [
                    'label'             => '阶段',
                    'view_type'         => 'field',
                    'view_key'          => 'stage_text',
                    'is_sort'           => 1,
                    'width'             => 100,
                    'align'             => 'center',
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'stage',
                        'where_type'        => 'in',
                        'data'              => $this->StageData(),
                        'data_key'          => 'id',
                        'data_name'         => 'name',
                        'is_multiple'       => 0,
                    ],
                ],
                [
                    'label'             => '报名状态',
                    'view_type'         => 'field',
                    'view_key'          => 'status_text',
                    'is_sort'           => 1,
                    'width'             => 100,
                    'align'             => 'center',
                    'params_where_name' => 'status',
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'status',
                        'where_type'        => 'in',
                        'data'              => $this->SignupStatusData(),
                        'data_key'          => 'id',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'             => '签到状态',
                    'view_type'         => 'field',
                    'view_key'          => 'checkin_status_text',
                    'is_sort'           => 1,
                    'width'             => 100,
                    'align'             => 'center',
                    'params_where_name' => 'checkin_status',
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'checkin_status',
                        'where_type'        => 'in',
                        'data'              => $this->CheckinStatusData(),
                        'data_key'          => 'id',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'         => '报名时间',
                    'view_type'     => 'field',
                    'view_key'      => 'add_time_text',
                    'is_sort'       => 1,
                    'width'         => 170,
                    'search_config' => [
                        'form_type'         => 'datetime',
                    ],
                ],
                [
                    'label'         => MyLang('operate_title'),
                    'view_type'     => 'operate',
                    'view_key'      => 'activitysignup/module/operate',
                    'align'         => 'center',
                    'fixed'         => 'right',
                ],
            ],
            'data'  => [
                'table_name'    => 'ActivitySignup',
                'data_handle'   => 'ActivityService::AdminSignupListHandle',
            ],
        ];
    }

    public function ActivityList()
    {
        return Db::name('Activity')->where(['is_delete_time' => 0])->field('id,title')->order('id desc')->select()->toArray();
    }

    // [MUYING-二开] 阶段筛选数据源
    public function StageData()
    {
        $list = MuyingStage::getList();
        $result = [];
        foreach ($list as $id => $name) {
            $result[] = ['id' => $id, 'name' => $name];
        }
        return $result;
    }

    public function SignupStatusData()
    {
        $list = ActivityService::SignupStatusList();
        $result = [];
        foreach ($list as $id => $name) {
            $result[] = ['id' => $id, 'name' => $name];
        }
        return $result;
    }

    public function CheckinStatusData()
    {
        $list = ActivityService::CheckinStatusList();
        $result = [];
        foreach ($list as $id => $name) {
            $result[] = ['id' => $id, 'name' => $name];
        }
        return $result;
    }
}
?>
