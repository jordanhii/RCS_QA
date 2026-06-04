const fs = require('fs');
const path = require('path');
const filesToExport = [
    'backend/package.json',
    'backend/server.js',
    'frontend/package.json',
    'frontend/vite.config.js',
    'frontend/index.html',
    'frontend/src/main.js',
    'frontend/src/router.js',
    'frontend/src/App.vue',
    'frontend/src/views/ConfigView.vue',
    'frontend/src/views/TestView.vue',
    'fetch_rc_data.py'
];
const outputFile = 'all_code.txt';
let outputContent = '==========================================================\n';
outputContent += '              QA 告警逻辑测试系统 - 完整代码导出\n';
outputContent += '==========================================================\n\n';
filesToExport.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    outputContent += `\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n`;
    outputContent += `📄 文件路径: ${filePath}\n`;
    outputContent += `<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n\n`;
    try {
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            outputContent += content + '\n';
        } else {
            outputContent += `[ ⚠️ 未找到该文件: ${filePath} ]\n`;
        }
    } catch (err) {
        outputContent += `[ ❌ 读取文件失败: ${err.message} ]\n`;
    }
});
try {
    fs.writeFileSync(path.join(__dirname, outputFile), outputContent, 'utf8');
    console.log(`\n✅ 导出成功！包含 Python 爬虫在内的所有代码已合并保存至: 【 ${outputFile} 】\n`);
} catch (err) {
    console.error('\n❌ 导出失败:', err.message);
}