"""Exercise the installed Pi in a PTY without sending a model prompt."""

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

ROOT = Path(__file__).resolve().parent.parent
ANSI = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]")


def exercise(mode, extension):
    config = json.loads((ROOT / "status-lines.json").read_text())
    temporary = tempfile.TemporaryDirectory(prefix=".test-terminal-", dir=ROOT)
    config_path = Path(temporary.name) / "config.json"
    config_path.write_text(json.dumps(config))
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 35, 120, 0, 0))
    process = subprocess.Popen(
        ["pi", "--no-session", "--offline", "--no-extensions", "--no-skills",
         "--no-prompt-templates", "--no-context-files", "--no-approve",
         "--tui-mode", mode, "--provider", "openai-codex", "--model", "gpt-5.5",
         "-e", str(extension), "--status-lines-config", str(config_path)],
        cwd=ROOT, stdin=slave, stdout=slave, stderr=slave,
        env={**os.environ, "TERM": "xterm-256color"}, start_new_session=True,
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
        os.write(master, b"/status-lines off\r")
        wait_for(lambda text: "(auto)" in text, "built-in footer restore")
        os.write(master, b"/status-lines on\r")
        wait_for(lambda text: "weekly offline" in text, "custom footer restore")
        config["separator"] = " / "
        config_path.write_text(json.dumps(config))
        os.write(master, b"/status-lines reload\r")
        wait_for(lambda text: "openai-codex / gpt-5.5 / thinking" in text, "reload changed config")
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 35, 30, 0, 0))
        process.send_signal(signal.SIGWINCH)
        wait_for(lambda text: "weekly offline" in text, "narrow resize")
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 35, 120, 0, 0))
        process.send_signal(signal.SIGWINCH)
        wait_for(lambda text: "gpt-5.5" in text and "weekly offline" in text, "wide resize")
        os.write(master, b"\x04")
        process.wait(timeout=10)
        assert process.returncode == 0, process.returncode
        text = ANSI.sub("", capture.decode("utf-8", errors="replace"))
        assert "Failed to load extension" not in text
        assert "Status Lines:" not in text
        print(f"{mode}: startup, off/on, reload, narrow/wide resize, shutdown passed")
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
    args = parser.parse_args()
    for mode in ("regular", "fullscreen"):
        exercise(mode, args.extension.resolve())
