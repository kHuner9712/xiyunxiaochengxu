var BASE_DISABLED_PLUGIN_NAMES = ['excellentbuyreturntocash', 'exchangerate', 'goodscompare', 'orderfeed', 'ordergoodsform', 'orderresources', 'antifakecode', 'form', 'binding', 'label'];

var DYNAMIC_DISABLED_PLUGIN_NAMES = ['distribution', 'wallet', 'coin', 'shop', 'realstore', 'ask', 'blog', 'membershiplevelvip', 'seckill', 'coupon', 'signin', 'points', 'video', 'hospital', 'giftcard', 'givegift', 'complaint', 'invoice', 'certificate', 'scanpay', 'weixinliveplayer', 'intellectstools', 'activity', 'magic'];

var PHASE_ONE_DISABLED_PLUGIN_NAMES = BASE_DISABLED_PLUGIN_NAMES.concat(DYNAMIC_DISABLED_PLUGIN_NAMES);

import { FeatureFlagKey } from './muying-constants.js';

var FEATURE_FLAG_PLUGIN_MAP = {};
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SHOP] = 'shop';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.REALSTORE] = 'realstore';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.DISTRIBUTION] = 'distribution';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.WALLET] = 'wallet';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COIN] = 'coin';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.UGC] = ['ask', 'blog'];
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.MEMBERSHIP] = 'membershiplevelvip';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SECKILL] = 'seckill';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COUPON] = 'coupon';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SIGNIN] = 'signin';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.POINTS] = 'points';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.VIDEO] = 'video';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.HOSPITAL] = 'hospital';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.GIFTCARD] = 'giftcard';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.GIVEGIFT] = 'givegift';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.COMPLAINT] = 'complaint';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.INVOICE] = 'invoice';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.CERTIFICATE] = 'certificate';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.SCANPAY] = 'scanpay';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.LIVE] = 'weixinliveplayer';
FEATURE_FLAG_PLUGIN_MAP[FeatureFlagKey.INTELLECTSTOOLS] = 'intellectstools';

var PHASE_ONE_ALLOWED_FLAGS = {};
PHASE_ONE_ALLOWED_FLAGS[FeatureFlagKey.ACTIVITY] = true;
PHASE_ONE_ALLOWED_FLAGS[FeatureFlagKey.INVITE] = true;
PHASE_ONE_ALLOWED_FLAGS[FeatureFlagKey.CONTENT] = true;
PHASE_ONE_ALLOWED_FLAGS[FeatureFlagKey.FEEDBACK] = true;

var _feature_flags = null;

function _merge_disabled_list() {
    var dynamic = DYNAMIC_DISABLED_PLUGIN_NAMES.slice();
    for (var flag_key in FEATURE_FLAG_PLUGIN_MAP) {
        var plugin_names = FEATURE_FLAG_PLUGIN_MAP[flag_key];
        var is_enabled = _feature_flags && !!_feature_flags[flag_key];
        if (is_enabled) {
            if (Array.isArray(plugin_names)) {
                for (var i = dynamic.length - 1; i >= 0; i--) {
                    if (plugin_names.indexOf(dynamic[i]) !== -1) {
                        dynamic.splice(i, 1);
                    }
                }
            } else {
                var idx = dynamic.indexOf(plugin_names);
                if (idx !== -1) {
                    dynamic.splice(idx, 1);
                }
            }
        } else {
            if (Array.isArray(plugin_names)) {
                for (var i = 0; i < plugin_names.length; i++) {
                    if (dynamic.indexOf(plugin_names[i]) === -1) {
                        dynamic.push(plugin_names[i]);
                    }
                }
            } else {
                if (dynamic.indexOf(plugin_names) === -1) {
                    dynamic.push(plugin_names);
                }
            }
        }
    }
    return BASE_DISABLED_PLUGIN_NAMES.concat(dynamic);
}

function init_feature_flags(flags) {
    _feature_flags = flags || {};
    for (var key in _feature_flags) {
        if (_feature_flags.hasOwnProperty(key) && !PHASE_ONE_ALLOWED_FLAGS[key]) {
            _feature_flags[key] = 0;
        }
    }
    PHASE_ONE_DISABLED_PLUGIN_NAMES = _merge_disabled_list();
    _rebuild_route_prefixes();
}

function _rebuild_route_prefixes() {
    PHASE_ONE_DISABLED_ROUTE_PREFIXES = PHASE_ONE_DISABLED_PLUGIN_NAMES.map(function (name) {
        return '/pages/plugins/' + name + '/';
    });
}

var PHASE_ONE_DISABLED_ROUTE_PREFIXES = PHASE_ONE_DISABLED_PLUGIN_NAMES.map(function (name) {
    return '/pages/plugins/' + name + '/';
});

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

function is_feature_enabled(flag_key) {
    if (_feature_flags && typeof _feature_flags[flag_key] !== 'undefined') {
        return !!_feature_flags[flag_key];
    }
    if (PHASE_ONE_ALLOWED_FLAGS[flag_key]) {
        return true;
    }
    return false;
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

export { BASE_DISABLED_PLUGIN_NAMES, DYNAMIC_DISABLED_PLUGIN_NAMES, PHASE_ONE_DISABLED_PLUGIN_NAMES, PHASE_ONE_DISABLED_ROUTE_PREFIXES, FEATURE_FLAG_PLUGIN_MAP, init_feature_flags, normalize_page_path, is_phase_one_disabled_route, is_phase_one_disabled_plugin, is_feature_enabled, filter_phase_one_navigation, filter_phase_one_plugin_sort_list };
