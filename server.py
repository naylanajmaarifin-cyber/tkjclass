#!/usr/bin/env python3
"""Server lokal. `python server.py` -> http://localhost:8000 (kamera boleh di localhost).
Untuk HP di jaringan yang sama dibutuhkan HTTPS: buat sertifikat lalu `python server.py https` (lihat README)."""
import http.server, ssl, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = 8443 if 'https' in sys.argv else 8000
h = http.server.SimpleHTTPRequestHandler
h.extensions_map['.js'] = 'text/javascript'
s = http.server.ThreadingHTTPServer(('0.0.0.0', port), h)
if 'https' in sys.argv:
    c = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); c.load_cert_chain('cert.pem', 'key.pem'); s.socket = c.wrap_socket(s.socket, server_side=True)
print(f"TKJClass: {'https' if 'https' in sys.argv else 'http'}://localhost:{port}  (Ctrl+C untuk berhenti)")
s.serve_forever()
