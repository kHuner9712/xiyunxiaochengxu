const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname);
const manifestPath = path.join(rootDir, 'manifest.json');
const backupPath = path.join(rootDir, 'manifest.json.bak');

if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, manifestPath);
    fs.unlinkSync(backupPath);
    console.log('[manifest-restore] manifest.json 已从备份恢复');
} else {
    console.log('[manifest-restore] 无备份文件，跳过恢复');
}
