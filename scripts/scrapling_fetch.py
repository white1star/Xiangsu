# Scrapling 隐身浏览器抓取桥：供 Node 适配器调用，抓取被 WAF/指纹拦截的公开页面。
# 用法：<venv-python> -X utf8 scripts/scrapling_fetch.py <spec.json>
# 输入 spec：{"url": "...", "capture": "regex", "timeout": 90000, "wait": 0,
#              "disableResources": false, "actions": [{"type": "fill|click|wait|evaluate", ...}]}
# 输出 stdout（UTF-8）：{"ok": true, "status": 200, "url": "...", "html": "...",
#                        "xhr": [{"url": "...", "status": 200, "body": "..."}]}
# 失败：{"ok": false, "error": "..."}
# 边界：只抓匿名可看的公开页；遇验证码/登录墙不绕过，由调用方如实记失败。

import json
import sys


def run_actions(page, actions):
    for action in actions:
        kind = action.get("type")
        if kind == "fill":
            page.fill(action["selector"], action.get("value", ""))
        elif kind == "click":
            page.click(action["selector"])
        elif kind == "wait":
            page.wait_for_timeout(int(action.get("ms", 1000)))
        elif kind == "evaluate":
            page.evaluate(action.get("script", ""))


def main():
    with open(sys.argv[1], encoding="utf-8") as fh:
        spec = json.load(fh)

    from scrapling.fetchers import StealthyFetcher

    kwargs = {
        "headless": True,
        "network_idle": True,
        "timeout": int(spec.get("timeout", 90000)),
    }
    if spec.get("capture"):
        kwargs["capture_xhr"] = spec["capture"]
    if spec.get("disableResources"):
        kwargs["disable_resources"] = True
    if spec.get("wait"):
        kwargs["wait"] = int(spec["wait"])
    actions = spec.get("actions") or []
    if actions:
        kwargs["page_action"] = lambda page: run_actions(page, actions)

    try:
        page = StealthyFetcher.fetch(spec["url"], **kwargs)
        html = page.body if isinstance(page.body, str) else page.body.decode("utf-8", "ignore")
        xhr = []
        for item in getattr(page, "captured_xhr", None) or []:
            body = item.body if isinstance(item.body, str) else item.body.decode("utf-8", "ignore")
            xhr.append({"url": item.url, "status": item.status, "body": body})
        payload = {"ok": True, "status": page.status, "url": page.url, "html": html, "xhr": xhr}
    except Exception as error:  # 桥接层把任何异常作为失败信息回传给 Node
        payload = {"ok": False, "error": f"{type(error).__name__}: {error}"}

    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
