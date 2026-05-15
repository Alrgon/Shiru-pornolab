from flask import Flask, request, Response
import requests
from flask_cors import CORS

app = Flask(__name__)
# Разрешаем CORS, так как Shiru будет стучаться из своего домена/webview
CORS(app)

import base64

@app.route('/proxy', methods=['GET'])
def proxy():
    b64url = request.args.get('b64url')
    if not b64url:
        return "Missing b64url parameter", 400
    url = base64.b64decode(b64url).decode('utf-8')

    # Получаем куки и User-Agent от плагина Shiru (через заголовки ИЛИ параметры)
    user_agent = request.headers.get('X-Proxy-User-Agent') or request.args.get('ua', '')
    cookie = request.headers.get('X-Proxy-Cookie') or request.args.get('cookie', '')

    headers = {
        'User-Agent': user_agent,
        'Cookie': cookie
    }

    try:
        print(f"Fetching URL: {url}")
        # Делаем настоящий запрос к PornoLab
        resp = requests.get(url, headers=headers, timeout=15)
        print(f"Response starts with: {resp.content[:20]}")

        # Отдаем сырой HTML (байты) обратно в плагин
        return Response(
            resp.content, 
            status=resp.status_code, 
            headers={'Content-Type': resp.headers.get('content-type', 'application/octet-stream')}
        )
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    print("Proxy server is running on http://127.0.0.1:5000")
    app.run(port=5000, debug=False)
