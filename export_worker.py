#!/usr/bin/env python3
"""
export_worker.py — RC 系统数据导出工具（Playwright 无头模式）

从 state_*.json 恢复登录会话，用无头浏览器导航到告警页面，
拦截 RSC 响应数据，导出为 Excel。通常由 QA 后端调用。

用法：
  python3 export_worker.py \\
    --domain   https://rc-client.platform88.me \\
    --endpoint allTransactionAlerts \\
    --alert-type deposit \\
    --page-size 200 \\
    --output /tmp/export.xlsx
"""

import argparse
import asyncio
import json
import re
import os
import sys

import pandas as pd
import pyotp
from dotenv import load_dotenv
from urllib.parse import urlparse
from playwright.async_api import async_playwright

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Credentials (同 rc_sync_service.py，从 .env 读取)
# ─────────────────────────────────────────────────────────────────────────────
_TEST_USERNAME   = os.environ.get('RC_USERNAME',        '')
_TEST_PASSWORD   = os.environ.get('RC_PASSWORD',        '')
_TEST_OTP_SECRET = os.environ.get('RC_OTP_SECRET',     '')
_PROD_USERNAME   = os.environ.get('RC_PROD_USERNAME',   '')
_PROD_PASSWORD   = os.environ.get('RC_PROD_PASSWORD',   '')
_PROD_OTP_SECRET = os.environ.get('RC_PROD_OTP_SECRET','')
_PROD_DOMAINS    = {'platform10.me'}

def get_credentials(domain: str) -> tuple:
    """根据域名返回 (username, password, otp_secret)。"""
    lower = (domain or '').lower()
    if any(d in lower for d in _PROD_DOMAINS):
        return _PROD_USERNAME, _PROD_PASSWORD, _PROD_OTP_SECRET
    return _TEST_USERNAME, _TEST_PASSWORD, _TEST_OTP_SECRET

LOGIN_SEL   = "input[type='password']"
SIDEBAR_SEL = "nav, aside, [class*='sidebar'], [class*='Sidebar']"

async def do_login(page, username: str, password: str, otp_secret: str) -> bool:
    """填写账密 + OTP，等待侧边栏出现确认登录成功。"""
    try:
        await page.locator(
            'input[type="email"], input[name="email"], '
            'input[name="username"], input[placeholder*="用户"], input[placeholder*="邮箱"]'
        ).first.fill(username, timeout=6000)
        await page.locator('input[type="password"]').first.fill(password, timeout=4000)
        await page.locator('button[type="submit"]').first.click(timeout=4000)
        plog("✅ 已自动填写用户名和密码")
    except Exception as e:
        plog(f"⚠ 用户名/密码填写失败: {e}")

    if otp_secret:
        try:
            otp_input = page.locator(
                'input[name="otp"], input[name="code"], input[name="token"], '
                'input[placeholder*="OTP"], input[placeholder*="验证码"], '
                'input[placeholder*="authenticator"], input[maxlength="6"]'
            ).first
            await otp_input.wait_for(timeout=12_000)
            otp_code = pyotp.TOTP(otp_secret).now()
            await otp_input.fill(otp_code)
            plog(f"✅ 已自动填写 OTP 验证码（{otp_code}）")
            try:
                await page.locator('button[type="submit"]').first.click(timeout=3000)
            except Exception:
                pass
        except Exception as e:
            plog(f"⚠ OTP 自动填写失败: {e}")

    try:
        await page.wait_for_selector(SIDEBAR_SEL, timeout=30_000)
        await page.wait_for_load_state("networkidle")
        plog("✅ 登录成功")
        return True
    except Exception:
        plog("⚠ 等待登录超时")
        return False


async def ensure_logged_in(page, url: str, username: str, password: str,
                           otp_secret: str, state_file: str) -> None:
    """
    导航到 url；若检测到登录页则自动完成登录并保存 session，
    登录成功后重新导航到目标地址。
    """
    try:
        await page.goto(url, wait_until="networkidle", timeout=30_000)
    except Exception:
        pass

    if await page.locator(LOGIN_SEL).count() > 0:
        plog("🔑 检测到登录页，开始自动登录...")
        ok = await do_login(page, username, password, otp_secret)
        if ok:
            # 保存 session，下次可复用
            await page.context.storage_state(path=state_file)
            plog(f"💾 会话已保存至 {os.path.basename(state_file)}")
            try:
                await page.goto(url, wait_until="networkidle", timeout=30_000)
            except Exception:
                pass
    else:
        plog("✅ 已检测到有效会话，跳过登录步骤")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_state_file_path(domain: str) -> str:
    netloc = urlparse(domain).netloc or domain.replace("https://", "").replace("http://", "")
    key    = re.sub(r"[^a-z0-9]", "", netloc.lower())
    base   = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, f"state_{key}.json")


def extract_records(text: str) -> list:
    """解析 Next.js RSC 流格式提取 records。"""
    recs = []
    for m in re.findall(r"\d+:(\{.*\})", text):
        try:
            obj = json.loads(m)
            if obj.get("ok") is True and "records" in obj.get("data", {}):
                recs.extend(obj["data"]["records"])
        except Exception:
            continue
    return recs


def err_exit(msg: str, hint: str = "") -> None:
    payload = {"error": msg}
    if hint:
        payload["hint"] = hint
    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)


def plog(msg: str) -> None:
    """进度日志（由后端捕获后显示在 UI 日志面板）。"""
    print(f"[导出] {msg}", flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# Playwright fetch
# ─────────────────────────────────────────────────────────────────────────────

# 静态资源，跳过解析
_SKIP_EXT = ('.js', '.css', '.png', '.jpg', '.jpeg', '.gif',
             '.svg', '.woff', '.woff2', '.ttf', '.ico', '.map', '.webp')
_SKIP_CT  = ('javascript', 'css', 'image/', 'font/')


async def fetch_records(domain: str, endpoint: str, page_size: int, state_file: str) -> list:
    """
    策略：
    1. 尝试加载已保存 session；若不存在则用空 context 并自动 OTP 登录
    2. 从导航开始就扫描所有 200 响应（不限 URL，只要包含 RSC records）
    3. 记录导航结束时的批次数
    4. 设置每页条数 → 清除日期过滤器 → 点击查询
    5. 等待 Search 后出现新批次（最多 30 秒）
    6. 优先返回 Search 后的最新批次；无则退而求其次
    """
    all_batches       = []   # list of (url, records)
    batches_at_nav    = 0
    batches_at_search = 0

    username, password, otp_secret = get_credentials(domain)
    plog("正在启动浏览器（与 rc_sync_service.py 保持一致，使用有界面模式）...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--no-sandbox"])

        # 有 session 文件就复用，否则新建空 context（后续自动登录）
        if os.path.exists(state_file):
            context = await browser.new_context(storage_state=state_file)
            plog(f"已加载会话: {os.path.basename(state_file)}")
        else:
            context = await browser.new_context()
            plog(f"⚠ 未找到会话文件，将自动登录（账号: {username or '未配置'}）")

        page = await context.new_page()

        # ── 路由拦截：比 on_response 更可靠，route.fetch() 保证读到完整 RSC body ─
        # on_response 在响应头到达时即触发，RSC 流式 body 尚未完成，
        # await response.text() 会静默失败，导致永远捕获不到数据。
        async def handle_route(route):
            url = route.request.url
            # 静态资源直接放行，不走 Python 处理
            if any(url.lower().endswith(e) for e in _SKIP_EXT):
                await route.continue_()
                return
            try:
                response = await route.fetch()
                ct = response.headers.get('content-type', '')
                if any(t in ct for t in _SKIP_CT):
                    await route.fulfill(response=response)
                    return
                try:
                    body = await response.body()
                    text = body.decode('utf-8', errors='replace')
                    recs = extract_records(text)
                    if recs:
                        short = url if len(url) <= 90 else '...' + url[-87:]
                        plog(f"📡 截获 {len(recs)} 条  {short}")
                        all_batches.append((url, recs))
                    elif endpoint in url and len(text) > 200:
                        has_rsc = bool(re.search(r'\d+:\{', text))
                        plog(f"🔍 {url[-70:]}  {len(text)}B  RSC:{'有' if has_rsc else '无'}  记录:0")
                except Exception:
                    pass
                await route.fulfill(response=response)
            except Exception:
                try:
                    await route.continue_()
                except Exception:
                    pass

        await page.route("**/*", handle_route)

        # ── Step 1: 导航（自动处理登录）────────────────────────────────────────
        target_url = f"{domain}/{endpoint}"
        plog(f"正在导航到: {target_url}")
        await ensure_logged_in(page, target_url, username, password, otp_secret, state_file)
        await asyncio.sleep(1)
        batches_at_nav = len(all_batches)
        plog(f"页面加载完成  初始截获批次: {batches_at_nav}")

        # ── Step 2: 设置每页条数 ──────────────────────────────────────────────
        plog(f"尝试设置每页 {page_size} 条...")
        size_set = False
        try:
            selects = page.locator("select")
            count   = await selects.count()
            plog(f"页面共发现 {count} 个 <select>")
            for i in range(count):
                sel     = selects.nth(i)
                options = await sel.locator("option").all_text_contents()
                plog(f"  select[{i}] 选项: {options}")
                if str(page_size) in [o.strip() for o in options]:
                    await sel.select_option(str(page_size), timeout=3000)
                    size_set = True
                    plog(f"✅ select[{i}] → {page_size} 条")
                    await asyncio.sleep(1.5)
                    break
            if not size_set:
                plog(f"⚠ 未找到含 {page_size} 的 select，使用默认值")
        except Exception as e:
            plog(f"⚠ 设置每页出错: {e}")

        # ── Step 3: 清除日期过滤器 ────────────────────────────────────────────
        try:
            cleared = await page.evaluate("""
                () => {
                    const DATE_RE = /\\d{4}-\\d{2}-\\d{2}/;
                    const walker = document.createTreeWalker(
                        document.body, NodeFilter.SHOW_TEXT, null, false
                    );
                    const dateEls = [];
                    let node;
                    while ((node = walker.nextNode())) {
                        if (DATE_RE.test(node.textContent)) {
                            const el = node.parentElement;
                            if (el && !dateEls.includes(el)) dateEls.push(el);
                        }
                    }
                    const clicked = new Set();
                    let count = 0;
                    for (const el of dateEls) {
                        const elRect = el.getBoundingClientRect();
                        if (elRect.width < 10) continue;
                        const elRight = elRect.right;
                        const elCy    = elRect.top + elRect.height / 2;
                        let best = null, bestDist = Infinity;
                        for (const btn of document.querySelectorAll('button')) {
                            if (clicked.has(btn)) continue;
                            const r = btn.getBoundingClientRect();
                            if (r.width < 1) continue;
                            const btnCx = r.left + r.width  / 2;
                            const btnCy = r.top  + r.height / 2;
                            const dist  = btnCx - elRight;
                            if (dist >= 0 && dist <= 80 &&
                                Math.abs(btnCy - elCy) <= elRect.height &&
                                r.width <= 44 && r.height <= 44) {
                                if (dist < bestDist) { bestDist = dist; best = btn; }
                            }
                        }
                        if (best) {
                            best.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            best.click();
                            best.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                            clicked.add(best);
                            count++;
                        }
                    }
                    return count;
                }
            """)
            await asyncio.sleep(0.5)
            if cleared and cleared > 0:
                plog(f"🗓 已清除 {cleared} 个日期过滤器（全量搜索）")
            else:
                plog("⚠ 未找到日期清除按钮，使用当前日期范围")
        except Exception as e:
            plog(f"⚠ 清除日期过滤失败: {e}")

        # ── Step 4: 点击查询 ──────────────────────────────────────────────────
        batches_at_search = len(all_batches)
        plog(f"准备点击查询（当前批次: {batches_at_search}）")
        clicked = False
        for btn_name in ["Search", "查询"]:
            try:
                await page.get_by_role("button", name=btn_name).click(timeout=4000)
                clicked = True
                plog(f"✅ 已点击「{btn_name}」")
                break
            except Exception:
                pass
        if not clicked:
            plog("⚠ 未找到查询按钮，尝试 Enter")
            try:
                await page.keyboard.press("Enter")
            except Exception:
                pass

        # ── Step 5: 等待 Search 后的新批次（最多 30 秒）────────────────────
        plog("等待 Search 后数据响应（最多 30 秒）...")
        deadline = asyncio.get_event_loop().time() + 30
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(0.5)
            if len(all_batches) > batches_at_search:
                await asyncio.sleep(2)   # 等分包追加
                break
        else:
            plog("❌ Search 后 30 秒内无新响应")

        total = sum(len(r) for _, r in all_batches)
        plog(f"监听结束  总批次:{len(all_batches)}  总记录:{total}")
        await browser.close()
        plog("浏览器已关闭")

    if not all_batches:
        return []

    # 优先取 Search 之后的批次，否则取全部
    post_search = all_batches[batches_at_search:]
    pool = post_search if post_search else all_batches
    _, best = max(pool, key=lambda x: len(x[1]))
    plog(f"✅ 选取批次共 {len(best)} 条记录（来自 {len(pool)} 个候选批次）")
    return best


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="RC 系统数据导出工具")
    parser.add_argument("--domain",     required=True)
    parser.add_argument("--endpoint",   required=True)
    parser.add_argument("--alert-type", default="")
    parser.add_argument("--page-size",  type=int, default=200)
    parser.add_argument("--output",     required=True)
    parser.add_argument("--state-file", default=None)
    parser.add_argument("--start-time", default="",
                        help="起始时间过滤，格式 YYYY-MM-DD HH:mm:ss，留空不过滤")
    args = parser.parse_args()

    domain     = args.domain.rstrip("/")
    state_file = args.state_file or get_state_file_path(domain)

    # Fallback: rc_sync_service.py 保存的通用 session 文件
    _fallback = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rc_sync_state.json")
    if not os.path.exists(state_file) and os.path.exists(_fallback):
        plog(f"⚠ 未找到 {os.path.basename(state_file)}，尝试使用 rc_sync_state.json")
        state_file = _fallback

    # 无 session 文件时不退出，由 fetch_records 内自动登录并保存
    if not os.path.exists(state_file):
        plog(f"⚠ 未找到 session 文件，将使用 .env 凭证自动登录并保存至 {os.path.basename(state_file)}")

    records = asyncio.run(fetch_records(domain, args.endpoint, args.page_size, state_file))

    if not records:
        err_exit(
            "未从响应中提取到数据",
            "请查看右侧日志面板确认具体卡在哪一步"
        )

    alert_type = args.alert_type.strip()
    if alert_type:
        records = [r for r in records if r.get("alertType") == alert_type]
        if not records:
            err_exit(f"过滤后无数据（alertType={alert_type}）")

    start_time = args.start_time.strip()
    if start_time:
        before = len(records)
        records = [r for r in records if (r.get("alertTime") or "") >= start_time]
        plog(f"🕐 起始时间过滤 ≥ {start_time}：保留 {len(records)} / 排除 {before - len(records)} 条")
        if not records:
            err_exit(f"起始时间过滤后无数据（startTime={start_time}）")

    df = pd.DataFrame(records)
    if "alertNumber" in df.columns:
        df = df.drop_duplicates(subset=["alertNumber"])
    if "alertMetadata" in df.columns:
        meta_df = pd.json_normalize(df["alertMetadata"].fillna({}))
        meta_df.columns = [f"meta.{c}" for c in meta_df.columns]
        df = pd.concat([df.drop(columns=["alertMetadata"]), meta_df], axis=1)

    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    try:
        df.to_excel(args.output, index=False)
    except Exception as e:
        err_exit(f"写入 Excel 失败: {str(e)}")

    plog(f"✨ 导出完成  共 {len(df)} 条  → {args.output}")
    print(json.dumps({"success": True, "count": len(df), "output": args.output}, ensure_ascii=False))


if __name__ == "__main__":
    main()
