from __future__ import annotations

import base64
import json
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = "http://localhost:3010"
OUTPUT_DIR = Path("/home/ubuntu/nexora-working/docs/qa-screenshots/mobile-settled")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ROUTES = {
    "overview": "Loading live workspace",
    "ai": "Checking local model",
    "sources": "Loading sources",
    "products": "Loading products",
    "market": "Loading market intelligence",
    "agents": "Loading agent operations",
    "jobs": "Loading automation workspace",
    "workflows": "Loading workflows",
    "alerts": "Loading alerts",
    "reports": "Preparing reports",
    "integrations": "Loading integrations",
    "system": "Checking system health",
    "settings": "Loading settings",
}


def save_full_page(driver: webdriver.Chrome, path: Path) -> None:
    metrics = driver.execute_cdp_cmd("Page.getLayoutMetrics", {})
    content = metrics["contentSize"]
    screenshot = driver.execute_cdp_cmd(
        "Page.captureScreenshot",
        {
            "format": "png",
            "captureBeyondViewport": True,
            "fromSurface": True,
            "clip": {
                "x": 0,
                "y": 0,
                "width": content["width"],
                "height": content["height"],
                "scale": 1,
            },
        },
    )
    path.write_bytes(base64.b64decode(screenshot["data"]))


def body_has_settled(driver: webdriver.Chrome, loading_text: str) -> bool:
    body = driver.find_element(By.TAG_NAME, "body").text
    return loading_text not in body and "Loading " not in body and "Checking…" not in body


def main() -> None:
    selected_routes = sys.argv[1:]
    routes = {
        route: ROUTES[route]
        for route in (selected_routes or list(ROUTES))
        if route in ROUTES
    }
    if not routes:
        raise SystemExit("Provide one or more known route names")

    options = webdriver.ChromeOptions()
    options.binary_location = "/usr/bin/chromium"
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--hide-scrollbars")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument("--window-size=390,844")

    results: list[dict[str, object]] = []

    with webdriver.Chrome(options=options) as driver:
        driver.execute_cdp_cmd(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": 390,
                "height": 844,
                "deviceScaleFactor": 1,
                "mobile": True,
            },
        )

        for route, loading_text in routes.items():
            driver.get(f"{BASE_URL}/{route}")
            settled = True
            try:
                WebDriverWait(driver, 35, poll_frequency=0.25).until(
                    lambda current: body_has_settled(current, loading_text)
                )
            except TimeoutException:
                settled = False

            time.sleep(0.8)
            metrics = driver.execute_script(
                "return {"
                "clientWidth: document.documentElement.clientWidth,"
                "scrollWidth: document.documentElement.scrollWidth,"
                "clientHeight: document.documentElement.clientHeight,"
                "scrollHeight: document.documentElement.scrollHeight,"
                "bodyText: document.body.innerText.slice(0, 500)"
                "};"
            )
            driver.save_screenshot(str(OUTPUT_DIR / f"{route}-viewport.png"))
            save_full_page(driver, OUTPUT_DIR / f"{route}-full.png")

            results.append(
                {
                    "route": route,
                    "settled": settled,
                    "client_width": metrics["clientWidth"],
                    "scroll_width": metrics["scrollWidth"],
                    "client_height": metrics["clientHeight"],
                    "scroll_height": metrics["scrollHeight"],
                    "horizontal_overflow": metrics["scrollWidth"] > metrics["clientWidth"],
                    "body_preview": metrics["bodyText"],
                }
            )

        if not selected_routes or "overview" in routes:
            driver.get(f"{BASE_URL}/overview")
            WebDriverWait(driver, 35, poll_frequency=0.25).until(
                lambda current: body_has_settled(current, ROUTES["overview"])
            )
            menu = WebDriverWait(driver, 10).until(
                lambda current: current.find_element(By.CSS_SELECTOR, "button[aria-label='Open navigation']")
            )
            menu.click()
            WebDriverWait(driver, 10).until(
                lambda current: current.find_element(By.CSS_SELECTOR, "button[aria-label='Close navigation']")
            )
            time.sleep(0.3)
            driver.save_screenshot(str(OUTPUT_DIR / "navigation-drawer.png"))

    metrics_name = (
        f"metrics-{'-'.join(selected_routes)}.json" if selected_routes else "metrics.json"
    )
    (OUTPUT_DIR / metrics_name).write_text(
        json.dumps(results, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
