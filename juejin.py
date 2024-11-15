
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from lxml import etree, html
from lxml.html.clean import Cleaner
import cssselect

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

def css_to_xpath(css_selector):
    """将 CSS 选择器转换为 XPath"""
    return cssselect.HTMLTranslator().css_to_xpath(css_selector)

def apply_filters(content, filters):
    """应用过滤器剔除不需要的标签或符号"""
    root = html.fromstring(content)
    for f in filters:
        etree.strip_elements(root, f, with_tail=False)
    return etree.tostring(root, encoding='unicode', method='html')

def extract_data(dom, rules, filters):
    """使用自定义规则提取数据并应用过滤器"""
    cleaner = Cleaner()
    data = {}

    # 提取主标题
    title_xpath = css_to_xpath(rules['title'])
    if not title_xpath:
        return {'error': '无效的 CSS 选择器: title'}
    main_title = extract_element(dom, title_xpath, filters)
    data['title'] = main_title if main_title else "未找到标题"

    # 提取简介
    profile_xpath = css_to_xpath(rules['profile'])
    if not profile_xpath:
        return {'error': '无效的 CSS 选择器: profile'}
    profile_elements = dom.xpath(profile_xpath)
    profile = " ".join([etree.tostring(p, encoding='unicode', method='html').strip() for p in profile_elements])
    data['profile'] = apply_filters(profile, filters)

    # 提取步骤
    if rules['steps'] is None:
        return data
    
    steps = []
    step_xpath = css_to_xpath(rules['steps']['step_xpath'])
    if not step_xpath:
        return {'error': '无效的 CSS 选择器: steps.step_xpath'}
    step_elements = dom.xpath(step_xpath)
    for step in step_elements:
        step_title_xpath = css_to_xpath(rules['steps']['step_title_xpath'])
        if not step_title_xpath:
            return {'error': '无效的 CSS 选择器: steps.step_title_xpath'}
        step_title = extract_element(step, step_title_xpath, filters)
        if not step_title:
            continue

        step_items = []
        step_item_xpath = css_to_xpath(rules['steps']['step_item_xpath'])
        if not step_item_xpath:
            return {'error': '无效的 CSS 选择器: steps.step_item_xpath'}
        step_item_elements = step.xpath(step_item_xpath)
        for item in step_item_elements:
            step_item = extract_step_item(item, rules['steps'], cleaner, filters)
            if step_item:
                step_items.append(step_item)

        steps.append({
            "title": step_title,
            "step_items": step_items
        })

    data['steps'] = steps
    return data

def extract_element(dom, xpath, filters):
    """提取单个元素并应用过滤器"""
    elements = dom.xpath(xpath)
    if elements:
        content = etree.tostring(elements[0], encoding='unicode', method='html').strip()
        return apply_filters(content, filters)
    return None

def extract_step_item(item, step_rules, cleaner, filters):
    """提取步骤项的内容和图片"""
    img_xpath = css_to_xpath(step_rules['step_item_img_xpath'])
    content_xpath = css_to_xpath(step_rules['step_item_content_xpath'])
    children_xpath = css_to_xpath(step_rules['step_item_content_children'])

    if not img_xpath:
        return {'error': '无效的 CSS 选择器: steps.step_item_img_xpath'}
    if not content_xpath:
        return {'error': '无效的 CSS 选择器: steps.step_item_content_xpath'}
    if not children_xpath:
        return {'error': '无效的 CSS 选择器: steps.step_item_content_children'}
    
    img_elements = item.xpath(img_xpath)
    content_elements = item.xpath(content_xpath)
    
    if not content_elements:
        return None

    img_url = (img_elements[0].get('data-src') or img_elements[0].get('src')) if img_elements else None
    
    content = []
    # 提取子内容
    children_list = []
    for item_content in content_elements:
        li_elements = item_content.xpath(children_xpath)
        for li_element in li_elements:
            li_content = etree.tostring(li_element, encoding='unicode', method='html').strip()
            li_content = cleaner.clean_html(li_content)
            li_content = apply_filters(li_content, filters)
            children_list.append(li_content)
        
        # 如果没有找到子内容，添加默认信息
        if not li_elements:
            continue

    for content_element in content_elements:
        li_elements = content_element.xpath(children_xpath)
        for li_element in li_elements:
            # 移除内容中的 li 元素
            li_element.getparent().remove(li_element)
    
    content = " ".join([etree.tostring(content_element, encoding='unicode', method='html').strip() for content_element in content_elements])
    content = cleaner.clean_html(content)
    content = apply_filters(content, filters)


    return {
        "img": img_url,
        "content": content,
        "children": children_list
    }



@app.route('/fetch_content', methods=['POST'])
def fetch_content():
    # 获取 JSON 数据
    data = request.get_json()

    # 获取 URL、规则和过滤器
    url = data.get('url')
    rules = data.get('rules', {})
    filters = data.get('filters', [])

    # 验证参数
    required_keys = ['title', 'profile', 'steps']
    steps_required_keys = ['step_xpath', 'step_title_xpath', 'step_item_xpath', 'step_item_img_xpath', 'step_item_content_xpath']
    
    if not url or any(key not in rules for key in required_keys) or any(key not in rules['steps'] for key in steps_required_keys):
        return jsonify({'error': '缺少必要的参数'}), 400

    headers = {'User-Agent': ua}

    # 获取 HTML 内容
    html_content, error = fetch_html(url, headers)
    if error:
        return jsonify({'error': error}), 500

    if html_content:
        # 解析 HTML 内容
        dom = parse_html(html_content)
        
        # 提取数据并应用过滤器
        extracted_data = extract_data(dom, rules, filters)
        
        # 返回结果
        return jsonify(extracted_data), 200
    else:
        return jsonify({'error': '获取 HTML 内容失败。'}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5508)

