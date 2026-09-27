"""Publish dist/ to a static Hugging Face Space.

Needs a one-time `hf auth login` (write token) in your own terminal.
Usage: python scripts/deploy-hf.py [space_name]
"""
import sys
from pathlib import Path

from huggingface_hub import HfApi

SPACE = sys.argv[1] if len(sys.argv) > 1 else "pickdot"
DIST = Path(__file__).resolve().parent.parent / "dist"

# Hugging Face reads Space settings from README front matter.
README = """---
title: Pickdot
emoji: 🎯
colorFrom: pink
colorTo: gray
sdk: static
app_file: index.html
pinned: false
short_description: Two images in, a hedged pick out. Runs in your browser.
---

Pickdot compares two images for your audience: attention maps, text size at
feed scale, contrast, faces — measured in the browser, judged by readable rules.
"""

if not (DIST / "index.html").exists():
    sys.exit("dist/ is missing. Run `npm run build` first.")

api = HfApi()
user = api.whoami()["name"]
repo_id = f"{user}/{SPACE}"
api.create_repo(repo_id, repo_type="space", space_sdk="static", exist_ok=True)
(DIST / "README.md").write_text(README, encoding="utf-8")
api.upload_folder(
    repo_id=repo_id,
    repo_type="space",
    folder_path=DIST,
    commit_message="Deploy Pickdot",
    delete_patterns=["assets/*"],  # drop stale hashed bundles from earlier deploys
)
print(f"Live at https://huggingface.co/spaces/{repo_id}")
print(f"Direct:  https://{user.lower()}-{SPACE}.hf.space")
