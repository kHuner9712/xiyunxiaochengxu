const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'manifest.json');
const localPath = path.join(projectRoot, 'manifest.local.json');
const projectConfigPath = path.join(projectRoot, 'project.config.json');
const manifestBackupPath = `${manifestPath}.bak`;
const projectConfigBackupPath = `${projectConfigPath}.bak`;

if (!fs.existsSync(manifestPath)) {
    console.error('[manifest-merge] manifest.json not found');
    process.exit(1);
}

const deepMerge = (target, source) => {
    Object.keys(source).forEach((key) => {
        if (key.startsWith('_')) {
            return;
        }
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
                target[key] = {};
            }
            deepMerge(target[key], source[key]);
            return;
        }
        if (source[key] !== '' && source[key] !== null && source[key] !== undefined) {
            target[key] = source[key];
        }
    });
    return target;
};

const syncProjectConfigAppId = (manifestData) => {
    if (!fs.existsSync(projectConfigPath)) {
        console.warn('[manifest-merge] project.config.json not found, skip appid sync');
        return;
    }

    const appid = (((manifestData || {})['mp-weixin'] || {}).appid || '').trim();
    if (!appid) {
        console.warn('[manifest-merge] mp-weixin.appid is empty, skip appid sync');
        return;
    }

    const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    if ((projectConfig.appid || '').trim() === appid) {
        return;
    }

    fs.copyFileSync(projectConfigPath, projectConfigBackupPath);
    projectConfig.appid = appid;
    fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, 'utf8');
    console.log(`[manifest-merge] synced project.config.json appid -> ${appid}`);
};

try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (fs.existsSync(localPath)) {
        fs.copyFileSync(manifestPath, manifestBackupPath);
        const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        deepMerge(manifest, local);
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`, 'utf8');
        console.log('[manifest-merge] merged manifest.local.json into manifest.json');
    } else {
        console.log('[manifest-merge] manifest.local.json not found, skipped merge');
    }

    syncProjectConfigAppId(manifest);
} catch (error) {
    console.error('[manifest-merge] failed:', error.message);
    process.exit(1);
}
