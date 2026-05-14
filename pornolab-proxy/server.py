from flask import Flask, request, Response
import requests
from flask_cors import CORS

app = Flask(__name__)
# Разрешаем CORS, так как Shiru будет стучаться из своего домена/webview
CORS(app)

@app.route('/proxy', methods=['GET'])
def proxy():
    url = request.args.get('url')
    if not url:
        return "Missing url parameter", 400

    # Получаем куки и User-Agent от плагина Shiru
    user_agent = request.headers.get('X-Proxy-User-Agent', '')
    cookie = request.headers.get('X-Proxy-Cookie', '')

    headers = {
        'User-Agent': user_agent,
        'Cookie': cookie
    }

    try:
        # Делаем настоящий запрос к PornoLab
        resp = requests.get(url, headers=headers, timeout=15)
        # Отдаем сырой HTML (байты) обратно в плагин
        return Response(
            resp.content, 
            status=resp.status_code, 
            content_type=resp.headers.get('content-type', 'text/html')
        )
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    print("Proxy server is running on http://127.0.0.1:5000")
    app.run(port=5000, debug=False)
