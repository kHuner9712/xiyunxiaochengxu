import { logger } from './logger.js';

var _cache_key = null;
var _SENSITIVE_KEYS = ['mobile', 'email', 'phone', 'due_date', 'baby_birthday', 'baby_month_age'];

function _get_cache_key() {
    if (_cache_key) return _cache_key;
    try {
        var app = getApp();
        if (app && app.globalData && app.globalData.data) {
            _cache_key = app.globalData.data.cache_user_info_key;
        }
    } catch (e) {
        // ignore
    }
    return _cache_key;
}

function get() {
    var key = _get_cache_key();
    if (!key) return null;
    try {
        var data = uni.getStorageSync(key);
        return data || null;
    } catch (e) {
        logger.error('[UserStore] 读取用户缓存失败', e);
        return null;
    }
}

function set(user_info) {
    if (!user_info || typeof user_info !== 'object') {
        logger.warn('[UserStore] 尝试写入无效用户数据', user_info);
        return false;
    }
    var key = _get_cache_key();
    if (!key) {
        logger.error('[UserStore] 无法获取缓存 key，写入失败');
        return false;
    }
    try {
        var prev = get();
        if (prev && prev.token && !user_info.token) {
            user_info.token = prev.token;
        }
        for (var i = 0; i < _SENSITIVE_KEYS.length; i++) {
            delete user_info[_SENSITIVE_KEYS[i]];
        }
        uni.setStorageSync(key, user_info);
        return true;
    } catch (e) {
        logger.error('[UserStore] 写入用户缓存失败', e);
        return false;
    }
}

function merge(partial) {
    if (!partial || typeof partial !== 'object') {
        return false;
    }
    var current = get();
    if (!current) {
        return set(partial);
    }
    for (var key in partial) {
        if (partial.hasOwnProperty(key)) {
            if (_SENSITIVE_KEYS.indexOf(key) !== -1) {
                continue;
            }
            current[key] = partial[key];
        }
    }
    return set(current);
}

function getToken() {
    var user = get();
    return user ? user.token || '' : '';
}

function getStage() {
    var user = get();
    return user ? user.current_stage || '' : '';
}

function isLoggedIn() {
    var user = get();
    return !!(user && user.token);
}

function clear() {
    var key = _get_cache_key();
    if (!key) return;
    try {
        uni.removeStorageSync(key);
    } catch (e) {
        logger.error('[UserStore] 清除用户缓存失败', e);
    }
}

export var userStore = {
    get: get,
    set: set,
    merge: merge,
    getToken: getToken,
    getStage: getStage,
    isLoggedIn: isLoggedIn,
    clear: clear,
};

export default userStore;
