#!/usr/bin/env node
// ============================================================
// 禧孕小程序 — 一期提审前自检脚本
// ============================================================
//
// 用法: node scripts/check-phase1-release.js [仓库根目录]
// 默认仓库根目录为当前工作目录
//
// 检查项:
//   1. pages.json 是否包含高风险页面
//   2. .env.example 是否泄露真实密钥
//   3. manifest/project.config 是否硬编码测试 AppID
//   4. 生产配置是否缺少 HTTPS 校验
//   5. 常见高风险关键词是否出现在可访问页面配置里
//
// 输出等级: PASS / WARN / BLOCKER
// 退出码: 0=无 BLOCKER, 1=存在 BLOCKER
// ============================================================

'use strict';

var fs = require('fs');
var path = require('path');

var REPO = process.argv[2] || process.cwd();

var PASS = 0, WARN = 0, BLOCK = 0;

function pass(msg) { PASS++; console.log('\x1b[32m[PASS]\x1b[0m ' + msg); }
function warn(msg) { WARN++; console.log('\x1b[33m[WARN]\x1b[0m ' + msg); }
function blocker(msg) { BLOCK++; console.log('\x1b[31m[BLOCKER]\x1b[0m ' + msg); }
function info(msg) { console.log('\x1b[36m[INFO]\x1b[0m ' + msg); }

function section(title) {
    console.log('');
    console.log('==========================================');
    console.log(' ' + title);
    console.log('==========================================');
}

function readFile(p) {
    try { return fs.readFileSync(p, 'utf-8'); } catch (e) { return null; }
}

function readJSON(p) {
    var content = readFile(p);
    if (!content) return null;
    content = content.replace(/\/\/.*$/gm, '');
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/[\x00-\x1f]/g, ' ');
    try { return JSON.parse(content); } catch (e1) {
        content = content.replace(/,\s*([\]}])/g, '$1');
        try { return JSON.parse(content); } catch (e2) {
            try { return (new Function('return (' + content + ')'))(); } catch (e3) {
                return null;
            }
        }
    }
}

function resolve() {
    var parts = [REPO];
    for (var i = 0; i < arguments.length; i++) parts.push(arguments[i]);
    return path.resolve.apply(null, parts);
}

function exists() { return fs.existsSync(resolve.apply(null, arguments)); }

// ============================================================
section('1. pages.json 高风险页面检查');
// ============================================================

var HIGH_RISK_PAGE_PATTERNS = [
    'wallet', 'coupon', 'points', 'distribution',
    'membershiplevelvip', 'invoice', 'giftcard', 'signin',
    'hospital', 'ask', 'blog', 'seckill', 'video',
    'complaint', 'scanpay', 'weixinliveplayer', 'intellectstools',
    'givegift', 'certificate', 'shop', 'realstore',
];

var ALLOWED_PLUGIN_SUBPACKAGES = ['brand', 'express', 'delivery'];

var pagesJsonPath = resolve('shopxo-uniapp', 'pages.json');
var pagesJsonContent = readFile(pagesJsonPath);

if (pagesJsonContent) {
    var highRiskFound = [];

    HIGH_RISK_PAGE_PATTERNS.forEach(function (pattern) {
        var isAllowed = ALLOWED_PLUGIN_SUBPACKAGES.indexOf(pattern) !== -1;
        if (isAllowed) return;

        var regex = new RegExp('plugins[\\\\/]' + pattern + '[\\\\/]', 'gi');
        if (regex.test(pagesJsonContent)) {
            highRiskFound.push(pattern);
        }
    });

    if (highRiskFound.length > 0) {
        blocker('pages.json 包含高风险插件路径: ' + highRiskFound.join(', '));
    } else {
        pass('pages.json 无高风险插件路径');
    }
} else {
    warn('pages.json 未找到: ' + pagesJsonPath);
}

// ============================================================
section('2. .env.example 密钥泄露检查');
// ============================================================

var envExampleFiles = [
    resolve('shopxo-uniapp', '.env.production.example'),
    resolve('shopxo-uniapp', '.env.staging.example'),
    resolve('shopxo-uniapp', '.env.release.example'),
    resolve('shopxo-backend', '.env.example'),
];

var SECRET_PATTERNS = [
    /[a-zA-Z0-9]{32,}/,
    /sk_[a-zA-Z0-9]+/,
    /key_[a-zA-Z0-9]+/,
    /secret[_-]?[a-zA-Z0-9]{8,}/i,
    /password\s*=\s*\S+/i,
];

envExampleFiles.forEach(function (filePath) {
    var content = readFile(filePath);
    if (!content) return;

    var relPath = path.relative(REPO, filePath);
    var hasLeak = false;
    var lines = content.split('\n');

    lines.forEach(function (line, idx) {
        var trimmed = line.trim();
        if (!trimmed || trimmed.charAt(0) === '#') return;
        if (trimmed.indexOf('{{') !== -1) return;
        if (trimmed.indexOf('placeholder') !== -1) return;
        if (trimmed.indexOf('example') !== -1) return;
        if (/^\w+=\s*$/.test(trimmed)) return;
        if (/^\w+=\s*false$/i.test(trimmed)) return;
        if (/^\w+=\s*true$/i.test(trimmed)) return;
        if (/^\w+=\s*\d+$/.test(trimmed)) return;
        if (/UNI_APP_ENV|UNI_APP_ENABLE_LOCATION/.test(trimmed)) return;

        SECRET_PATTERNS.forEach(function (pat) {
            if (pat.test(trimmed)) {
                warn(relPath + ':' + (idx + 1) + ' 可能包含真实密钥: ' + trimmed.substring(0, 60));
                hasLeak = true;
            }
        });
    });

    if (!hasLeak) {
        pass(relPath + ' 无明显密钥泄露');
    }
});

// ============================================================
section('3. AppID 与测试号检查');
// ============================================================

var TEST_APPIDS = ['wxda7779770f53e901', 'wx1234567890abcdef', ''];

var manifestPath = resolve('shopxo-uniapp', 'manifest.json');
var manifestContent = readFile(manifestPath);

if (manifestContent) {
    var wxAppidMatch = manifestContent.match(/"mp-weixin"\s*:\s*\{[\s\S]*?"appid"\s*:\s*"([^"]*)"/);
    var wxAppid = wxAppidMatch ? wxAppidMatch[1] : '';

    if (!wxAppid) {
        warn('manifest.json mp-weixin.appid 为空（构建时由 .env.production 注入）');
    } else if (TEST_APPIDS.indexOf(wxAppid) !== -1) {
        blocker('manifest.json mp-weixin.appid 为测试号: ' + wxAppid);
    } else {
        pass('manifest.json mp-weixin.appid = ' + wxAppid);
    }
} else {
    warn('manifest.json 未找到');
}

var projConfigPath = resolve('shopxo-uniapp', 'project.config.json');
var projConfig = readJSON(projConfigPath);

if (projConfig) {
    var projAppid = projConfig.appid || '';
    if (!projAppid) {
        warn('project.config.json appid 为空');
    } else if (TEST_APPIDS.indexOf(projAppid) !== -1) {
        blocker('project.config.json appid 为测试号: ' + projAppid);
    } else {
        pass('project.config.json appid = ' + projAppid);
    }
} else {
    info('project.config.json 未找到（可能由 HBuilderX 自动生成）');
}

// ============================================================
section('4. 生产配置 HTTPS 校验');
// ============================================================

var runtimeConfigPath = resolve('shopxo-uniapp', 'common', 'js', 'config', 'runtime-config.js');
var runtimeConfig = readFile(runtimeConfigPath);

if (runtimeConfig) {
    var hasHttpsCheck = runtimeConfig.indexOf("indexOf('https://')") !== -1 ||
                        runtimeConfig.indexOf('https://') !== -1;
    var hasTestAppidCheck = runtimeConfig.indexOf('TEST_APPIDS') !== -1 ||
                            runtimeConfig.indexOf('wxda7779770f53e901') !== -1;
    var hasLocalhostCheck = runtimeConfig.indexOf('localhost') !== -1 ||
                            runtimeConfig.indexOf('127.0.0.1') !== -1;

    if (hasHttpsCheck) {
        pass('runtime-config.js 包含 HTTPS 校验');
    } else {
        blocker('runtime-config.js 缺少 HTTPS 校验');
    }

    if (hasTestAppidCheck) {
        pass('runtime-config.js 包含测试号 AppID 拦截');
    } else {
        warn('runtime-config.js 缺少测试号 AppID 拦截');
    }

    if (hasLocalhostCheck) {
        pass('runtime-config.js 包含 localhost/IP 拦截');
    } else {
        warn('runtime-config.js 缺少 localhost/IP 拦截');
    }
} else {
    blocker('runtime-config.js 未找到');
}

var envProdPath = resolve('shopxo-uniapp', '.env.production');
var envProd = readFile(envProdPath);
if (envProd) {
    var urlMatch = envProd.match(/UNI_APP_REQUEST_URL\s*=\s*(.+)/);
    if (urlMatch) {
        var prodUrl = urlMatch[1].trim().replace(/['"]/g, '');
        if (prodUrl.indexOf('https://') === 0) {
            pass('.env.production REQUEST_URL 使用 HTTPS: ' + prodUrl);
        } else if (prodUrl.indexOf('http://') === 0) {
            blocker('.env.production REQUEST_URL 使用 HTTP: ' + prodUrl);
        } else {
            warn('.env.production REQUEST_URL 格式异常: ' + prodUrl);
        }
    } else {
        warn('.env.production 中未找到 UNI_APP_REQUEST_URL');
    }
} else {
    info('.env.production 不存在（可能尚未创建，构建时需要）');
}

// ============================================================
section('5. 高风险关键词检查');
// ============================================================

var HIGH_RISK_KEYWORDS = [
    '互联网医院', '医生问诊', '在线问诊', '诊断建议',
    '用药建议', '开具处方', '处方药', '医疗器械购买',
    '远程诊疗', '诊疗建议',
];

var filesToScan = [];

function collectVueFiles(dir, depth) {
    if (depth > 5) return;
    var fullDir = resolve(dir);
    if (!fs.existsSync(fullDir)) return;
    try {
        var entries = fs.readdirSync(fullDir, { withFileTypes: true });
        entries.forEach(function (entry) {
            if (entry.name.charAt(0) === '.') return;
            if (entry.name === 'node_modules' || entry.name === 'unpackage' || entry.name === 'vendor') return;
            var subPath = dir ? dir + '/' + entry.name : entry.name;
            if (entry.isDirectory()) {
                collectVueFiles(subPath, depth + 1);
            } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.js')) {
                filesToScan.push(resolve(subPath));
            }
        });
    } catch (e) {}
}

collectVueFiles('shopxo-uniapp/pages', 0);

var keywordHits = [];

filesToScan.forEach(function (filePath) {
    var content = readFile(filePath);
    if (!content) return;
    var relPath = path.relative(REPO, filePath);

    HIGH_RISK_KEYWORDS.forEach(function (keyword) {
        if (content.indexOf(keyword) !== -1) {
            if (relPath.indexOf('plugins/hospital') !== -1) return;
            if (relPath.indexOf('compliance-scope') !== -1) return;
            if (relPath.indexOf('phase-one-scope') !== -1) return;
            if (relPath.indexOf('muying-constants') !== -1) return;
            if (relPath.indexOf('muying-enum') !== -1) return;
            if (relPath.indexOf('article-detail') !== -1 && keyword === '用药建议') return;
            if (relPath.indexOf('activity-detail') !== -1 && keyword === '用药建议') return;
            if (relPath.indexOf('goods-category') !== -1 && (keyword === '互联网医院' || keyword === '在线问诊')) return;
            if (relPath.indexOf('goods-buy') !== -1 && keyword === '互联网医院') return;
            if (relPath.indexOf('cart/') !== -1 && keyword === '互联网医院') return;
            keywordHits.push(relPath + ' 包含 "' + keyword + '"');
        }
    });
});

if (keywordHits.length > 0) {
    keywordHits.forEach(function (hit) {
        warn('高风险关键词: ' + hit);
    });
    info('以上命中可能属于合规过滤代码，需人工确认是否为面向用户的文案');
} else {
    pass('前端页面无高风险关键词命中（排除合规过滤代码）');
}

// ============================================================
section('6. 后端安全配置检查');
// ============================================================

if (exists('shopxo-backend', 'public', 'install.php')) {
    blocker('public/install.php 仍存在（提审前必须删除）');
} else {
    pass('public/install.php 已删除');
}

var backendEnvPath = resolve('shopxo-backend', '.env');
var backendEnv = readFile(backendEnvPath);
if (backendEnv) {
    var debugMatch = backendEnv.match(/APP_DEBUG\s*=\s*(.+)/);
    if (debugMatch) {
        var debugVal = debugMatch[1].trim().toLowerCase();
        if (debugVal === 'true' || debugVal === '1') {
            blocker('后端 .env APP_DEBUG = true（提审环境必须为 false）');
        } else {
            pass('后端 .env APP_DEBUG 已关闭');
        }
    }
} else {
    info('后端 .env 不存在于仓库中（正常，运行时生成）');
}

var gitignorePath = resolve('.gitignore');
var gitignore = readFile(gitignorePath);
if (gitignore) {
    var envProdIgnored = gitignore.indexOf('.env.production') !== -1 ||
                         gitignore.indexOf('.env.*') !== -1;
    if (envProdIgnored) {
        pass('.gitignore 已忽略 .env.production');
    } else {
        blocker('.gitignore 未忽略 .env.production（存在密钥泄露风险）');
    }
} else {
    warn('.gitignore 未找到');
}

// ============================================================
section('7. 动态页面与支付页面门控检查');
// ============================================================

var dynamicPages = [
    { path: 'pages/form-input/form-input.vue', name: 'form-input', needFlag: 'feature_dynamic_page_enabled' },
    { path: 'pages/diy/diy.vue', name: 'diy', needFlag: 'feature_dynamic_page_enabled' },
    { path: 'pages/design/design.vue', name: 'design', needFlag: 'feature_dynamic_page_enabled' },
];
var paymentPages = [
    { path: 'pages/cashier/cashier.vue', name: 'cashier', needFlag: 'feature_payment_enabled' },
    { path: 'pages/paytips/paytips.vue', name: 'paytips', needFlag: 'feature_payment_enabled' },
];

dynamicPages.forEach(function(pg) {
    var filePath = resolve('shopxo-uniapp', pg.path);
    var content = readFile(filePath);
    if (!content) {
        warn(pg.name + ' 页面文件不存在（可能已移除）');
        return;
    }
    var hasGuard = content.indexOf(pg.needFlag) !== -1 || content.indexOf('FeatureFlagKey.DYNAMIC_PAGE') !== -1;
    if (hasGuard) {
        pass(pg.name + ' 页面有 feature flag 门控（' + pg.needFlag + '）');
    } else {
        blocker(pg.name + ' 页面无 feature flag 门控（需要 ' + pg.needFlag + ' onLoad guard）');
    }
});

paymentPages.forEach(function(pg) {
    var filePath = resolve('shopxo-uniapp', pg.path);
    var content = readFile(filePath);
    if (!content) {
        warn(pg.name + ' 页面文件不存在（可能已移除）');
        return;
    }
    var hasGuard = content.indexOf(pg.needFlag) !== -1 || content.indexOf('FeatureFlagKey.PAYMENT') !== -1;
    if (hasGuard) {
        pass(pg.name + ' 页面有 feature flag 门控（' + pg.needFlag + '）');
    } else {
        blocker(pg.name + ' 页面无 feature flag 门控（需要 ' + pg.needFlag + ' onLoad guard）');
    }
});

var pagesJson = readFile(resolve('shopxo-uniapp', 'pages.json'));
if (pagesJson) {
    if (pagesJson.indexOf('form-preview') !== -1) {
        blocker('pages.json 仍注册 form-preview 页面（应移除）');
    } else {
        pass('pages.json 未注册 form-preview 页面');
    }
    if (pagesJson.indexOf('customview') !== -1) {
        blocker('pages.json 仍注册 customview 页面（应移除）');
    } else {
        pass('pages.json 未注册 customview 页面');
    }
}

// ============================================================
section('检查汇总');
// ============================================================

var TOTAL = PASS + WARN + BLOCK;
console.log('');
console.log('  PASS: ' + PASS + '  WARN: ' + WARN + '  BLOCKER: ' + BLOCK + '  总计: ' + TOTAL);
console.log('');

if (BLOCK > 0) {
    console.log('\x1b[31m存在 ' + BLOCK + ' 个 BLOCKER → 不可提审\x1b[0m');
    console.log('');
    console.log('  修复后重新运行:');
    console.log('    node scripts/check-phase1-release.js');
    console.log('');
    process.exit(1);
} else if (WARN > 0) {
    console.log('\x1b[33m存在 ' + WARN + ' 个 WARN → 需人工确认后可提审\x1b[0m');
    process.exit(0);
} else {
    console.log('\x1b[32m全部通过 → 可提审\x1b[0m');
    process.exit(0);
}
