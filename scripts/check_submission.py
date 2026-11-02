"""Check the staged Git snapshot for private files and local credentials."""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    files = [name for name in files if name]
    assert files, "Stage the public project files first"
    forbidden = re.compile(r"(?:^|/)(?:\.venv|node_modules|uploads|private_backup|\.manus-logs)/|\.(?:db|sqlite|sqlite3)(?:-wal|-shm)?$|(?:^|/)\.env(?:\..*)?$")
    secrets = []
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            key, sep, value = line.partition("=")
            value = value.strip().strip("\"'")
            if sep and key.strip() in ("OPENAI_API_KEY", "ADMIN_PASSWORD") and len(value) >= 6:
                secrets.append(value.encode())
    for name in files:
        assert name == ".env.example" or not forbidden.search(name), f"Private file staged: {name}"
        data = subprocess.check_output(["git", "show", f":{name}"], cwd=ROOT)
        assert not any(secret in data for secret in secrets), f"Local credential found in staged file: {name}"
        assert not re.search(rb"sk-[A-Za-z0-9_-]{16,}", data), f"Possible API credential staged: {name}"
    fixture = json.loads(subprocess.check_output(["git", "show", ":assistant/data/catalog.json"], cwd=ROOT))
    assert fixture.get("synthetic") is True, "Public catalog must be explicitly invented"
    shop = json.loads(subprocess.check_output(["git", "show", ":assistant/data/shop_catalog.json"], cwd=ROOT))
    assert shop.get("synthetic") is False, "Real shop catalog must be marked synthetic: false"
    parts = shop.get("parts")
    assert isinstance(parts, list) and parts, "Shop catalog must have a non-empty 'parts' list"
    assert not any("sku" in part or "description" in part for part in parts), "Shop catalog must not publish SKU or description (private cost data)"
    live = subprocess.check_output(["git", "show", ":assistant/data/live_results_shop.json"], cwd=ROOT).decode()
    assert not re.search(r"sku", live, re.I), "Live shop results must not mention SKU anywhere (private cost data)"
    print(f"Public snapshot checked: {len(files)} files; no private files or local credentials found.")


if __name__ == "__main__":
    main()
