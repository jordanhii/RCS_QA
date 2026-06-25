/** Maps typeId to the alertType string used in the RC system and Excel exports */
export const ALERT_TYPE_MAP = {
    1: 'deposit',
    2: 'deposit-monthly',
    3: 'withdrawal',
    4: 'withdrawal-monthly',
    5: 'netflow',
    6: 'bet-deposit',
    7: 'bet-deposit-promo',
    9: 'netflow-additional-present-day',
    10: 'netflow-additional-historical',
    11: 'reward-cumulative',
    12: 'reward-interval',
}

/** Full page titles shown in the sidebar and page header */
export const PAGE_TITLES = {
    1: '前X分钟存款(天)',
    2: '前X分钟存款(月)',
    3: '前X分钟提款(天)',
    4: '前X分钟提款(月)',
    5: '24小时存提款额',
    6: '投/存比',
    7: '投/存+惠比',
    9: '存提差环比',
    10: '存提差同比',
    11: '优惠同比',
    12: '优惠环比',
}

/** Short display names used in import dialogs and summaries */
export const TYPE_DISPLAY_NAMES = {
    1: '存款(天)',
    2: '存款(月)',
    3: '提款(天)',
    4: '提款(月)',
    5: '24h存提',
    6: '投/存比',
    7: '投/存+惠比',
    11: '优惠同比',
    12: '优惠环比'
}

/** 优惠类型可选项（优惠同比/环比配置的「优惠类型」下拉，与风控总览-优惠的类型一致） */
export const REWARD_TYPE_OPTIONS = [
    'All',
    'PlayerLevelUp',
    'PlayerLevelMaintain',
    'PlayerPromoCodeReward',
    'PlayerFreeTrialRewardGroup',
    'FreeBonus',
    'LuckyCoins',
    'BonusRecord',
    'DiamondExchange',
    'LeaderboardReward',
    'MudToCash',
    'SuperJackpotRecord',
    'AngPao Rain',
    'Flip Coin',
    'Mud',
    'Palayok Blast',
    'Milyonaryo Jackpot',
    'Lucky Hour Bonus',
]

/** Dropdown options for the continuous alert type selector */
export const CONT_TYPE_OPTIONS = [
    '前30分钟无告警',
    '下降转上升',
    '上升恶化',
    '上升转下降',
    '下降恶化'
]

/** Returns the val1 column label for a given typeId */
export function getVal1Label(typeId) {
    if (typeId === 9) return '当前存提差'
    if ([1, 2].includes(typeId)) return '存款金额'
    if ([3, 4, 5].includes(typeId)) return '提款金额'
    return '投注金额'
}

/** Returns the val2 column label for a given typeId */
export function getVal2Label(typeId) {
    if (typeId === 1 || typeId === 3) return '近 X 天平均金额'
    if (typeId === 2 || typeId === 4) return '前 X 月平均金额'
    if (typeId === 5) return '存款金额*阈值'
    if (typeId === 6) return '存款金额*阈值'
    return '存款+优惠金额'
}

/** Returns the ratio column label for typeId 5 / 6 / 7 */
export function getRatioLabel(typeId) {
    if (typeId === 5) return '提/存'
    if (typeId === 6) return '投/存'
    return '投/存+惠'
}
