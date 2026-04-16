<?php
namespace app\admin\form;

use think\facade\Db;

class Invite
{
    public $condition_base = [];

    public function Run($params = [])
    {
        return [
            'base' => [
                'key_field'     => 'id',
                'is_search'     => 1,
                'is_middle'     => 0,
            ],
            'form' => [
                [
                    'label'         => 'ID',
                    'view_type'     => 'field',
                    'view_key'      => 'id',
                    'width'         => 80,
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'input',
                        'where_type'        => '=',
                    ],
                ],
                [
                    'label'         => '邀请人',
                    'view_type'     => 'module',
                    'view_key'      => 'invite/module/inviter',
                    'grid_size'     => 'sm',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'             => 'input',
                        'form_name'             => 'inviter_id',
                        'where_type_custom'     => 'in',
                        'where_value_custom'    => 'WhereValueInviterNickname',
                        'placeholder'           => '邀请人昵称/用户名',
                    ],
                ],
                [
                    'label'         => '被邀请人',
                    'view_type'     => 'module',
                    'view_key'      => 'invite/module/invitee',
                    'grid_size'     => 'sm',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'             => 'input',
                        'form_name'             => 'invitee_id',
                        'where_type_custom'     => 'in',
                        'where_value_custom'    => 'WhereValueInviteeNickname',
                        'placeholder'           => '被邀请人昵称/用户名',
                    ],
                ],
                [
                    'label'         => '触发事件',
                    'view_type'     => 'field',
                    'view_key'      => 'trigger_event_text',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'select',
                        'form_name'         => 'trigger_event',
                        'where_type'        => 'in',
                        'data'              => [
                            ['value' => 'register', 'name' => '注册'],
                            ['value' => 'first_order', 'name' => '首单'],
                        ],
                        'data_key'          => 'value',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'         => '奖励类型',
                    'view_type'     => 'field',
                    'view_key'      => 'reward_type_text',
                    'is_sort'       => 1,
                ],
                [
                    'label'         => '奖励值',
                    'view_type'     => 'field',
                    'view_key'      => 'reward_value',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'section',
                    ],
                ],
                [
                    'label'              => '状态',
                    'view_type'          => 'field',
                    'view_key'           => 'status_text',
                    'is_round_point'     => 1,
                    'round_point_key'    => 'status',
                    'round_point_style'  => [0=>'warning', 1=>'success', 2=>'danger'],
                    'is_sort'            => 1,
                    'search_config'      => [
                        'form_type'         => 'select',
                        'form_name'         => 'status',
                        'where_type'        => 'in',
                        'data'              => [
                            ['value' => 0, 'name' => '待发放'],
                            ['value' => 1, 'name' => '已发放'],
                            ['value' => 2, 'name' => '已取消'],
                        ],
                        'data_key'          => 'value',
                        'data_name'         => 'name',
                        'is_multiple'       => 1,
                    ],
                ],
                [
                    'label'         => '时间',
                    'view_type'     => 'field',
                    'view_key'      => 'add_time_text',
                    'is_sort'       => 1,
                    'search_config' => [
                        'form_type'         => 'datetime',
                        'form_name'         => 'add_time',
                    ],
                ],
                [
                    'label'         => '操作',
                    'view_type'     => 'operate',
                    'view_key'      => 'invite/module/operate',
                    'align'         => 'center',
                    'fixed'         => 'right',
                    'width'         => 80,
                ],
            ],
            'data'  => [
                'table_name'           => 'InviteReward',
                'data_handle'          => 'InviteService::AdminInviteRewardListHandle',
                'is_fixed_name_field'  => 1,
                'fixed_name_data'      => [
                    'status'  => [
                        'data'  => [
                            ['id' => 0, 'name' => '待发放'],
                            ['id' => 1, 'name' => '已发放'],
                            ['id' => 2, 'name' => '已取消'],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function WhereValueInviterNickname($value, $params = [])
    {
        if (!empty($value)) {
            $ids = Db::name('User')->where('nickname|username', 'like', '%'.$value.'%')->column('id');
            return empty($ids) ? [0] : $ids;
        }
        return $value;
    }

    public function WhereValueInviteeNickname($value, $params = [])
    {
        if (!empty($value)) {
            $ids = Db::name('User')->where('nickname|username', 'like', '%'.$value.'%')->column('id');
            return empty($ids) ? [0] : $ids;
        }
        return $value;
    }
}
