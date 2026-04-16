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

use app\extend\muying\MuyingStage;
use app\extend\muying\MuyingActivityCategory;

/**
 * 活动动态表格
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  1.0.0
 * @date     2026-04-17
 * @desc     description
 */
class Activity
{
    public $condition_base = [
        ['is_delete_time', '=', 0],
    ];

    public function Run($params = [])
    {
        $lang = MyLang('article.form_table');
        return [
            'base' => [
                'key_field'     => 'id',
                'status_field'  => 'is_enable',
                'is_search'     => 1,
                'is_delete'     => AdminIsPower('activity', 'delete') ? 1 : 0,
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
                    'label'         => '封面',
                    'view_type'     => 'images',
                    'view_key'      => 'cover',
                    'width'         => 70,
                    'images_width'  => 25,
                    'images_height' => 25,
                ],
                [
                    'label'             => '标题',
                    'view_type'         => 'module',
                    'view_key'          => 'activity/module/info',
                    'grid_size'         => 'sm',
                    'is_sort'           => 1,
                    'search_config'     => [
                        'form_type'         => 'input',
                        'form_name'         => 'title',
                        'where_type'        => 'like',
                    ],
                ],
                [
                    'label'             => '分类',
                    'view_type'         => 'field',
                    'view_key'          => 'category',
                    'is_sort'           => 1,
                    'width'             => 100,
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'category',
                        'where_type'        => 'in',
                        'data'              => $this->CategoryList(),
                        'data_key'          => 'value',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'             => '阶段',
                    'view_type'         => 'field',
                    'view_key'          => 'stage',
                    'is_sort'           => 1,
                    'width'             => 100,
                    'search_config'     => [
                        'form_type'         => 'select',
                        'form_name'         => 'stage',
                        'where_type'        => 'in',
                        'data'              => $this->StageList(),
                        'data_key'          => 'value',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'         => '活动时间',
                    'view_type'     => 'module',
                    'view_key'      => 'activity/module/time',
                    'grid_size'     => 'sm',
                    'width'         => 170,
                ],
                [
                    'label'         => '报名数',
                    'view_type'     => 'field',
                    'view_key'      => 'signup_count',
                    'is_sort'       => 1,
                    'width'         => 80,
                    'align'         => 'center',
                ],
                [
                    'label'              => '状态',
                    'view_type'          => 'status',
                    'view_key'           => 'is_enable',
                    'post_url'           => MyUrl('admin/activity/statusupdate'),
                    'is_form_su'         => 1,
                    'align'              => 'center',
                    'is_sort'            => 1,
                    'width'              => 130,
                    'params_where_name'  => 'is_enable',
                    'search_config'      => [
                        'form_type'         => 'select',
                        'where_type'        => 'in',
                        'data'              => MyConst('common_is_text_list'),
                        'data_key'          => 'id',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'         => '添加时间',
                    'view_type'     => 'field',
                    'view_key'      => 'add_time',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'datetime',
                    ],
                ],
                [
                    'label'         => MyLang('operate_title'),
                    'view_type'     => 'operate',
                    'view_key'      => 'activity/module/operate',
                    'align'         => 'center',
                    'fixed'         => 'right',
                ],
            ],
            'data'  => [
                'table_name'    => 'Activity',
                'data_handle'   => 'app\service\ActivityService::ActivityListHandle',
            ],
        ];
    }

    public function CategoryList()
    {
        return [
            ['value' => 'classroom', 'name' => '孕妈课堂'],
            ['value' => 'salon', 'name' => '线下沙龙'],
            ['value' => 'lecture', 'name' => '育儿讲座'],
            ['value' => 'trial', 'name' => '试用官招募'],
            ['value' => 'holiday', 'name' => '节日活动'],
            ['value' => 'checkin', 'name' => '签到打卡'],
        ];
    }

    public function StageList()
    {
        return [
            ['value' => 'prepare', 'name' => '备孕'],
            ['value' => 'pregnancy', 'name' => '孕期'],
            ['value' => 'postpartum', 'name' => '产后'],
            ['value' => 'all', 'name' => '通用'],
        ];
    }
}
?>
