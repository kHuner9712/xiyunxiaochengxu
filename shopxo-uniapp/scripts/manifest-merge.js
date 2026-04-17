const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname);
const manifestPath = path.join(rootDir, 'manifest.json');
const localPath = path.join(rootDir, 'manifest.local.json');

if (!fs.existsSync(localPath)) {
    console.log('[manifest-merge] manifest.local.json 不存在，跳过合并');
    process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
    console.error('[manifest-merge] manifest.json 不存在');
    process.exit(1);
}

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (key.startsWith('_')) continue;
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else if (source[key] !== '' && source[key] !== null && source[key] !== undefined) {
            target[key] = source[key];
        }
    }
    return target;
}

try {
    fs.copyFileSync(manifestPath, manifestPath + '.bak');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    deepMerge(manifest, local);

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n', 'utf8');
    console.log('[manifest-merge] 合并完成（原文件已备份为 manifest.json.bak）');
} catch (e) {
    console.error('[manifest-merge] 合并失败:', e.message);
    process.exit(1);
}
