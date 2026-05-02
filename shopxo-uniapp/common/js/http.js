import { is_feature_enabled } from './config/phase-one-scope.js';
import { FeatureFlagKey, TipMessage, RoutePath } from './config/muying-constants.js';
import { is_plugin_allowed } from './config/compliance-scope.js';
import { userStore } from './user-store.js';
import { logger } from './logger.js';

var FEATURE_FLAG_ACTION_MAP = {};
FEATURE_FLAG_ACTION_MAP['activity'] = FeatureFlagKey.ACTIVITY;
FEATURE_FLAG_ACTION_MAP['invite'] = FeatureFlagKey.INVITE;
FEATURE_FLAG_ACTION_MAP['feedback'] = FeatureFlagKey.FEEDBACK;
FEATURE_FLAG_ACTION_MAP['article'] = FeatureFlagKey.CONTENT;
FEATURE_FLAG_ACTION_MAP['coupon'] = FeatureFlagKey.COUPON;
FEATURE_FLAG_ACTION_MAP['points'] = FeatureFlagKey.POINTS;
FEATURE_FLAG_ACTION_MAP['userintegral'] = FeatureFlagKey.POINTS;
FEATURE_FLAG_ACTION_MAP['signin'] = FeatureFlagKey.SIGNIN;
FEATURE_FLAG_ACTION_MAP['seckill'] = FeatureFlagKey.SECKILL;
FEATURE_FLAG_ACTION_MAP['shop'] = FeatureFlagKey.SHOP;
FEATURE_FLAG_ACTION_MAP['realstore'] = FeatureFlagKey.REALSTORE;
FEATURE_FLAG_ACTION_MAP['distribution'] = FeatureFlagKey.DISTRIBUTION;
FEATURE_FLAG_ACTION_MAP['wallet'] = FeatureFlagKey.WALLET;
FEATURE_FLAG_ACTION_MAP['coin'] = FeatureFlagKey.COIN;
FEATURE_FLAG_ACTION_MAP['video'] = FeatureFlagKey.VIDEO;
FEATURE_FLAG_ACTION_MAP['hospital'] = FeatureFlagKey.HOSPITAL;
FEATURE_FLAG_ACTION_MAP['membershiplevelvip'] = FeatureFlagKey.MEMBERSHIP;
FEATURE_FLAG_ACTION_MAP['muyinguser'] = FeatureFlagKey.MEMBERSHIP;
FEATURE_FLAG_ACTION_MAP['giftcard'] = FeatureFlagKey.GIFTCARD;
FEATURE_FLAG_ACTION_MAP['givegift'] = FeatureFlagKey.GIVEGIFT;
FEATURE_FLAG_ACTION_MAP['certificate'] = FeatureFlagKey.CERTIFICATE;
FEATURE_FLAG_ACTION_MAP['scanpay'] = FeatureFlagKey.SCANPAY;
FEATURE_FLAG_ACTION_MAP['weixinliveplayer'] = FeatureFlagKey.LIVE;
FEATURE_FLAG_ACTION_MAP['intellectstools'] = FeatureFlagKey.INTELLECTSTOOLS;
FEATURE_FLAG_ACTION_MAP['complaint'] = FeatureFlagKey.COMPLAINT;
FEATURE_FLAG_ACTION_MAP['invoice'] = FeatureFlagKey.INVOICE;
FEATURE_FLAG_ACTION_MAP['ask'] = FeatureFlagKey.UGC;
FEATURE_FLAG_ACTION_MAP['blog'] = FeatureFlagKey.UGC;
FEATURE_FLAG_ACTION_MAP['cashier'] = FeatureFlagKey.PAYMENT;
FEATURE_FLAG_ACTION_MAP['paylog'] = FeatureFlagKey.PAYMENT;
FEATURE_FLAG_ACTION_MAP['forminput'] = FeatureFlagKey.DYNAMIC_PAGE;
FEATURE_FLAG_ACTION_MAP['diy'] = FeatureFlagKey.DYNAMIC_PAGE;
FEATURE_FLAG_ACTION_MAP['design'] = FeatureFlagKey.DYNAMIC_PAGE;

var LOGIN_EXPIRED_CODES = [-100, -9999];
var FEATURE_DISABLED_CODE = -403;
// [MUYING-二开] 隐私配置异常码
var PRIVACY_ERROR_CODE = -500;
var DEFAULT_LOADING_TITLE = '加载中...';
var _loading_count = 0;

function _normalize_response_data(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return data;
    }
    if ('data' in data && ('total' in data || 'page_total' in data)) {
        logger.warn('HTTP', '响应使用旧格式 data.data，已自动转为 data.items，后端应尽快迁移');
        data.items = data.data;
        delete data.data;
    }
    return data;
}

function _show_loading(title) {
    _loading_count++;
    if (_loading_count === 1) {
        uni.showLoading({ title: title || DEFAULT_LOADING_TITLE, mask: true });
    }
}

function _hide_loading() {
    _loading_count = Math.max(0, _loading_count - 1);
    if (_loading_count === 0) {
        uni.hideLoading();
    }
}

function _handle_login_expired(msg) {
    logger.warn('HTTP', '登录失效 ' + msg);
    userStore.clear();
    var pages = getCurrentPages();
    var current = pages[pages.length - 1];
    var current_route = current ? '/' + current.route : '';
    if (current_route.indexOf(RoutePath.LOGIN) === -1) {
        uni.showToast({ title: TipMessage.LOGIN_EXPIRED, icon: 'none', duration: 2000 });
        setTimeout(function () {
            uni.navigateTo({ url: RoutePath.LOGIN });
        }, 1500);
    }
}

/**
 * request(options) - 统一请求封装
 *
 * @param {Object} options
 * @param {string} options.action        - 接口动作名，如 'index', 'detail', 'signup'
 * @param {string} options.controller    - 控制器名，如 'activity', 'invite', 'personal'
 * @param {string} [options.plugins]     - 插件名，默认 null
 * @param {string} [options.params]      - URL 附加参数
 * @param {string} [options.group='api'] - 请求分组，默认 'api'
 * @param {string} [options.method='POST'] - 请求方法
 * @param {Object} [options.data={}]     - 请求数据
 * @param {string} [options.dataType='json'] - 数据类型
 * @param {boolean} [options.loading=true]   - 是否显示 loading，默认 true
 * @param {string}  [options.loading_title]  - loading 文案，默认 '加载中...'
 * @param {boolean} [options.silent=false]   - 静默模式，不自动 showToast
 * @param {Function} [options.success]  - 成功回调 (data, res) => void
 * @param {Function} [options.fail]     - 失败回调 ({ errMsg, code, ... }) => void
 * @param {Function} [options.complete] - 完成回调 (res) => void
 *
 * fail 回调额外字段：
 * - login_expired: boolean  - 登录失效
 * - feature_disabled: boolean - 功能开关关闭
 * - network_error: boolean - 网络错误
 */
function request(options) {
    var app = getApp();
    if (!app || !app.globalData) {
        logger.error('HTTP', 'getApp() 失败，无法发起请求');
        if (options.fail) options.fail({ errMsg: '应用未初始化' });
        return;
    }

    var action = options.action || 'index';
    var controller = options.controller || 'index';
    var plugins = options.plugins || null;
    var params = options.params || '';
    var group = options.group || 'api';

    var feature_flag_key = FEATURE_FLAG_ACTION_MAP[controller];
    if (feature_flag_key && !is_feature_enabled(feature_flag_key)) {
        logger.warn('HTTP', '功能已关闭，拦截请求 ' + controller + '/' + action);
        if (!options.silent) {
            uni.showToast({ title: TipMessage.FEATURE_DISABLED, icon: 'none', duration: 2000 });
        }
        if (options.fail) {
            options.fail({ errMsg: TipMessage.FEATURE_DISABLED, code: -1, feature_disabled: true });
        }
        if (options.complete) options.complete();
        return;
    }

    if (plugins && !is_plugin_allowed(plugins)) {
        logger.warn('HTTP', '插件已屏蔽，拦截请求 plugins=' + plugins);
        if (!options.silent) {
            uni.showToast({ title: TipMessage.FEATURE_DISABLED, icon: 'none', duration: 2000 });
        }
        if (options.fail) {
            options.fail({ errMsg: TipMessage.FEATURE_DISABLED, code: -1, feature_disabled: true });
        }
        if (options.complete) options.complete();
        return;
    }

    var url = app.globalData.get_request_url(action, controller, plugins, params, group);

    var show_loading = options.loading !== false;
    if (show_loading) {
        _show_loading(options.loading_title);
    }

    var request_data = options.data || {};

    // [MUYING-二开] 提取 token 和 UUID 用于 Header 传输（兼容增强）
    // TODO: 后续后端兼容 Header token 后，移除 query token 传递
    var user = app.globalData.get_user_cache_info();
    var token = user ? user.token || '' : '';
    var uuid = '';
    if (app.globalData && typeof app.globalData.request_uuid === 'function') {
        uuid = app.globalData.request_uuid();
    }

    var headers = {};
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    if (uuid) {
        headers['X-User-UUID'] = uuid;
    }

    uni.request({
        url: url,
        method: options.method || 'POST',
        data: request_data,
        dataType: options.dataType || 'json',
        header: headers,
        success: function (res) {
            if (show_loading) _hide_loading();

            if (!res.data || typeof res.data !== 'object') {
                logger.error('HTTP', '响应格式异常 ' + url);
                if (options.fail) options.fail({ errMsg: '服务器响应格式异常', statusCode: res.statusCode });
                if (options.complete) options.complete(res);
                return;
            }

            var code = res.data.code;
            var msg = res.data.msg || '';
            var data = res.data.data;

            if (LOGIN_EXPIRED_CODES.indexOf(code) !== -1) {
                _handle_login_expired(msg);
                if (options.fail) options.fail({ errMsg: msg || TipMessage.LOGIN_EXPIRED, code: code, login_expired: true });
                if (options.complete) options.complete(res);
                return;
            }

            if (code === FEATURE_DISABLED_CODE) {
                logger.warn('HTTP', '后端功能开关拦截 ' + controller + '/' + action);
                if (!options.silent) {
                    var app = getApp();
                    if (app && app.globalData && app.globalData.showToast) {
                        app.globalData.showToast(msg || TipMessage.FEATURE_DISABLED);
                    } else {
                        uni.showToast({ title: msg || TipMessage.FEATURE_DISABLED, icon: 'none', duration: 2000 });
                    }
                }
                if (options.fail) options.fail({ errMsg: msg || TipMessage.FEATURE_DISABLED, code: code, feature_disabled: true });
                if (options.complete) options.complete(res);
                return;
            }

            // [MUYING-二开] 隐私配置异常拦截，前端友好提示
            if (code === PRIVACY_ERROR_CODE) {
                logger.error('HTTP', '隐私配置异常 ' + controller + '/' + action + ' msg=' + msg);
                if (!options.silent) {
                    uni.showToast({ title: msg || '系统配置异常，请联系管理员', icon: 'none', duration: 3000 });
                }
                if (options.fail) options.fail({ errMsg: msg || '系统配置异常', code: code, privacy_error: true });
                if (options.complete) options.complete(res);
                return;
            }

            if (code == 0) {
                data = _normalize_response_data(data);
                if (options.success) options.success(data, res);
            } else {
                if (!options.silent) {
                    app.globalData.showToast(msg || '操作失败');
                }
                if (options.fail) options.fail({ errMsg: msg, code: code, data: data });
            }

            if (options.complete) options.complete(res);
        },
        fail: function (err) {
            if (show_loading) _hide_loading();

            logger.error('HTTP', '网络请求失败 ' + url);

            if (!options.silent) {
                app.globalData.showToast(TipMessage.NETWORK_ERROR);
            }

            if (options.fail) options.fail({ errMsg: (err && err.errMsg) || TipMessage.NETWORK_ERROR, network_error: true });
            if (options.complete) options.complete(err);
        },
    });
}

function get(options) {
    options.method = 'GET';
    return request(options);
}

function post(options) {
    options.method = 'POST';
    return request(options);
}

export { request, get, post, _show_loading, _hide_loading };
export default request;
