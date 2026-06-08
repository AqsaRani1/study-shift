#!/usr/bin/env python3
"""
StudyShift Local Dev Server — python3 server.py → open http://localhost:8000
Proxies /api/gemini to Google Gemini API using GEMINI_API_KEY from .env
"""
import http.server, socketserver, json, urllib.request, urllib.error, os, re

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def get_key():
    # 1. try .env file
    try:
        txt = open('.env').read()
        m = re.search(r'GEMINI_API_KEY\s*=\s*([^\s#]+)', txt)
        if m: return m.group(1).strip()
    except: pass
    # 2. try environment variable
    return os.environ.get('GEMINI_API_KEY','')

class H(http.server.SimpleHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
    def do_OPTIONS(self):
        self.send_response(200); self.cors(); self.end_headers()
    def do_POST(self):
        if self.path == '/api/gemini': self.proxy()
        else: self.send_error(404)
    def proxy(self):
        key = get_key()
        length = int(self.headers.get('Content-Length',0))
        body   = self.rfile.read(length)
        if not key:
            self.send_response(500); self.cors()
            self.send_header('Content-Type','application/json'); self.end_headers()
            self.wfile.write(json.dumps({'error':'No GEMINI_API_KEY in .env file'}).encode()); return
        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}'
        req = urllib.request.Request(url, data=body, headers={'Content-Type':'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req) as r:
                data = r.read()
                self.send_response(200); self.cors()
                self.send_header('Content-Type','application/json'); self.end_headers()
                self.wfile.write(data); print('  ✓ Gemini 200')
        except urllib.error.HTTPError as e:
            err = e.read()
            self.send_response(e.code); self.cors()
            self.send_header('Content-Type','application/json'); self.end_headers()
            self.wfile.write(err); print(f'  ✗ Gemini {e.code}')
    def log_message(self,*a): pass

key = get_key()
print(f"\n⚡ StudyShift → http://localhost:{PORT}")
print(f"   Gemini key: {'✓ Found' if key else '✗ Missing — add GEMINI_API_KEY=yourkey to .env'}\n")
with socketserver.TCPServer(('',PORT),H) as s:
    s.allow_reuse_address = True
    try: s.serve_forever()
    except KeyboardInterrupt: print('\nStopped.')
