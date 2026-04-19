// [MUYING-二开] 一期范围过滤 - 控制哪些插件入口在用户中心/首页可见
// 新增隐藏项只需在 PHASE_ONE_DISABLED_PLUGIN_NAMES 数组中添加插件名

const PHASE_ONE_DISABLED_PLUGIN_NAMES = [
    'distribution',
    'wallet',
    'coin',
    'shop',
    'realstore',
    'ask',
    'blog',
    'membershiplevelvip',
];

const PHASE_ONE_DISABLED_ROUTE_PREFIXES = PHASE_ONE_DISABLED_PLUGIN_NAMES.map((name) => '/pages/plugins/' + name + '/').concat(['/pages/plugins/coupon/shop/shop']);

function normalize_page_path(url) {
    if ((url || null) == null) {
        return '';
    }
    var value = String(url).trim();
    if (value === '') {
        return '';
    }
    var query_index = value.indexOf('?');
    if (query_index !== -1) {
        value = value.substring(0, query_index);
    }
    var hash_index = value.indexOf('#');
    if (hash_index !== -1) {
        value = value.substring(0, hash_index);
    }
    if (value[0] !== '/') {
        value = '/' + value;
    }
    return value;
}

function is_phase_one_disabled_route(url) {
    var value = normalize_page_path(url);
    if (value === '') {
        return false;
    }
    for (var i = 0; i < PHASE_ONE_DISABLED_ROUTE_PREFIXES.length; i++) {
        var prefix = PHASE_ONE_DISABLED_ROUTE_PREFIXES[i];
        if (prefix[prefix.length - 1] === '/') {
            if (value.indexOf(prefix) === 0) {
                return true;
            }
        } else if (value === prefix) {
            return true;
        }
    }
    return false;
}

function is_phase_one_disabled_plugin(plugins) {
    if ((plugins || null) == null) {
        return false;
    }
    return PHASE_ONE_DISABLED_PLUGIN_NAMES.indexOf(String(plugins).toLowerCase()) !== -1;
}

function route_value_from_navigation_item(item) {
    if ((item || null) == null) {
        return null;
    }
    return item.event_value || item.url || null;
}

function filter_phase_one_navigation(list) {
    if (!Array.isArray(list) || list.length <= 0) {
        return [];
    }
    var result = [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || null;
        if (item == null) {
            continue;
        }
        var route_value = route_value_from_navigation_item(item);
        if (is_phase_one_disabled_route(route_value)) {
            continue;
        }
        var next = Object.assign({}, item);
        if (Array.isArray(item.extension_data)) {
            next.extension_data = filter_phase_one_navigation(item.extension_data);
        }
        result.push(next);
    }
    return result;
}

function filter_phase_one_plugin_sort_list(list) {
    if (!Array.isArray(list) || list.length <= 0) {
        return [];
    }
    var result = [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || null;
        if (item == null || is_phase_one_disabled_plugin(item.plugins)) {
            continue;
        }
        result.push(item);
    }
    return result;
}

export {
    PHASE_ONE_DISABLED_PLUGIN_NAMES,
    PHASE_ONE_DISABLED_ROUTE_PREFIXES,
    normalize_page_path,
    is_phase_one_disabled_route,
    is_phase_one_disabled_plugin,
    filter_phase_one_navigation,
    filter_phase_one_plugin_sort_list,
};
