const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'manifest.json');
const manifestBackupPath = `${manifestPath}.bak`;
const projectConfigPath = path.join(projectRoot, 'project.config.json');
const projectConfigBackupPath = `${projectConfigPath}.bak`;

const restoreFile = (backupPath, targetPath, label) => {
    if (!fs.existsSync(backupPath)) {
        console.log(`[manifest-restore] ${label} backup not found, skipped`);
        return;
    }
    fs.copyFileSync(backupPath, targetPath);
    fs.unlinkSync(backupPath);
    console.log(`[manifest-restore] restored ${label}`);
};

restoreFile(manifestBackupPath, manifestPath, 'manifest.json');
restoreFile(projectConfigBackupPath, projectConfigPath, 'project.config.json');
