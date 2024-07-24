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


def extract_data(dom, xpaths):
    """使用 XPath 提取数据"""
    
    # 数据清理器，用来清理HTML内容
    cleaner = Cleaner()
    
    # 提取主标题
    main_title_elements = dom.xpath(xpaths['title'])
    main_title = main_title_elements[0].text.strip() if main_title_elements else "未找到标题"
    
    # 提取简介
    profile_elements = dom.xpath(xpaths['profile'])
    profile = " ".join([etree.tostring(p, encoding='unicode', method='html').strip() for p in profile_elements])
    
    # 提取步骤
    steps = []
    step_elements = dom.xpath(xpaths['steps_section'])

    print(f"Found {len(step_elements)} step elements.")  # 输出找到的步骤元素数量

    for step in step_elements:
        # 提取步骤标题
        step_title_elements = step.xpath(xpaths['step_title'])
        step_title = step_title_elements[0].text.strip() if step_title_elements else "未找到步骤标题"
        
        # 如果没有找到步骤标题，跳过该步骤
        if step_title == "未找到步骤标题":
            continue
        
        # 提取步骤项
        step_items = []
        step_item_elements = step.xpath(xpaths['step_items'])

        for item in step_item_elements:
            img_elements = item.xpath(xpaths['step_item_image'])
            
            # 提取内容，排除子内容的部分
            content_elements = item.xpath(xpaths['step_item_content'])
            
            # 如果没有找到内容，跳过该项
            if not content_elements:
                continue
            
            # 提取内容和图片
            img_url = (img_elements[0].get('data-src') or img_elements[0].get('src')) if img_elements else None
            
            content = []
            # 提取子内容
            children_list = []
            for item_content in content_elements:
                li_elements = item_content.xpath(xpaths['step_item_content_children'])
                for li_element in li_elements:
                    children_list.append(cleaner.clean_html(etree.tostring(li_element, encoding='unicode', method='html').strip()))
                
                # 如果没有找到子内容，添加默认信息
                if not li_elements:
                    # 不做任何事情
                    continue


            for content_element in content_elements:
                # 移除内容中的 li 元素
                for li in content_element.xpath(xpaths['step_item_content_children']):
                    li.getparent().remove(li)
                content.append(etree.tostring(content_element, encoding='unicode', method='html').strip())
            
            content = cleaner.clean_html(" ".join(content))
            
            
            # 如果找到图片，则添加到步骤项
            if img_url:
                step_items.append({
                    "img": img_url,
                    "content": content,
                    "children": children_list
                })
        
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
    # 获取 JSON 数据
    data = request.get_json()

    # 获取 URL
    url = data.get('url')

    # 获取所有 XPath 参数
    xpaths = data.get('xpaths', {})

    # 逐个获取 XPath 参数
    title_xpath = xpaths.get('title')
    profile_xpath = xpaths.get('profile')
    step_xpath = xpaths.get('steps_section')
    step_title_xpath = xpaths.get('step_title')
    step_item_xpath = xpaths.get('step_items')
    step_item_img_xpath = xpaths.get('step_item_image')
    step_item_content_xpath = xpaths.get('step_item_content')
    step_item_content_children_xpath = xpaths.get('step_item_content_children')

# 现在你可以使用这些 XPaths 进行后续的处理

    # 验证参数
    if not all([url, title_xpath, profile_xpath, step_xpath, step_title_xpath, step_item_xpath, step_item_img_xpath, step_item_content_xpath, step_item_content_children_xpath]):
        return jsonify({'error': '缺少必要的参数'}), 400

    headers = {'User-Agent': ua}

    # 获取 HTML 内容
    html_content, error = fetch_html(url, headers)
    
    if error:
        return jsonify({'error': error}), 500

    if html_content:
        # 解析 HTML 内容
        dom = parse_html(html_content)
        # 创建一个包含所有 XPath 表达式的字典
        xpaths = {
            "title": title_xpath,
            "profile": profile_xpath,
            "steps_section": step_xpath,
            "step_title": step_title_xpath,
            "step_items": step_item_xpath,
            "step_item_image": step_item_img_xpath,
            "step_item_content": step_item_content_xpath,
            "step_item_content_children": step_item_content_children_xpath
        }

        # 将字典传递给 extract_data
        data = extract_data(dom, xpaths)
        
        # 返回结果
        return jsonify(data), 200
    else:
        return jsonify({'error': '获取 HTML 内容失败。'}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5508)
