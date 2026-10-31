"""Servidor local do prototipo, sem cache.

Uso:  python servir.py [porta]

Por que existe: o http.server padrao deixa o navegador guardar o index.html em
cache, e ai a tela mostra uma versao antiga do layout mesmo com o arquivo
atualizado no disco. Aqui toda resposta manda 'no-store', entao um F5 sempre
mostra o que esta no arquivo.
"""

import http.server
import os
import socketserver
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_response(self, code, message=None):
        # 304 (Not Modified) faria o browser reaproveitar o cache antigo.
        if code == 304:
            code = 200
        super().send_response(code, message)

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(RAIZ)
    with Server(("0.0.0.0", PORTA), Handler) as httpd:
        print("Prototipo em http://127.0.0.1:%d/ (sem cache)" % PORTA)
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
