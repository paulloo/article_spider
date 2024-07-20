from flask import Flask, request, jsonify, Response
import requests
from bs4 import BeautifulSoup
import json
import html

from lxml import etree


app = Flask(__name__)

def get_article(url, title_node, title_class, content_node, content_class):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        "Referer": "https://juejin.im/",
        "X-Agent": "Juejin/Web",
        "Content-Type": "application/json",
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # 检查HTTP请求状态
        response.encoding = 'utf-8'
    except requests.RequestException as e:
        return {'error': f"请求失败：{str(e)}"}

    try:
        soup = BeautifulSoup(response.text, 'html.parser')
        title = soup.find(title_node, class_=title_class).get_text(strip=True)
        content = soup.find(content_node, class_=content_class)
        if content:
            # content = content.get_text(strip=True)
            
            content = content.prettify()
            
            content = html.unescape(content)  # 去除转义符
        else:
            return {'error': '内容节点未找到或为空'}
    except (AttributeError, TypeError) as e:
        return {'error': f"解析失败：{str(e)}"}

    return {'title': title, 'content': content}

@app.route('/parse_article', methods=['POST'])
def parse_article():
    data = request.get_json()
    url = data.get('url')
    title_node = data.get('title_node')
    title_class = data.get('title_class')
    content_node = data.get('content_primary_node')
    content_class = data.get('content_class')

    if not all([url, title_node, content_node, content_class]):
        return jsonify({'error': '缺少必要的参数'})

    article = get_article(url, title_node, title_class, content_node, content_class)
    
    # 使用 Response 对象创建自定义响应，确保输出的 HTML 不会被再次转义
    response = Response(json.dumps(article, ensure_ascii=False), content_type="application/json; charset=utf-8")
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5508)
