# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Minimal client for the Unreal MCP (Epic's ModelContextProtocol plugin) over Streamable HTTP.
# Import it (UnrealMCP().call(toolset, tool, args)) or use it from the command line:
#   python mcp_client.py wait [seconds]                    wait until the server answers
#   python mcp_client.py tools                             raw tools/list
#   python mcp_client.py toolsets                          list_toolsets
#   python mcp_client.py describe <toolset>                describe_toolset (JSON schema)
#   python mcp_client.py call <toolset> <tool> ['<json>']  call_tool
# Image results (such as EditorAppToolset CaptureViewport) are saved as PNG files into
# UNREAL_MCP_IMAGES (default: the current folder) and their paths are printed.
# The server URL defaults to http://127.0.0.1:8000/mcp (set UNREAL_MCP_URL to change it).
import base64
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zlib
from typing import Any

URL = os.environ.get("UNREAL_MCP_URL", "http://127.0.0.1:8000/mcp")
PROTOCOL = "2025-06-18"


class MCPError(RuntimeError):
    pass


class MCPTruncated(MCPError):
    """The server cut the reply short (see _read_all). The call itself ran in the editor."""


def _salvage_image(raw):
    """The 5.8 server sometimes resets the connection about 1 KB before the end of a large
    reply (tens of KB and up, such as Niagara topologies and viewport captures). The PNG inside is then cut short but still decodes
    (ffmpeg reads it); return it as an image result and say so."""
    key = '\\"data\\":\\"'
    i = raw.find(key)
    if i < 0:
        raise MCPTruncated(f"reply cut short by the server ({len(raw)} bytes received)")
    found = re.match(r"[A-Za-z0-9+/]*", raw[i + len(key):])
    b64 = found.group(0) if found else ""
    b64 = b64[: len(b64) // 4 * 4]
    print(f"warning: reply cut short by the server; salvaged a truncated PNG ({len(b64)} base64 chars)",
          file=sys.stderr)
    return {"result": {"content": [{"type": "image", "mimeType": "image/png",
                                    "data": b64}]}, "jsonrpc": "2.0"}


def _repair_png(data):
    """Closes a PNG that was cut short: the last chunk is shortened to the bytes present
    (with a new CRC) and an IEND chunk is added. The image then decodes, with its last rows
    possibly missing."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return data
    out, pos = [data[:8]], 8
    while pos + 8 <= len(data):
        length = int.from_bytes(data[pos:pos + 4], "big")
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IEND":
            break
        if len(body) < length or pos + 12 + length > len(data):
            if kind == b"IDAT" and body:      # keep what arrived of the last data chunk
                out.append(len(body).to_bytes(4, "big") + kind + body
                           + zlib.crc32(kind + body).to_bytes(4, "big"))
            break
        out.append(data[pos:pos + 12 + length])
        pos += 12 + length
    out.append((0).to_bytes(4, "big") + b"IEND" + zlib.crc32(b"IEND").to_bytes(4, "big"))
    return b"".join(out)


def _save_png(b64):
    out_dir = os.environ.get("UNREAL_MCP_IMAGES", ".")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"mcp_image_{int(time.time() * 1000)}.png")
    with open(path, "wb") as f:
        f.write(_repair_png(base64.b64decode(b64)))
    return path


def _read_all(r):
    """Reads a reply body in chunks. Replies that contain non-ASCII text can carry a
    Content-Length larger than the bytes actually sent, and the server then resets the
    connection: keep everything that arrived instead of failing."""
    chunks = []
    try:
        while True:
            b = r.read1(65536)
            if not b:
                break
            chunks.append(b)
    except http.client.IncompleteRead as e:
        chunks.append(e.partial)
    except ConnectionResetError:
        pass
    return b"".join(chunks)


class UnrealMCP:
    """One MCP session: initialize on creation, then tools/list and tools/call."""

    def __init__(self, url=URL, timeout=600):
        self.url, self.timeout, self.session, self._id = url, timeout, None, 0
        res = self._rpc("initialize", {
            "protocolVersion": PROTOCOL,
            "capabilities": {},
            "clientInfo": {"name": "motion-studio", "version": "1.0"},
        })
        self.server_info = res.get("serverInfo", {})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def _post(self, body):
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        req = urllib.request.Request(self.url, json.dumps(body).encode("utf8"), headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                self.session = r.headers.get("Mcp-Session-Id") or self.session
                ctype = r.headers.get("Content-Type", "")
                raw = _read_all(r).decode("utf8", "replace")
        except urllib.error.HTTPError as e:
            raise MCPError(f"HTTP {e.code}: {e.read().decode('utf8', 'replace')[:500]}") from None
        if not raw.strip():
            return None
        if "text/event-stream" in ctype:     # only used when a progress token is sent
            data = [ln[5:].strip() for ln in raw.splitlines() if ln.startswith("data:")]
            return json.loads(data[-1]) if data else None
        try:
            return json.loads(raw)
        except ValueError:
            return _salvage_image(raw)

    def _rpc(self, method, params=None):
        self._id += 1
        msg = self._post({"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}})
        if msg is None:
            raise MCPError(f"{method}: empty reply")
        if "error" in msg:
            raise MCPError(f"{method}: {msg['error']}")
        return msg["result"]

    def list_tools(self):
        return self._rpc("tools/list")["tools"]

    def tool(self, name, arguments=None) -> Any:
        """Calls a top-level MCP tool and returns its text (parsed as JSON when possible)."""
        res = self._rpc("tools/call", {"name": name, "arguments": arguments or {}})
        text = "\n".join(c.get("text", "") for c in res.get("content", []) if c.get("type") == "text")
        if res.get("isError"):
            raise MCPError(f"{name}: {text[:2000]}")
        images = [c["data"] for c in res.get("content", []) if c.get("type") == "image"]
        try:
            out = json.loads(text) if text else {}
        except ValueError:
            return text
        # CaptureViewport and similar tools return {"returnValue": {"image": {"data": <base64>}}}
        rv = out.get("returnValue") if isinstance(out, dict) else None
        if isinstance(rv, dict) and isinstance(rv.get("image"), dict) and "data" in rv["image"]:
            images.append(rv["image"].pop("data"))
        if images:
            paths = [_save_png(b64) for b64 in images]
            if not isinstance(out, dict) or not out:
                out = {}
            out["saved_images"] = paths
            print("saved image:", *paths, file=sys.stderr)
        return out

    def toolsets(self):
        return self.tool("list_toolsets")

    def describe(self, toolset):
        return self.tool("describe_toolset", {"toolset_name": toolset})

    def call(self, toolset, tool, arguments=None) -> Any:
        """Calls one toolset tool through call_tool (tool search mode)."""
        return self.tool("call_tool", {"toolset_name": toolset, "tool_name": tool, "arguments": arguments or {}})


def wait_for_server(seconds=540, url=URL):
    """Polls until initialize succeeds. Returns True when the server answers."""
    end = time.time() + seconds
    while time.time() < end:
        try:
            UnrealMCP(url, timeout=5)
            return True
        except (OSError, MCPError):
            time.sleep(5)
    return False


def _show(x):
    print(x if isinstance(x, str) else json.dumps(x, indent=1))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__ or "see the header comment"); sys.exit(1)
    if a[0] == "wait":
        ok = wait_for_server(int(a[1]) if len(a) > 1 else 540)
        print("MCP READY" if ok else "MCP NOT READY"); sys.exit(0 if ok else 1)
    m = UnrealMCP()
    if a[0] == "tools":
        _show([t["name"] for t in m.list_tools()])
    elif a[0] == "toolsets":
        _show(m.toolsets())
    elif a[0] == "describe":
        _show(m.describe(a[1]))
    elif a[0] == "call":
        _show(m.call(a[1], a[2], json.loads(a[3]) if len(a) > 3 else {}))
    else:
        print("unknown command", a[0]); sys.exit(1)
