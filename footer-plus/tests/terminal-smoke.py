"""Exercise both extensions in an isolated PTY without a model prompt."""

import argparse
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import struct
import subprocess
import termios
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
ANSI = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]")


def exercise(mode, extension, session_extension):
    config = json.loads((ROOT / "footer.json").read_text())
    temporary = tempfile.TemporaryDirectory(prefix=".test-terminal-", dir=ROOT)
    agent = Path(temporary.name)
    config_path = agent / "config.json"
    overrides = agent / "footer-overrides.json"
    config_path.write_text(json.dumps(config))
    sessions = agent / "sessions"
    sessions.mkdir()
    # Keep a trash-capable host from writing outside the isolated fixture tree.
    data = agent / "data"
    data.mkdir()
    fixture = sessions / "fixture.jsonl"
    fixture.write_text("\n".join(json.dumps(entry) for entry in [
        {"type": "session", "version": 3, "id": str(uuid.uuid4()), "timestamp": "2026-09-30T12:00:00.000Z", "cwd": str(ROOT)},
        {"type": "session_info", "id": "fixture1", "parentId": None, "timestamp": "2026-09-30T12:00:00.000Z", "name": "smoke fixture"},
    ]) + "\n")
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
    process = subprocess.Popen(
        ["pi", "--session-dir", str(sessions), "--offline", "--no-extensions", "--no-skills",
         "--no-prompt-templates", "--no-context-files", "--no-approve",
         "--tui-mode", mode, "--provider", "openai-codex", "--model", "gpt-5.5",
         "-e", str(extension), "-e", str(session_extension), "--footer-config", str(config_path),
         "--footer-overrides", str(overrides)],
        cwd=ROOT, stdin=slave, stdout=slave, stderr=slave,
        env={**os.environ, "TERM": "xterm-256color", "PI_CODING_AGENT_DIR": str(agent), "XDG_DATA_HOME": str(data)}, start_new_session=True,
    )
    os.close(slave)
    capture = bytearray()

    def wait_for(predicate, label):
        chunk = bytearray()
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if select.select([master], [], [], max(0, deadline - time.monotonic()))[0]:
                try:
                    data = os.read(master, 65536)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    data = b""
                if not data:
                    raise AssertionError(f"Pi exited during {label}: {process.poll()}")
                capture.extend(data)
                chunk.extend(data)
                if b"\x1b[6n" in data:
                    os.write(master, b"\x1b[1;1R")
                if b"\x1b[?u" in data:
                    os.write(master, b"\x1b[?0u")
                text = ANSI.sub("", chunk.decode("utf-8", errors="replace"))
                if predicate(text):
                    return
        raise AssertionError(f"Timed out during {label}")

    try:
        wait_for(lambda text: "weekly offline" in text and "openai-codex | gpt-5.5 | thinking" in text, "startup")
        os.write(master, b"/footer\r")
        wait_for(lambda text: "Save applies" in text, "footer panel")
        os.write(master, b"session\r")
        wait_for(lambda text: "Enabled" in text and "Position" in text, "widget settings")
        os.write(master, b"\r")
        wait_for(lambda text: "session" in text and "on, row 0" in text, "enable session")
        os.write(master, b"\x15Save\r")
        wait_for(lambda text: overrides.exists() and any(spec.get("enabled") for line in json.loads(overrides.read_text())["lines"] for spec in line.get("left", []) if spec["widget"] == "session"), "persist panel")
        os.write(master, b"/sessions\r")
        wait_for(lambda text: "smoke fixture" in text, "session panel")
        os.write(master, b"\x12")
        wait_for(lambda text: "Rename" in text, "rename input")
        os.write(master, b"\x05\x15renamed fixture\r")
        wait_for(lambda text: "renamed fixture" in text and "Resume Session (Current Folder)" in text, "rename session")
        assert "renamed fixture" in fixture.read_text()
        os.write(master, b"\r")
        wait_for(lambda text: "weekly offline" in text and "renamed fixture" in text, "resume session")
        os.write(master, b"/sessions\r")
        wait_for(lambda text: "\u203a renamed fixture" in text, "reopen session panel")
        os.write(master, b"\x04")
        wait_for(lambda text: "currently active session" in text.lower(), "protect active session")
        os.write(master, b"\x1b[110;7u")
        wait_for(lambda text: "New session started" in text and "weekly offline" in text, "new session")
        os.write(master, b"\x1b[115;7u")
        wait_for(lambda text: "\u203a renamed fixture" in text, "session shortcut")
        os.write(master, b"renamed\x04")
        wait_for(lambda text: "Delete session?" in text, "delete confirmation")
        os.write(master, b"\r")
        wait_for(lambda text: not fixture.exists() and ("Session deleted" in text or "Session moved to trash" in text), "delete inactive session")
        # Fullscreen keeps the unobscured footer unchanged when the overlay closes.
        # A footer command verifies focus returned to the editor without waiting for a reprint.
        os.write(master, b"\x1b[27u/footer off\r")
        wait_for(lambda text: "(auto)" in text, "close panel and restore built-in footer")
        os.write(master, b"/footer on\r")
        wait_for(lambda text: "weekly offline" in text, "custom footer restore")
        os.write(master, b"/footer reset\r")
        wait_for(lambda text: not overrides.exists() and "main checkout" in text, "reset overrides")
        config["separator"] = " / "
        config_path.write_text(json.dumps(config))
        os.write(master, b"/footer reload\r")
        wait_for(lambda text: "openai-codex / gpt-5.5 / thinking" in text, "reload changed config")
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 30, 0, 0))
        process.send_signal(signal.SIGWINCH)
        wait_for(lambda text: "weekly offline" in text, "narrow resize")
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))
        process.send_signal(signal.SIGWINCH)
        wait_for(lambda text: "gpt-5.5" in text and "weekly offline" in text, "wide resize")
        os.write(master, b"\x04")
        process.wait(timeout=10)
        assert process.returncode == 0, process.returncode
        text = ANSI.sub("", capture.decode("utf-8", errors="replace"))
        assert "Failed to load extension" not in text
        assert "footer++:" not in text
        print(f"{mode}: footer edit/save/reset, session rename/resume/new/delete/protection/shortcut, off/on, reload, resize, shutdown passed")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        os.close(master)
        (ROOT / f"terminal-{mode}.log").write_bytes(capture)
        temporary.cleanup()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension", type=Path, default=ROOT)
    parser.add_argument("--session-extension", type=Path, default=ROOT / "src/session-manager.ts")
    args = parser.parse_args()
    for mode in ("regular", "fullscreen"):
        exercise(mode, args.extension.resolve(), args.session_extension.resolve())
