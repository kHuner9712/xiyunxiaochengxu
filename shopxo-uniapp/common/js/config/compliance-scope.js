import { FeatureFlagKey, QualificationKey } from './muying-constants.js';

var PERMANENTLY_BLOCKED_PLUGINS = [
    'excellentbuyreturntocash', 'exchangerate', 'goodscompare',
    'orderfeed', 'ordergoodsform', 'orderresources',
    'antifakecode', 'form', 'binding', 'label',
];

var PHASE_ONE_BLOCKED_PLUGINS = [
    'distribution', 'wallet', 'coin', 'shop', 'realstore',
    'ask', 'blog', 'membershiplevelvip', 'seckill', 'video',
    'hospital', 'giftcard', 'givegift', 'complaint', 'invoice',
    'certificate', 'scanpay', 'weixinliveplayer', 'intellectstools',
    'coupon', 'signin', 'points',
];

var PHASE_ONE_ALLOWED_PLUGINS = [
    'brand', 'delivery', 'express',
];

var PHASE_ONE_ALLOWED_ROUTES = [
    '/pages/index/index',
    '/pages/goods-category/goods-category',
    '/pages/activity/activity',
    '/pages/cart/cart',
    '/pages/user/user',
    '/pages/goods-detail/goods-detail',
    '/pages/goods-search/goods-search',
    '/pages/goods-search-start/goods-search-start',
    '/pages/goods-comment/goods-comment',
    '/pages/buy/buy',
    '/pages/cart-page/cart-page',
    '/pages/user-order/user-order',
    '/pages/user-order-detail/user-order-detail',
    '/pages/user-orderaftersale/user-orderaftersale',
    '/pages/user-orderaftersale-detail/user-orderaftersale-detail',
    '/pages/user-order-comments/user-order-comments',
    '/pages/user-goods-comments/user-goods-comments',
    '/pages/user-goods-comments-form/user-goods-comments-form',
    '/pages/user-favor/user-favor',
    '/pages/user-goods-browse/user-goods-browse',
    '/pages/user-address/user-address',
    '/pages/user-address-save/user-address-save',
    '/pages/message/message',
    '/pages/personal/personal',
    '/pages/setup/setup',
    '/pages/login/login',
    '/pages/logout/logout',
    '/pages/password/password',
    '/pages/about/about',
    '/pages/agreement/agreement',
    '/pages/error/error',
    '/pages/article-category/article-category',
    '/pages/article-detail/article-detail',
    '/pages/common/open-setting-location/open-setting-location',
    '/pages/activity-detail/activity-detail',
    '/pages/activity-signup/activity-signup',
    '/pages/my-activity/my-activity',
    '/pages/my-invite/my-invite',
    '/pages/invite/invite',
    '/pages/feedback-submit/feedback-submit',
    '/pages/plugins/brand/',
    '/pages/plugins/express/',
    '/pages/plugins/delivery/',
];

var FEATURE_FLAG_PLUGIN_MAP = {};
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SHOP] = 'shop';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.REALSTORE] = 'realstore';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.DISTRIBUTION] = 'distribution';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.WALLET] = 'wallet';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COIN] = 'coin';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.UGC] = ['ask', 'blog'];
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.MEMBERSHIP] = 'membershiplevelvip';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SECKILL] = 'seckill';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.GIFTCARD] = 'giftcard';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.GIVEGIFT] = 'givegift';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.VIDEO] = 'video';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.HOSPITAL] = 'hospital';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COMPLAINT] = 'complaint';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.INVOICE] = 'invoice';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.CERTIFICATE] = 'certificate';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SCANPAY] = 'scanpay';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.LIVE] = 'weixinliveplayer';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.INTELLECTSTOOLS] = 'intellectstools';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COUPON] = 'coupon';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SIGNIN] = 'signin';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.POINTS] = 'points';

var QUALIFICATION_REQUIRED_MAP = {};
QUALIFICATION_REQUIRED_MAP['shop'] = [QualificationKey.ICP_COMMERCIAL, QualificationKey.EDI];
QUALIFICATION_REQUIRED_MAP['realstore'] = [QualificationKey.ICP_COMMERCIAL, QualificationKey.EDI];
QUALIFICATION_REQUIRED_MAP['distribution'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['wallet'] = [QualificationKey.PAYMENT];
QUALIFICATION_REQUIRED_MAP['coin'] = [QualificationKey.PAYMENT];
QUALIFICATION_REQUIRED_MAP['ask'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['blog'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['membershiplevelvip'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['seckill'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['giftcard'] = [QualificationKey.PAYMENT];
QUALIFICATION_REQUIRED_MAP['givegift'] = [QualificationKey.PAYMENT];
QUALIFICATION_REQUIRED_MAP['video'] = [QualificationKey.LIVE];
QUALIFICATION_REQUIRED_MAP['hospital'] = [QualificationKey.MEDICAL];
QUALIFICATION_REQUIRED_MAP['complaint'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['invoice'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['certificate'] = [QualificationKey.ICP_COMMERCIAL];
QUALIFICATION_REQUIRED_MAP['scanpay'] = [QualificationKey.PAYMENT];
QUALIFICATION_REQUIRED_MAP['weixinliveplayer'] = [QualificationKey.LIVE];
QUALIFICATION_REQUIRED_MAP['intellectstools'] = [QualificationKey.ICP_COMMERCIAL];

var _feature_flags = null;
var _qualifications = null;

function init_compliance(flags, qualifications) {
    _feature_flags = flags || {};
    _qualifications = qualifications || {};
}

function is_feature_enabled(flag_key) {
    if (_feature_flags && typeof _feature_flags[flag_key] !== 'undefined') {
        return !!_feature_flags[flag_key];
    }
    return false;
}

function is_qualification_met(qual_key) {
    if (_qualifications && typeof _qualifications[qual_key] !== 'undefined') {
        return !!_qualifications[qual_key];
    }
    return false;
}

function is_qualification_met_for_plugin(plugin_name) {
    var required = QUALIFICATION_REQUIRED_MAP[plugin_name];
    if (!required || required.length === 0) {
        return true;
    }
    for (var i = 0; i < required.length; i++) {
        if (!is_qualification_met(required[i])) {
            return false;
        }
    }
    return true;
}

function is_feature_enabled_for_plugin(plugin_name) {
    for (var flag_key in FEATURE_FLAG_PLUGIN_MAP) {
        var plugin_names = FEATURE_FLAG_PLUGIN_MAP[flag_key];
        var names = Array.isArray(plugin_names) ? plugin_names : [plugin_names];
        for (var i = 0; i < names.length; i++) {
            if (names[i] === plugin_name) {
                return is_feature_enabled(flag_key);
            }
        }
    }
    return true;
}

function is_plugin_allowed(plugin_name) {
    if (!plugin_name) return false;
    var name = String(plugin_name).toLowerCase();
    if (PERMANENTLY_BLOCKED_PLUGINS.indexOf(name) !== -1) {
        return false;
    }
    if (PHASE_ONE_BLOCKED_PLUGINS.indexOf(name) !== -1) {
        if (!is_feature_enabled_for_plugin(name)) {
            return false;
        }
        if (!is_qualification_met_for_plugin(name)) {
            return false;
        }
    }
    return true;
}

function is_plugin_blocked(plugin_name) {
    return !is_plugin_allowed(plugin_name);
}

function get_block_reason(plugin_name) {
    var name = String(plugin_name || '').toLowerCase();
    if (!name) return '无效的插件标识';
    if (PERMANENTLY_BLOCKED_PLUGINS.indexOf(name) !== -1) {
        return '该功能暂未开放';
    }
    if (name === 'hospital') {
        return '医疗问诊功能暂未开放';
    }
    if (PHASE_ONE_BLOCKED_PLUGINS.indexOf(name) !== -1) {
        if (!is_feature_enabled_for_plugin(name)) {
            return '该功能暂未开放';
        }
        if (!is_qualification_met_for_plugin(name)) {
            return '当前资质暂不支持该功能';
        }
    }
    return '';
}

function normalize_page_path(url) {
    if ((url || null) == null) return '';
    var value = String(url).trim();
    if (value === '') return '';
    var query_index = value.indexOf('?');
    if (query_index !== -1) value = value.substring(0, query_index);
    var hash_index = value.indexOf('#');
    if (hash_index !== -1) value = value.substring(0, hash_index);
    if (value[0] !== '/') value = '/' + value;
    return value;
}

var _PAYMENT_ROUTES = [
    '/pages/cashier/cashier',
    '/pages/paytips/paytips',
    '/pages/paylog-list/paylog-list',
    '/pages/paylog-detail/paylog-detail',
];

var _DYNAMIC_PAGE_ROUTES = [
    '/pages/form-input/form-input',
    '/pages/diy/diy',
    '/pages/design/design',
];

function is_route_allowed(url) {
    var path = normalize_page_path(url);
    if (path === '') return false;
    for (var i = 0; i < _PAYMENT_ROUTES.length; i++) {
        if (path === _PAYMENT_ROUTES[i]) {
            return is_feature_enabled('feature_payment_enabled');
        }
    }
    for (var i = 0; i < _DYNAMIC_PAGE_ROUTES.length; i++) {
        if (path === _DYNAMIC_PAGE_ROUTES[i]) {
            return is_feature_enabled('feature_dynamic_page_enabled');
        }
    }
    for (var i = 0; i < PHASE_ONE_ALLOWED_ROUTES.length; i++) {
        var allowed = PHASE_ONE_ALLOWED_ROUTES[i];
        if (allowed.charAt(allowed.length - 1) === '/') {
            if (path.indexOf(allowed) === 0) return true;
        } else {
            if (path === allowed) return true;
        }
    }
    if (path.indexOf('/pages/plugins/') === 0) {
        var parts = path.split('/');
        if (parts.length >= 4) {
            var plugin_name = parts[3];
            if (is_plugin_allowed(plugin_name)) return true;
        }
    }
    return false;
}

function is_route_blocked(url) {
    return !is_route_allowed(url);
}

function get_blocked_route_reason(url) {
    if (is_route_allowed(url)) return '';
    var path = normalize_page_path(url);
    for (var i = 0; i < _PAYMENT_ROUTES.length; i++) {
        if (path === _PAYMENT_ROUTES[i]) {
            return '线上支付暂未开放';
        }
    }
    if (path.indexOf('/pages/plugins/') === 0) {
        var parts = path.split('/');
        if (parts.length >= 4) {
            var plugin_name = parts[3];
            return get_block_reason(plugin_name);
        }
    }
    return '该功能暂未开放';
}

function filter_navigation(list) {
    if (!Array.isArray(list) || list.length <= 0) return [];
    var result = [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || null;
        if (item == null) continue;
        var route_value = item.event_value || item.url || null;
        if (route_value && is_route_blocked(route_value)) continue;
        var next = Object.assign({}, item);
        if (Array.isArray(item.extension_data)) {
            next.extension_data = filter_navigation(item.extension_data);
        }
        result.push(next);
    }
    return result;
}

function filter_plugin_sort_list(list) {
    if (!Array.isArray(list) || list.length <= 0) return [];
    var result = [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || null;
        if (item == null || is_plugin_blocked(item.plugins)) continue;
        result.push(item);
    }
    return result;
}

function get_effective_blocked_plugins() {
    var blocked = [];
    var all = PERMANENTLY_BLOCKED_PLUGINS.concat(PHASE_ONE_BLOCKED_PLUGINS);
    for (var i = 0; i < all.length; i++) {
        if (is_plugin_blocked(all[i])) {
            blocked.push(all[i]);
        }
    }
    return blocked;
}

function get_effective_blocked_route_prefixes() {
    return get_effective_blocked_plugins().map(function (name) {
        return '/pages/plugins/' + name + '/';
    });
}

export {
    PERMANENTLY_BLOCKED_PLUGINS,
    PHASE_ONE_BLOCKED_PLUGINS,
    PHASE_ONE_ALLOWED_PLUGINS,
    PHASE_ONE_ALLOWED_ROUTES,
    FEATURE_FLAG_PLUGIN_MAP,
    QUALIFICATION_REQUIRED_MAP,
    init_compliance,
    is_feature_enabled,
    is_qualification_met,
    is_qualification_met_for_plugin,
    is_feature_enabled_for_plugin,
    is_plugin_allowed,
    is_plugin_blocked,
    get_block_reason,
    normalize_page_path,
    is_route_allowed,
    is_route_blocked,
    get_blocked_route_reason,
    filter_navigation,
    filter_plugin_sort_list,
    get_effective_blocked_plugins,
    get_effective_blocked_route_prefixes,
};
