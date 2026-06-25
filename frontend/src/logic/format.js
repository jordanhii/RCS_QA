/**
 * 金额显示格式化：用于 el-input-number 的 :formatter / :parser
 * - 显示时每 3 位加千分位逗号（111111 → 111,111），不丢小数精度
 * - 存储/解析时去掉逗号，保持纯数字
 */
export const amtFormat = (v) => {
    if (v === '' || v === null || v === undefined || isNaN(Number(v))) return ''
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: 20 })
}

export const amtParse = (v) => (v ?? '').toString().replace(/,/g, '')
