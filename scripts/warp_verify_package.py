"""Independent stdlib ZIP/CRC/SHA and complete bidirectional Git-tree audit."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import zipfile

root = Path.cwd().resolve()
archive = Path(sys.argv[1]).resolve()
assert archive.is_relative_to(root / "review-packages")

def git(*args, data=None, env=None):
    return subprocess.run(["git", *args], input=data, check=True, capture_output=True, env=env).stdout

head = git("rev-parse", "HEAD").decode().strip()
baseline = "218d6a1d477d9a61b08c0abd1828aa61c3b95562"
sha = lambda data: hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names = z.namelist()
    assert len(names) == len(set(names))
    assert z.read("changes/head.txt").decode().strip() == head
    assert z.read("changes/baseline.txt").decode().strip() == baseline
    inventory = json.loads(z.read("reports/content-inventory.json"))
    assert set(names) == {r["path"] for r in inventory} | {"reports/content-inventory.json"}
    for row in inventory:
        data = z.read(row["path"])
        assert len(data) == row["bytes"] and sha(data) == row["sha256"], row["path"]
    paths = [n.removeprefix("project_snapshot/") for n in names if n.startswith("project_snapshot/")]
    batch = git("cat-file", "--batch", data=("\n".join(f"{head}:{p}" for p in paths) + "\n").encode())
    cursor = 0
    for path in paths:
        end = batch.index(b"\n", cursor)
        header = batch[cursor:end].split()
        assert header[1] == b"blob"
        size = int(header[2]); cursor = end + 1
        assert z.read(f"project_snapshot/{path}") == batch[cursor:cursor + size], path
        cursor += size + 1
    patch = z.read("changes/baseline-to-head.patch")

scratch = (root / ".cache" / "review" / "VISUAL-006" / f"independent-{head[:7]}").resolve()
assert scratch.is_relative_to(root / ".cache" / "review" / "VISUAL-006")
scratch.mkdir(parents=True, exist_ok=True)
patch_path = scratch / "binary.patch"; patch_path.write_bytes(patch)
env = {**os.environ, "GIT_INDEX_FILE": str(scratch / "audit.index")}
git("read-tree", baseline, env=env)
git("apply", "--cached", "--check", "--binary", str(patch_path), env=env)
git("apply", "--cached", "--binary", str(patch_path), env=env)
assert git("write-tree", env=env) == git("rev-parse", f"{head}^{{tree}}")
git("apply", "--cached", "--reverse", "--check", "--binary", str(patch_path), env=env)
git("apply", "--cached", "--reverse", "--binary", str(patch_path), env=env)
assert git("write-tree", env=env) == git("rev-parse", f"{baseline}^{{tree}}")
result = {"archive": str(archive), "bytes": archive.stat().st_size, "sha256": sha(archive.read_bytes()),
          "entries": len(names), "sourceFilesComparedToHead": len(paths), "baseline": baseline, "head": head,
          "crc": "Python zipfile.testzip passed", "inventory": "every SHA256/length passed",
          "forward": "complete HEAD tree exact", "reverse": "complete baseline tree exact"}
archive.with_suffix(archive.suffix + ".independent-verification.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
