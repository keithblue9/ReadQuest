"""Jalankan API di soket dual-stack (IPv4 + IPv6): `python -m app.serve`.

Jaringan privat sebagian platform (mis. Railway) memakai IPv6, sedangkan health check dan
Docker Compose memakai IPv4. `uvicorn --host ::` hanya IPv6 (asyncio memasang IPV6_V6ONLY),
jadi soket disiapkan sendiri. Port dari env `PORT` (default 8000).
"""

import os
import socket

import uvicorn


def listen_socket(port: int) -> socket.socket:
    """Soket `[::]:port` dual-stack; jatuh ke `0.0.0.0:port` bila IPv6 tidak tersedia."""
    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("::", port))
    except OSError:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", port))
    return sock


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    # IP klien dari X-Forwarded-For hanya bila peer ada di FORWARDED_ALLOW_IPS (env).
    config = uvicorn.Config("app.main:app", proxy_headers=True, server_header=False)
    uvicorn.Server(config).run(sockets=[listen_socket(port)])


if __name__ == "__main__":
    main()
