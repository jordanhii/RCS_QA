// 显式加载项目根目录的 .env（无论从哪个目录启动 node 都能读到）。
// 必须在其它模块之前 import，保证 process.env 在各路由/中间件求值前就绪。
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')
dotenv.config({ path: rootEnv })
