from bs4 import BeautifulSoup
from flask import Flask, request, jsonify
import requests
from lxml import etree
from lxml.html.clean import Cleaner
from flask_cors import CORS
cleaner = Cleaner()
app = Flask(__name__)
CORS(app, supports_credentials=True)
# 定义默认的 User-Agent
ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240"

def fetch_html(url, headers):
    """发送 HTTP 请求并返回 HTML 内容"""
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text, None
    except requests.RequestException as e:
        return None, f"请求失败：{e}"

def parse_html(content):
    """解析 HTML 内容并返回 DOM 树"""
    return etree.HTML(content)

def extract_data(dom, title_xpath, profile_xpath, step_xpath, step_title_xpath, step_item_xpath, step_item_img_xpath, step_item_content_xpath):
    """使用 XPath 提取数据"""
    # 提取主标题
    main_title_elements = dom.xpath(title_xpath)
    main_title = main_title_elements[0].text.strip() if main_title_elements else "未找到标题"
    
    # 提取简介
    profile_elements = dom.xpath(profile_xpath)
    profile = " ".join([etree.tostring(p, encoding='unicode', method='html').strip() for p in profile_elements])
    
    # 提取步骤
    steps = []
    step_elements = dom.xpath(step_xpath)

    print(f"Found {len(step_elements)} step elements.")  # 输出找到的步骤元素数量

    for step in step_elements:
        # 提取步骤标题
        step_title_elements = step.xpath(step_title_xpath)
        step_title = step_title_elements[0].text.strip() if step_title_elements else "未找到步骤标题"
        
        # 提取步骤项
        step_items = []
        step_item_elements = step.xpath(step_item_xpath)

        for item in step_item_elements:
            img_elements = item.xpath(step_item_img_xpath)
            content_elements = item.xpath(step_item_content_xpath)
            
            # 提取内容和图片
            img_url = img_elements[0].get('data-src') or img_elements[0].get('src') if img_elements else "未找到图片"
            content = etree.tostring(content_elements[0], encoding='unicode', method='html').strip() if content_elements else "未找到内容"
            content = cleaner.clean_html(content)
            # img_url 有内容才append 并且不是 "未找到图片"
            if img_url and img_url != "未找到图片":
                step_items.append({
                    "img": img_url,
                    "content": content
                })
            
            
        if step_title and step_title != "未找到步骤标题":

            steps.append({
                "title": step_title,
                "step_items": step_items
            })

    return {
        "title": main_title,
        "profile": profile,
        "steps": steps
    }

@app.route('/fetch_content', methods=['POST'])
def fetch_content():
    data = request.get_json()

    # 获取入参
    url = data.get('url')
    title_xpath = data.get('title_xpath')
    profile_xpath = data.get('profile_xpath')
    step_xpath = data.get('step_xpath')
    step_title_xpath = data.get('step_title_xpath')
    step_item_xpath = data.get('step_item_xpath')
    step_item_img_xpath = data.get('step_item_img_xpath')
    step_item_content_xpath = data.get('step_item_content_xpath')

    # 验证参数
    if not all([url, title_xpath, profile_xpath, step_xpath, step_title_xpath, step_item_xpath, step_item_img_xpath, step_item_content_xpath]):
        return jsonify({'error': '缺少必要的参数'}), 400

    headers = {'User-Agent': ua}

    # 获取 HTML 内容
    html_content, error = fetch_html(url, headers)
    
    if error:
        return jsonify({'error': error}), 500

    if html_content:
        # 解析 HTML 内容
        dom = parse_html(html_content)
        
        # 提取数据
        data = extract_data(dom, title_xpath, profile_xpath, step_xpath, step_title_xpath, step_item_xpath, step_item_img_xpath, step_item_content_xpath)
        
        # 返回结果
        return jsonify(data), 200
    else:
        return jsonify({'error': '获取 HTML 内容失败。'}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5508)
