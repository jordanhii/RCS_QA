# rc_sync_service.py
# 直连风控同步后台服务
# 用法：
#   python rc_sync_service.py                           # 使用「接口配置」中的全局 RC 地址
#   python rc_sync_service.py --url https://rc-client.platform10.me   # 指定 RC 地址（正式站）
# 功能：自动登录 → 打开三个告警页面 → 等待 QA 系统触发同步指令 → 将数据推送到 QA 后端

import argparse
import asyncio
import json
import re
import os
import requests
import pyotp
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError
from urllib.parse import urlencode
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL    = os.environ.get('BACKEND_URL', 'http://localhost:3000')
RC_URL_DEFAULT = "https://rc-client.platform88.me"
STATE_FILE     = "rc_sync_state.json"

# 后端启用登录鉴权后，worker 用 X-Worker-Token 放行（与后端 WORKER_TOKEN 一致）。
# 建一个带该头的 Session，并把模块级 requests.get/post 指向它，使本文件所有调用自动带令牌。
WORKER_TOKEN = os.environ.get('WORKER_TOKEN', 'rcsqa-worker-token')
_worker_sess = requests.Session()
_worker_sess.headers.update({'X-Worker-Token': WORKER_TOKEN})
requests.get  = _worker_sess.get
requests.post = _worker_sess.post

# 测试站凭证
_TEST_USERNAME   = os.environ.get('RC_USERNAME', '')
_TEST_PASSWORD   = os.environ.get('RC_PASSWORD', '')
_TEST_OTP_SECRET = os.environ.get('RC_OTP_SECRET', '')

# 正式站凭证
_PROD_USERNAME   = os.environ.get('RC_PROD_USERNAME', '')
_PROD_PASSWORD   = os.environ.get('RC_PROD_PASSWORD', '')
_PROD_OTP_SECRET = os.environ.get('RC_PROD_OTP_SECRET', '')

_PROD_DOMAINS = {'platform10.me'}

def get_credentials(rc_url: str) -> tuple:
    """根据 RC 地址返回对应的 (username, password, otp_secret)。"""
    url_lower = (rc_url or '').lower()
    if any(d in url_lower for d in _PROD_DOMAINS):
        return _PROD_USERNAME, _PROD_PASSWORD, _PROD_OTP_SECRET
    return _TEST_USERNAME, _TEST_PASSWORD, _TEST_OTP_SECRET

# 全局变量，在 run() 里按实际 RC_URL 赋值
USERNAME   = ''
PASSWORD   = ''
OTP_SECRET = ''

# ── CLI args ──────────────────────────────────────────────────────────────────
_parser = argparse.ArgumentParser(description="RCS QA 直连同步服务")
_parser.add_argument(
    "--url", default=None,
    help="指定 RC 系统地址（如 https://rc-client.platform10.me）。"
         "留空则从「接口配置」自动读取。"
)
_ARGS = _parser.parse_args()


def fetch_rc_url(override=None):
    """Return the RC base URL: CLI arg > backend config > hardcoded default."""
    if override:
        return override.strip().rstrip("/")
    try:
        with urlopen(f"{BACKEND_URL}/api/qa-config", timeout=5) as r:
            cfg = json.loads(r.read())
            url = cfg.get("rcBaseUrl", "").strip().rstrip("/")
            return url if url else RC_URL_DEFAULT
    except Exception:
        return RC_URL_DEFAULT


def now():
    return datetime.now().strftime("%H:%M:%S")


def _push_log_async(line: str) -> None:
    """后台线程推送日志到 QA 后端（非阻塞，失败静默忽略）。"""
    import threading
    def _do():
        try:
            payload = json.dumps({"msg": line}).encode()
            req = Request(
                f"{BACKEND_URL}/api/sync-log",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urlopen(req, timeout=2)
        except Exception:
            pass
    threading.Thread(target=_do, daemon=True).start()


def log(msg: str) -> None:
    line = f"[{now()}] {msg}"
    print(line, flush=True)
    _push_log_async(line)


def extract_records(text):
    """Parse Next.js RSC streaming response and extract alert records.
    Handles both single-line and split/chunked JSON payloads robustly."""
    recs = []
    # Primary: line-prefixed RSC chunks (e.g.  3:{"ok":true,"data":{"records":[...]}})
    for m in re.findall(r'\d+:(\{.+?\})\s*(?=\d+:|$)', text, re.DOTALL):
        try:
            obj = json.loads(m)
            if obj.get("ok") is True and "records" in obj.get("data", {}):
                recs.extend(obj["data"]["records"])
        except Exception:
            pass
    # Fallback: simple greedy match for any JSON blob containing ok+records
    if not recs:
        for m in re.findall(r'\{[^{}]*"ok"\s*:\s*true[^{}]*\}', text):
            try:
                obj = json.loads(m)
                if "records" in obj.get("data", {}):
                    recs.extend(obj["data"]["records"])
            except Exception:
                pass
    return recs


def push_to_backend(records, source, rc_url=''):
    """Synchronously POST records to the QA backend cache (called in a thread executor)."""
    if not records:
        return
    payload = json.dumps({"records": records, "source": source, "rcBaseUrl": rc_url}).encode()
    req = Request(
        f"{BACKEND_URL}/api/sync-cache",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as r:
            result = json.loads(r.read())
            log(f"✅ [{source}] 推送 {len(records)} 条，新增 {result.get('added', '?')} 条")
    except URLError as e:
        log(f"❌ 推送失败 [{source}]: {e.reason}")
    except Exception as e:
        log(f"❌ 推送失败 [{source}]: {e}")


async def clear_date_filters(page, label):
    """
    RC 系统的日期选择器是自定义组件，日期文本在 <span>/<div> 里而非标准 <input>。
    策略：用 JS 遍历页面文本节点，找含日期格式的元素，再定位其右侧的小按钮（X）并点击。
    """
    try:
        cleared = await page.evaluate("""
            () => {
                const DATE_RE = /\\d{4}-\\d{2}-\\d{2}/;

                // 1. 找所有含日期文本的叶节点元素
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

                // 2. 对每个日期元素，找它右侧最近的小按钮
                const clicked = new Set();
                let count = 0;

                for (const el of dateEls) {
                    const elRect = el.getBoundingClientRect();
                    if (elRect.width < 10) continue;   // 跳过不可见元素

                    const elRight = elRect.right;
                    const elCy    = elRect.top + elRect.height / 2;

                    let best = null, bestDist = Infinity;

                    for (const btn of document.querySelectorAll('button')) {
                        if (clicked.has(btn)) continue;
                        const r = btn.getBoundingClientRect();
                        if (r.width < 1) continue;

                        const btnCx = r.left + r.width  / 2;
                        const btnCy = r.top  + r.height / 2;

                        // 必须在日期元素正右方 0~80px，垂直对齐，且尺寸小（≤44px）
                        const dist = btnCx - elRight;
                        if (dist >= 0 && dist <= 80 &&
                            Math.abs(btnCy - elCy) <= elRect.height &&
                            r.width <= 44 && r.height <= 44) {
                            if (dist < bestDist) { bestDist = dist; best = btn; }
                        }
                    }

                    if (best) {
                        // 同时发送 mousedown + click，兼容 React 合成事件
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
        await asyncio.sleep(0.5)   # 等待 React 重渲染
        if cleared and cleared > 0:
            log(f"🗓 [{label}] 已清除 {cleared} 个日期过滤器（全量搜索）")
        else:
            log(f"⚠️  [{label}] 未找到日期清除按钮，使用当前日期范围")
    except Exception as e:
        log(f"⚠️  [{label}] 清除日期过滤失败: {e}")


async def click_query(page, label):
    """Click the Search / 查询 button — handles both English and Chinese UI."""
    for name in ["Search", "查询"]:
        try:
            await page.get_by_role("button", name=name).click(timeout=3000)
            log(f"🔄 [{label}] 已点击搜索")
            return
        except Exception:
            pass
    log(f"⚠️  [{label}] 搜索按钮未找到，跳过")


async def set_page_size(page, label, size=200):
    """Find the items-per-page <select> and set it to the given size.
    If the exact value is not available, falls back to the largest available option.
    """
    try:
        selects = page.locator("select")
        count = await selects.count()
        for i in range(count):
            sel = selects.nth(i)
            options_text = await sel.locator("option").all_text_contents()
            # Only consider numeric options (page-size selects contain numbers)
            numeric_opts = sorted([int(o.strip()) for o in options_text if o.strip().isdigit()])
            if not numeric_opts:
                continue
            # Use exact value if available, else the largest available option
            chosen = size if size in numeric_opts else max(numeric_opts)
            await sel.select_option(str(chosen), timeout=3000)
            if chosen == size:
                log(f"✅ [{label}] 已设置每页 {chosen} 条")
            else:
                log(f"✅ [{label}] 已设置每页 {chosen} 条（请求 {size} 条，超出最大可选值 {max(numeric_opts)}）")
            await asyncio.sleep(1.5)
            return
        log(f"⚠️  [{label}] 未找到页面大小选择器")
    except Exception as e:
        log(f"⚠️  [{label}] 设置页面大小失败: {e}")


def make_response_handler(loop, label, endpoint_keyword, source_key, rc_url=''):
    """Return an async response handler that extracts and pushes data to backend."""
    async def handler(response):
        if endpoint_keyword not in response.url or response.status != 200:
            return
        # Only process JSON / RSC (text) content types; skip binary assets
        ct = response.headers.get("content-type", "")
        if not any(t in ct for t in ("json", "text", "octet")):
            return
        try:
            text = await response.text()
        except Exception:
            # Streaming / already-consumed responses raise CDP errors — ignore silently
            return
        try:
            records = extract_records(text)
            if records:
                log(f"📡 [{label}] 截获 {len(records)} 条")
                await asyncio.get_event_loop().run_in_executor(
                    None, push_to_backend, records, source_key, rc_url
                )
        except Exception as e:
            log(f"⚠️  解析失败 [{label}]: {e}")
    return handler


SIDEBAR_SEL = "nav, aside, [class*='sidebar'], [class*='Sidebar']"
LOGIN_SEL   = "input[type='password']"


async def do_login(page, label=""):
    """Fill credentials and OTP on the current page, then wait for sidebar."""
    prefix = f"[{label}] " if label else ""
    # Username + password
    try:
        await page.locator(
            'input[type="email"], input[name="email"], '
            'input[name="username"], input[placeholder*="用户"], input[placeholder*="邮箱"]'
        ).first.fill(USERNAME, timeout=6000)
        await page.locator('input[type="password"]').first.fill(PASSWORD, timeout=4000)
        await page.locator('button[type="submit"]').first.click(timeout=4000)
        log(f"✅ {prefix}已自动填写用户名和密码")
    except Exception as e:
        log(f"⚠️  {prefix}用户名/密码填写失败 ({e})")

    # OTP — appears on a second step after password submit
    if OTP_SECRET:
        try:
            otp_input = page.locator(
                'input[name="otp"], input[name="code"], input[name="token"], '
                'input[placeholder*="OTP"], input[placeholder*="验证码"], '
                'input[placeholder*="authenticator"], input[maxlength="6"]'
            ).first
            await otp_input.wait_for(timeout=12_000)
            otp_code = pyotp.TOTP(OTP_SECRET).now()
            await otp_input.fill(otp_code)
            log(f"✅ {prefix}已自动填写 OTP 验证码（{otp_code}）")
            try:
                await page.locator('button[type="submit"]').first.click(timeout=3000)
            except Exception:
                pass
        except Exception as e:
            log(f"⚠️  {prefix}OTP 自动填写失败 ({e})")

    # Wait for sidebar to confirm login success
    try:
        await page.wait_for_selector(SIDEBAR_SEL, timeout=30_000)
        await page.wait_for_load_state("networkidle")
        log(f"✅ {prefix}登录成功")
        return True
    except Exception:
        log(f"⚠️  {prefix}等待登录超时")
        return False


async def ensure_logged_in(page, url, label):
    """Navigate to url; if redirected to login, perform auto-login then re-navigate."""
    try:
        await page.goto(url, timeout=30_000)
        await page.wait_for_load_state("networkidle", timeout=10_000)
    except Exception:
        pass

    # Check if we landed on the login page
    if await page.locator(LOGIN_SEL).count() > 0:
        log(f"⚠️  [{label}] 检测到登录页，正在自动登录...")
        ok = await do_login(page, label)
        if ok:
            # Re-navigate to target after login
            try:
                await page.goto(url, timeout=30_000)
                await page.wait_for_load_state("networkidle", timeout=10_000)
            except Exception:
                pass
    else:
        log(f"✅ [{label}] 页面已就绪")


async def run():
    # Read RC base URL: CLI --url override > backend qa-config > default
    RC_URL = fetch_rc_url(_ARGS.url)

    # 根据实际 RC 地址选择对应凭证
    global USERNAME, PASSWORD, OTP_SECRET
    USERNAME, PASSWORD, OTP_SECRET = get_credentials(RC_URL)
    log(f"🔑 使用账号: {USERNAME or '(未设置)'}  OTP: {'已配置' if OTP_SECRET else '未配置'}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=30)

        # Always start fresh — discard stale session to avoid silent auth failures
        if os.path.exists(STATE_FILE):
            try:
                context = await browser.new_context(storage_state=STATE_FILE)
                log(f"💾 已加载保存的会话 ({STATE_FILE})")
            except Exception:
                context = await browser.new_context()
        else:
            context = await browser.new_context()

        # ── Step 1: Login ─────────────────────────────────────────────────────
        print()
        print("=" * 55)
        print("  RCS QA 直连同步服务 v1.1")
        print(f"  RC 系统地址：{RC_URL}")
        print("=" * 55)
        log("🌐 正在打开 RC 系统...")

        page = await context.new_page()
        try:
            await page.goto(RC_URL, timeout=30_000)
            await page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception as e:
            log(f"⚠️  页面加载超时（{e}），继续尝试...")

        # If on login page → auto-login; else session still valid
        if await page.locator(LOGIN_SEL).count() > 0:
            log("🔑 检测到登录页，开始自动登录...")
            await do_login(page)
        else:
            log("✅ 已检测到有效会话，跳过登录步骤")

        # Save session for future runs
        await context.storage_state(path=STATE_FILE)
        log(f"💾 会话状态已保存至 {STATE_FILE}")

        # ── Step 2: Open all alert pages (with auto-login fallback) ───────────
        log("🌐 正在打开告警页面...")
        page_tx     = await context.new_page()
        page_bet    = await context.new_page()
        page_profit = await context.new_page()
        page_reward = await context.new_page()

        # ── 先导航，不挂 handler，避免捕获初始加载的旧数据 ──────────────────
        await ensure_logged_in(page_tx,     f"{RC_URL}/allTransactionAlerts", "allTransactionAlerts")
        await ensure_logged_in(page_bet,    f"{RC_URL}/allBetAlerts",         "allBetAlerts")
        await ensure_logged_in(page_profit, f"{RC_URL}/allGameProfitAlerts",  "allGameProfitAlerts")
        # 优惠告警（日累计领取优惠同比/环比）在独立页面 /rewardAlerts，与投/存告警不同页
        await ensure_logged_in(page_reward, f"{RC_URL}/rewardAlerts",         "rewardAlerts")
        await asyncio.sleep(2)

        # Fetch configured page size from backend before first query
        initial_page_size = 200
        try:
            resp = requests.get(f"{BACKEND_URL}/api/qa-config", timeout=5)
            initial_page_size = int(resp.json().get("syncPageSize", 200))
            log(f"✅ 已从配置读取抓取数量：{initial_page_size} 条")
        except Exception:
            log(f"⚠️  读取抓取数量失败，使用默认值 {initial_page_size} 条")

        await set_page_size(page_tx,     "allTransactionAlerts",   initial_page_size)
        await set_page_size(page_bet,    "allBetAlerts", initial_page_size)
        await set_page_size(page_profit, "allGameProfitAlerts", initial_page_size)
        await set_page_size(page_reward, "rewardAlerts", initial_page_size)

        # ── 导航和页面设置完成后再挂 handler，确保只捕获 click_query 后的新数据 ──
        page_tx.on("response",     make_response_handler(None, "allTransactionAlerts",   "allTransactionAlerts", "transaction", RC_URL))
        page_bet.on("response",    make_response_handler(None, "allBetAlerts", "allBetAlerts",          "bet",         RC_URL))
        page_profit.on("response", make_response_handler(None, "allGameProfitAlerts", "allGameProfitAlerts",   "gameProfit",  RC_URL))
        # /rewardAlerts 默认「告警类型=全部」，一次返回同比+环比两类；后端按 alertType 拆成 typeId 11/12
        page_reward.on("response", make_response_handler(None, "rewardAlerts", "rewardAlerts",          "reward",      RC_URL))

        # 清除日期过滤 → 初始查询（全量数据）
        await clear_date_filters(page_tx,     "allTransactionAlerts")
        await click_query(page_tx, "allTransactionAlerts")
        await asyncio.sleep(1)
        await clear_date_filters(page_bet,    "allBetAlerts")
        await click_query(page_bet, "allBetAlerts")
        await asyncio.sleep(1)
        await clear_date_filters(page_profit, "allGameProfitAlerts")
        await click_query(page_profit, "allGameProfitAlerts")
        await asyncio.sleep(1)
        await clear_date_filters(page_reward, "rewardAlerts")
        await click_query(page_reward, "rewardAlerts")

        print()
        print("✅ 服务已启动！等待 QA 系统触发同步指令...")
        print("💡 在 QA 系统点击「直连风控同步」→「同步到当前列表」即可")
        print("📌 已监听：allTransactionAlerts / allBetAlerts / allGameProfitAlerts / rewardAlerts")
        print("=" * 55)

        # ── Step 3: Poll for manual trigger from QA frontend ──────────────────
        stop_event = asyncio.Event()

        async def poll_trigger_loop():
            """Poll the backend for a sync trigger with exponential backoff on errors."""
            poll_interval   = 2      # normal polling interval (seconds)
            backoff_delay   = 2      # current backoff delay (doubles on consecutive errors)
            max_backoff     = 60     # cap backoff at 60 seconds
            consecutive_err = 0      # number of consecutive poll failures

            while not stop_event.is_set():
                # Sleep (respects stop_event)
                try:
                    await asyncio.wait_for(
                        asyncio.shield(stop_event.wait()),
                        timeout=poll_interval
                    )
                    break  # stop_event was set during sleep
                except asyncio.TimeoutError:
                    pass   # normal — proceed to poll

                if stop_event.is_set():
                    break

                try:
                    import urllib.request as _ur
                    qs  = urlencode({"url": RC_URL})
                    with _ur.urlopen(f"{BACKEND_URL}/api/sync-requested?{qs}", timeout=3) as r:
                        result = json.loads(r.read())

                    # Successful poll — reset backoff
                    if consecutive_err > 0:
                        log("✅ 后端连接已恢复")
                    consecutive_err = 0
                    backoff_delay   = 2
                    poll_interval   = 2

                    # Heartbeat — lets frontend know service is alive
                    try:
                        await asyncio.to_thread(requests.post, f"{BACKEND_URL}/api/sync-heartbeat",
                                                json={"rcBaseUrl": RC_URL}, timeout=5)
                    except Exception:
                        pass

                    if result.get("requested"):
                        page_size = int(result.get("pageSize", 200))
                        log(f"🔔 收到同步指令，每页 {page_size} 条，正在刷新...")
                        await set_page_size(page_tx, "allTransactionAlerts", page_size)
                        await clear_date_filters(page_tx, "allTransactionAlerts")
                        await click_query(page_tx, "allTransactionAlerts")
                        await asyncio.sleep(1)
                        await set_page_size(page_bet, "allBetAlerts", page_size)
                        await clear_date_filters(page_bet, "allBetAlerts")
                        await click_query(page_bet, "allBetAlerts")
                        await asyncio.sleep(1)
                        await set_page_size(page_profit, "allGameProfitAlerts", page_size)
                        await clear_date_filters(page_profit, "allGameProfitAlerts")
                        await click_query(page_profit, "allGameProfitAlerts")
                        await asyncio.sleep(1)
                        await set_page_size(page_reward, "rewardAlerts", page_size)
                        await clear_date_filters(page_reward, "rewardAlerts")
                        await click_query(page_reward, "rewardAlerts")

                except Exception as e:
                    consecutive_err += 1
                    if consecutive_err == 1:
                        log(f"⚠️  后端连接失败（{e}），将自动重试...")
                    elif consecutive_err % 5 == 0:
                        log(f"⚠️  后端仍无响应（已重试 {consecutive_err} 次），下次重试延迟 {backoff_delay}s")
                    # Exponential backoff up to max_backoff
                    poll_interval = min(backoff_delay, max_backoff)
                    backoff_delay = min(backoff_delay * 2, max_backoff)

        task = asyncio.create_task(poll_trigger_loop())

        await asyncio.get_event_loop().run_in_executor(
            None, input, "\n按 Enter 停止服务...\n"
        )

        stop_event.set()
        task.cancel()

        # Save session on exit
        try:
            await context.storage_state(path=STATE_FILE)
            log("💾 会话状态已更新")
        except Exception:
            pass
        log("👋 服务已停止")
        await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n👋 已中断")
