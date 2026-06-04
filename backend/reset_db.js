/**
 * reset_db.js — 数据库清理脚本
 *
 * 用法：
 *   node backend/reset_db.js          # 交互确认后清理全部数据（含配置）
 *   node backend/reset_db.js --force  # 跳过确认直接全量清理
 *   node backend/reset_db.js --data   # 只清记录数据，保留列表结构+配置+关联
 *
 * --data 模式（推荐日常使用）：
 *   - testlists / gameprofitlists：只清空 records 数组，
 *     listName / configId / rcBaseUrl / ignoreC2 全部保留
 *   - synccaches：全部删除（缓存无需保留）
 *   - 若某类型下还没有列表，自动按 qaconfig 的 RC 环境列表补建默认列表
 */

import mongoose from 'mongoose'
import readline from 'readline'

const MONGO_URI = 'mongodb://127.0.0.1:27017/qa_alert_system'
const args      = process.argv.slice(2)
const FORCE     = args.includes('--force')
const DATA_ONLY = args.includes('--data')

// TestList typeIds（游戏盈利走 gameprofitlists，不在此列）
const TEST_TYPE_IDS    = [1, 2, 3, 4, 5, 6, 7, 9, 10]
const CFG_COLLECTIONS  = ['configs', 'captureconfigs', 'qaconfigs']
const ORPHAN_COLLECTIONS = ['gameprofitconfigs']

// ── 工具 ──────────────────────────────────────────────────────────────────────
const ask = (q) => new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, ans => { rl.close(); resolve(ans.trim().toLowerCase()) })
})

const pad = (s, n = 20) => String(s).padEnd(n)

// ── 读取 RC 环境列表（用于补建缺失的默认列表）────────────────────────────────
async function getDefaultEnvs(db) {
    try {
        const cfg  = await db.collection('qaconfigs').findOne({})
        const envs = cfg?.rcEnvs || []
        if (envs.length > 0) return envs.map(e => ({ name: e.name, rcBaseUrl: e.rcBaseUrl || '' }))
    } catch {}
    return [
        { name: '测试站', rcBaseUrl: '' },
        { name: '正式站', rcBaseUrl: '' },
    ]
}

/**
 * 为缺少列表的 typeId 补建默认列表（已有列表的 typeId 不动）。
 * --data 模式：records 已清空，只补建「从未建过」的列表。
 */
async function seedMissingLists(db) {
    const envs  = await getDefaultEnvs(db)
    const ts    = new Date()
    const tlCol = db.collection('testlists')
    const gpCol = db.collection('gameprofitlists')
    let   tlNew = 0, gpNew = 0

    for (const typeId of TEST_TYPE_IDS) {
        const existing = await tlCol.countDocuments({ typeId })
        if (existing > 0) continue    // 已有列表，跳过
        for (const env of envs) {
            await tlCol.insertOne({ typeId, listName: env.name, rcBaseUrl: env.rcBaseUrl,
                                    configId: null, records: [], createdAt: ts, updatedAt: ts })
            tlNew++
        }
    }

    const gpExisting = await gpCol.countDocuments()
    if (gpExisting === 0) {
        for (const env of envs) {
            await gpCol.insertOne({ listName: env.name, rcBaseUrl: env.rcBaseUrl,
                                    configId: null, ignoreC2: false,
                                    records: [], createdAt: ts, updatedAt: ts })
            gpNew++
        }
    }

    if (tlNew + gpNew > 0) {
        console.log(`\n🌱 已补建缺失的默认列表：testlists +${tlNew} 条，gameprofitlists +${gpNew} 条`)
    }
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║      RCS QA — 数据库清理工具              ║')
    console.log('╚══════════════════════════════════════════╝\n')

    if (DATA_ONLY) {
        console.log('📌 模式：清空记录数据（保留列表结构、关联配置、RC 地址）')
        console.log('   testlists       → records 清空，listName / configId / rcBaseUrl 保留')
        console.log('   gameprofitlists → records 清空，listName / configId / rcBaseUrl 保留')
        console.log('   synccaches      → 全部删除')
    } else {
        console.log('⚠️  模式：清理全部数据（包含配置）')
        const allTargets = ['testlists', 'gameprofitlists', 'synccaches', ...CFG_COLLECTIONS]
        console.log('\n将清理：' + allTargets.join('、'))
        ORPHAN_COLLECTIONS.forEach(c => console.log(`  孤儿集合 drop：${c}`))
    }

    if (!FORCE) {
        const ans = await ask('\n确认清理？输入 yes 继续，其他取消：')
        if (ans !== 'yes') { console.log('\n❌ 已取消\n'); process.exit(0) }
    }

    console.log('\n🔌 连接数据库...')
    await mongoose.connect(MONGO_URI)
    const db = mongoose.connection.db
    console.log('✅ 已连接\n')

    const existing = new Set((await db.listCollections().toArray()).map(c => c.name))

    console.log('─'.repeat(50))
    console.log(`${pad('集合', 22)}  ${pad('操作前', 10)}  结果`)
    console.log('─'.repeat(50))

    if (DATA_ONLY) {
        // ── --data 模式：只清 records，保留文档结构 ───────────────────────────
        for (const name of ['testlists', 'gameprofitlists']) {
            if (!existing.has(name)) {
                console.log(`${pad(name, 22)}  ${pad('不存在', 10)}  ⏭ 跳过`)
                continue
            }
            const col    = db.collection(name)
            const before = await col.countDocuments()
            // 统计总 records 数量
            const agg = await col.aggregate([
                { $project: { count: { $size: { $ifNull: ['$records', []] } } } },
                { $group: { _id: null, total: { $sum: '$count' } } }
            ]).toArray()
            const recsBefore = agg[0]?.total ?? 0
            await col.updateMany({}, { $set: { records: [], updatedAt: new Date() } })
            console.log(`${pad(name, 22)}  ${pad(before + ' 个列表', 10)}  ✅ records 已清空（共 ${recsBefore} 条记录）`)
        }

        // synccaches 全部删除
        if (existing.has('synccaches')) {
            const before = await db.collection('synccaches').countDocuments()
            await db.collection('synccaches').deleteMany({})
            console.log(`${pad('synccaches', 22)}  ${pad(before + ' 条', 10)}  ✅ 已清空`)
        }

    } else {
        // ── 全量清理 ───────────────────────────────────────────────────────────
        const TARGET = ['testlists', 'gameprofitlists', 'synccaches', ...CFG_COLLECTIONS]
        for (const name of TARGET) {
            if (!existing.has(name)) {
                console.log(`${pad(name, 22)}  ${pad('不存在', 10)}  ⏭ 跳过`)
                continue
            }
            const col    = db.collection(name)
            const before = await col.countDocuments()
            await col.deleteMany({})
            console.log(`${pad(name, 22)}  ${pad(before + ' 条', 10)}  ✅ 已清空`)
        }

        // Drop 孤儿集合
        for (const name of ORPHAN_COLLECTIONS) {
            if (!existing.has(name)) continue
            const before = await db.collection(name).countDocuments()
            await db.dropCollection(name)
            console.log(`${pad(name, 22)}  ${pad(before + ' 条', 10)}  🗑 已 drop`)
        }
    }

    console.log('─'.repeat(50))
    console.log('\n✨ 清理完成！')

    if (DATA_ONLY) {
        // 补建缺失的默认列表（首次使用或列表被全量 reset 过）
        await seedMissingLists(db)
        console.log('\n💡 列表结构、关联配置、RC 地址均已保留，无需重新设置。')
    } else {
        console.log('\n提示：配置已清空，重启后端会自动补全默认 QA 配置。')
    }

    console.log()
}

main()
    .catch(err => { console.error('\n❌ 清理失败:', err.message); process.exit(1) })
    .finally(() => mongoose.disconnect())
