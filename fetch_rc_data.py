import asyncio
import json
import re
import os
import pandas as pd
from urllib.parse import urlparse
from datetime import datetime
from playwright.async_api import async_playwright

GOTO_URL   = "https://rc-client.platform10.me/"
EXPORT_DIR = "/Users/jordanhii/Desktop/work/RCS_QA/excel"

# Derive a domain-specific state file so platform88 and platform10 sessions don't clash
_netloc    = urlparse(GOTO_URL).netloc          # e.g. "rc-client.platform10.me"
_dk        = re.sub(r'[^a-z0-9]', '', _netloc)  # e.g. "rcclientplatform10me"
STATE_FILE = f"state_{_dk}.json"                # e.g. "state_rcclientplatform10me.json"

async def run():
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR)
        print(f"📁 已创建导出目录: {EXPORT_DIR}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        if os.path.exists(STATE_FILE):
            context = await browser.new_context(storage_state=STATE_FILE)
            print(f"💾 已加载保存的会话 ({STATE_FILE})")
        else:
            context = await browser.new_context()
            print(f"⚠️  未找到会话文件 ({STATE_FILE})，将打开新登录窗口，登录后请按 [s] 保存")
        page = await context.new_page()
        cache = {
            "Transaction": [],
            "Bet": []
        }
        async def handle_response(response):
            url = response.url
            if response.status == 200:
                if "allTransactionAlerts" in url:
                    try:
                        raw_text = await response.text()
                        records = extract_records(raw_text)
                        if records:
                            cache["Transaction"] = records 
                            print(f"\n📡 [系统] 后台已截获存提款数据包 ({len(records)} 条)")
                    except: pass
                elif "allBetAlerts" in url:
                    try:
                        raw_text = await response.text()
                        records = extract_records(raw_text)
                        if records:
                            cache["Bet"] = records 
                            print(f"\n📡 [系统] 后台已截获投注优惠数据包 ({len(records)} 条)")
                    except: pass
        def extract_records(text):
            matches = re.findall(r'\d+:(\{.*\})', text)
            recs = []
            for m in matches:
                try:
                    obj = json.loads(m)
                    if obj.get('ok') is True and 'records' in obj.get('data', {}):
                        recs.extend(obj['data']['records'])
                except: continue
            return recs
        page.on("response", handle_response)
        base_url = GOTO_URL.rstrip("/")
        print("\n" + "="*50)
        print(f"🌐 浏览器已开启，正在连接: {GOTO_URL}")
        print(f"💾 会话文件: {STATE_FILE}")
        print("请执行以下操作：")
        print("1. 在浏览器中完成登录（若已自动恢复会话可跳过）。")
        print("2. 登录完成后按 Enter，程序将自动打开两个告警页面。")
        print(f"3. 导出的文件将保存在: \n   {EXPORT_DIR}")
        print("="*50 + "\n")
        await page.goto(GOTO_URL)
        await page.wait_for_load_state("networkidle")

        # ── 检测是否已登录（有 sidebar 则跳过手动确认）──────────────────────────
        sidebar_count = await page.locator("nav, aside, [class*='sidebar'], [class*='Sidebar']").count()
        if sidebar_count == 0:
            await asyncio.get_event_loop().run_in_executor(
                None, input, "👉 请先在浏览器中完成登录，然后按 Enter 继续: "
            )

        # 保存会话
        await context.storage_state(path=STATE_FILE)
        print(f"💾 会话已保存至 {STATE_FILE}")

        # ── 自动打开两个告警 Tab ─────────────────────────────────────────────────
        print("🌐 正在自动打开 allTransactionAlerts 和 allBetAlerts 页面...")
        page_tx  = await context.new_page()
        page_bet = await context.new_page()
        page_tx.on("response",  handle_response)
        page_bet.on("response", handle_response)
        await page_tx.goto(f"{base_url}/allTransactionAlerts", wait_until="networkidle")
        print("✅ allTransactionAlerts 已打开")
        await page_bet.goto(f"{base_url}/allBetAlerts", wait_until="networkidle")
        print("✅ allBetAlerts 已打开")
        print("📡 数据监听已启动，查询后数据将自动缓存。\n")

        while True:
            print("\n--- 可用指令 ---")
            print(" [1] 导出 存提款数据 (TransactionAlerts)")
            print(" [2] 导出 投注优惠数据 (BetAlerts)")
            print(f" [s] 强制保存当前登录状态 ({STATE_FILE})")
            print(" [q] 退出程序")
            cmd = await asyncio.get_event_loop().run_in_executor(None, input, "👉 请输入指令并按回车: ")
            if cmd == '1':
                if not cache["Transaction"]:
                    print("⚠️  暂无缓存数据，请在 allTransactionAlerts 页面点击「查询」后再试。")
                else:
                    await export_data("TransactionAlerts", cache["Transaction"])
            elif cmd == '2':
                if not cache["Bet"]:
                    print("⚠️  暂无缓存数据，请在 allBetAlerts 页面点击「查询」后再试。")
                else:
                    await export_data("BetAlerts", cache["Bet"])
            elif cmd == 's':
                await context.storage_state(path=STATE_FILE)
                print(f"✅ 登录状态已手动保存至 {STATE_FILE}。")
            elif cmd == 'q':
                print("👋 正在退出...")
                break
            else:
                print("❌ 无效指令，请输入 1, 2, s 或 q。")
        await browser.close()
async def export_data(name, data_list):
    if not data_list:
        print(f"❌ 导出失败：目前缓存中没有 [{name}] 的数据。")
        print("💡 请先在浏览器里切换一下页数或点一下查询，让数据流经后台。")
        return
    print(f"📊 正在处理 {len(data_list)} 条记录...")
    df = pd.DataFrame(data_list)
    if 'alertNumber' in df.columns:
        df = df.drop_duplicates(subset=['alertNumber'])
    if 'alertMetadata' in df.columns:
        meta_df = pd.json_normalize(df['alertMetadata'].fillna({}))
        meta_df.columns = [f'meta.{c}' for c in meta_df.columns]
        df = pd.concat([df.drop(columns=['alertMetadata']), meta_df], axis=1)
    date_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"{date_str}_{name}.xlsx"
    full_path = os.path.join(EXPORT_DIR, file_name)
    try:
        df.to_excel(full_path, index=False)
        print(f"✨ 导出成功！")
        print(f"📍 完整路径: {full_path}")
    except Exception as e:
        print(f"❌ 写入文件失败: {e}")
if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass