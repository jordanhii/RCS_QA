/**
 * pm2 ecosystem config for RCS QA backend
 *
 * 用法：
 *   pm2 start ecosystem.config.cjs        # 启动
 *   pm2 stop all                          # 停止
 *   pm2 restart qa-backend                # 重启后端
 *   pm2 logs                              # 查看日志
 *   pm2 save && pm2 startup               # 开机自启
 *
 * 注意：rc_sync_service.py 是交互式服务（需要浏览器和 OTP），
 *       不适合通过 pm2 管理，仍需在 terminal 手动运行。
 */
module.exports = {
    apps: [
        {
            name:        'qa-backend',
            script:      'backend/server.js',
            interpreter: 'node',
            cwd:         __dirname,
            watch:       false,
            env: {
                NODE_ENV: 'production',
            },
            // Restart on crash, up to 10 times within 1 minute
            max_restarts:    10,
            restart_delay:   3000,
            // Log files
            out_file:   'logs/backend-out.log',
            error_file: 'logs/backend-err.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
        }
    ]
}
