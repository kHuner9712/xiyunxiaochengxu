<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;

class UserTagService
{
    public static function TagList($params = [])
    {
        $where = [];
        if (!empty($params['is_enable'])) {
            $where[] = ['is_enable', '=', intval($params['is_enable'])];
        }
        if (!empty($params['name'])) {
            $where[] = ['name', 'like', '%' . $params['name'] . '%'];
        }

        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'sort_level asc, id asc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 100;

        $data = Db::name('MuyingUserTag')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        foreach ($data as $k => &$v) {
            $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            $v['upd_time_text'] = empty($v['upd_time']) ? '' : date('Y-m-d H:i:s', $v['upd_time']);
            $v['user_count'] = Db::name('MuyingUserTagRel')->where(['tag_id' => $v['id']])->count();
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function TagTotal($where = [])
    {
        return (int) Db::name('MuyingUserTag')->where($where)->count();
    }

    public static function TagSave($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        $name = isset($params['name']) ? trim($params['name']) : '';
        $color = isset($params['color']) ? trim($params['color']) : '#F5A0B1';
        $sort_level = isset($params['sort_level']) ? intval($params['sort_level']) : 0;
        $is_enable = isset($params['is_enable']) ? intval($params['is_enable']) : 1;

        if (empty($name)) {
            return DataReturn('标签名称不能为空', -1);
        }

        $exists = Db::name('MuyingUserTag')->where(['name' => $name])->find();
        if (!empty($exists) && $exists['id'] != $id) {
            return DataReturn('标签名称已存在', -1);
        }

        $data = [
            'name'       => $name,
            'color'      => $color,
            'sort_level' => $sort_level,
            'is_enable'  => $is_enable,
            'upd_time'   => time(),
        ];

        if ($id > 0) {
            $result = Db::name('MuyingUserTag')->where(['id' => $id])->update($data);
            if ($result !== false) {
                return DataReturn('编辑成功', 0);
            }
            return DataReturn('编辑失败', -1);
        }

        $data['add_time'] = time();
        $result = Db::name('MuyingUserTag')->insertGetId($data);
        if ($result > 0) {
            return DataReturn('添加成功', 0);
        }
        return DataReturn('添加失败', -1);
    }

    public static function TagDelete($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('标签ID不能为空', -1);
        }

        Db::startTrans();
        try {
            Db::name('MuyingUserTagRel')->where(['tag_id' => $id])->delete();
            Db::name('MuyingUserTag')->where(['id' => $id])->delete();
            Db::commit();
            return DataReturn('删除成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('标签删除失败 id=' . $id . ' error=' . $e->getMessage());
            return DataReturn('删除失败', -1);
        }
    }

    public static function TagStatusUpdate($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('标签ID不能为空', -1);
        }
        $is_enable = isset($params['is_enable']) ? intval($params['is_enable']) : 0;
        $result = Db::name('MuyingUserTag')->where(['id' => $id])->update([
            'is_enable' => $is_enable,
            'upd_time'  => time(),
        ]);
        if ($result !== false) {
            return DataReturn('操作成功', 0);
        }
        return DataReturn('操作失败', -1);
    }

    public static function UserTags($user_id)
    {
        $tag_ids = Db::name('MuyingUserTagRel')->where(['user_id' => $user_id])->column('tag_id');
        if (empty($tag_ids)) {
            return [];
        }
        return Db::name('MuyingUserTag')->where(['id' => $tag_ids, 'is_enable' => 1])->field('id,name,color')->order('sort_level asc')->select()->toArray();
    }

    public static function UserTagSet($params = [])
    {
        $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
        $tag_ids = isset($params['tag_ids']) ? $params['tag_ids'] : [];

        if ($user_id <= 0) {
            return DataReturn('用户ID不能为空', -1);
        }

        Db::startTrans();
        try {
            Db::name('MuyingUserTagRel')->where(['user_id' => $user_id])->delete();

            if (!empty($tag_ids) && is_array($tag_ids)) {
                $insert_data = [];
                foreach ($tag_ids as $tag_id) {
                    $insert_data[] = [
                        'user_id'  => $user_id,
                        'tag_id'   => intval($tag_id),
                        'add_time' => time(),
                    ];
                }
                Db::name('MuyingUserTagRel')->insertAll($insert_data);
            }

            Db::commit();
            return DataReturn('标签设置成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('用户标签设置失败 user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('标签设置失败', -1);
        }
    }

    public static function AdminUserRemark($params = [])
    {
        $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
        $remark = isset($params['admin_remark']) ? trim($params['admin_remark']) : '';

        if ($user_id <= 0) {
            return DataReturn('用户ID不能为空', -1);
        }

        $result = Db::name('User')->where(['id' => $user_id])->update([
            'admin_remark' => $remark,
        ]);
        if ($result !== false) {
            return DataReturn('备注保存成功', 0);
        }
        return DataReturn('备注保存失败', -1);
    }
}
