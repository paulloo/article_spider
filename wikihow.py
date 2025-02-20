import os
import json
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from lxml import etree, html
from lxml_html_clean import Cleaner
import requests
import re
from werkzeug.utils import secure_filename
import imghdr
from pybars import Compiler
import subprocess
import tempfile

app = Flask(__name__)
CORS(app)

# 配置
DATA_DIR = 'data'
CONFIG_FILE = 'config.json'
TEMPLATES_DIR = 'templates'
HANDLEBARS_TEMPLATES_DIR = 'handlebars_templates'
HANDLEBARS_TEMPLATE_EXT = '.hbs'  # 添加文件扩展名常量

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
UPLOAD_FOLDER = 'static/preview_images'

def ensure_data_dir():
    """确保数据目录存在"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Created data directory: {DATA_DIR}")

def load_config():
    """加载配置文件"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading config: {e}")
        return {}

def save_config(config):
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving config: {e}")

def ensure_templates_dir():
    """确保模板目录存在"""
    if not os.path.exists(TEMPLATES_DIR):
        os.makedirs(TEMPLATES_DIR)
        print(f"Created templates directory: {TEMPLATES_DIR}")

def ensure_handlebars_templates_dir():
    """确保 Handlebars 模板目录存在"""
    if not os.path.exists(HANDLEBARS_TEMPLATES_DIR):
        os.makedirs(HANDLEBARS_TEMPLATES_DIR)
        print(f"Created Handlebars templates directory: {HANDLEBARS_TEMPLATES_DIR}")

class WikiHowScraper:
    def __init__(self):
        self.cleaner = Cleaner(
            style=True,
            links=True,
            add_nofollow=True,
            page_structure=False,
            safe_attrs_only=False
        )
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def fetch_article(self, url):
        """获取文章内容"""
        try:
            response = requests.get(url, headers=self.headers)
        response.raise_for_status()
            return response.text
    except requests.RequestException as e:
            print(f"Error fetching article: {e}")
            return None

    def parse_article(self, html_content, config):
        """解析文章内容"""
        if not html_content:
            return None

        try:
            doc = html.fromstring(html_content)
            
            # 清理HTML
            doc = self.cleaner.clean_html(doc)

            # 提取内容
            data = {
                'title': self._get_text(doc, config['title_xpath']),
                'profile': self._get_text(doc, config['profile_xpath']),
                'steps': self._get_steps(doc, config),
                'timestamp': datetime.now().isoformat()
            }
            return data
        except Exception as e:
            print(f"Error parsing article: {e}")
            return None

    def _get_text(self, doc, xpath):
        """获取文本内容"""
        try:
            elements = doc.xpath(xpath)
            return elements[0].text_content().strip() if elements else ''
        except Exception:
            return ''

    def _get_steps(self, doc, config):
        """获取步骤内容"""
    steps = []
        try:
            step_elements = doc.xpath(config['step_xpath'])
    for step in step_elements:
                step_data = {
                    'title': self._get_text(step, config['step_title_xpath']),
                    'items': []
                }
                
                items = step.xpath(config['step_item_xpath'])
                for item in items:
                    item_data = {
                        'content': self._get_text(item, config['step_item_content_xpath']),
                        'image': self._get_image(item, config['step_item_img_xpath'])
                    }
                    step_data['items'].append(item_data)
                
                steps.append(step_data)
        except Exception as e:
            print(f"Error getting steps: {e}")
        return steps

    def _get_image(self, element, xpath):
        """获取图片URL"""
        try:
            img = element.xpath(xpath)
            return img[0].get('src') if img else ''
        except Exception:
            return ''

def sanitize_filename(title):
    """
    清理文件名，去除特殊字符
    :param title: 原始标题
    :return: 处理后的文件名
    """
    # 如果标题为空，使用时间戳
    if not title or not title.strip():
        return datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # 1. 转换为小写
    filename = title.lower()
    
    # 2. 替换中文标点符号为下划线
    chinese_punc = '，。！？【】（）《》""''：；、'
    for char in chinese_punc:
        filename = filename.replace(char, '_')
    
    # 3. 替换空格和其他特殊字符为下划线
    filename = re.sub(r'[^\w\s-]', '_', filename)
    
    # 4. 将连续的下划线替换为单个下划线
    filename = re.sub(r'[-_\s]+', '_', filename)
    
    # 5. 去除首尾的下划线
    filename = filename.strip('_')
    
    # 6. 限制文件名长度（如果太长）
    max_length = 100
    if len(filename) > max_length:
        filename = filename[:max_length]
    
    # 7. 添加时间戳后缀以确保唯一性
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{filename}_{timestamp}"
    
    return filename

# Flask路由
@app.route('/scrape', methods=['POST'])
def scrape_article():
    """抓取文章接口"""
    try:
        data = request.get_json()
        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        config = load_config()
        scraper = WikiHowScraper()
        
        html_content = scraper.fetch_article(url)
        if not html_content:
            return jsonify({'error': 'Failed to fetch article'}), 500

        article_data = scraper.parse_article(html_content, config)
        if not article_data:
            return jsonify({'error': 'Failed to parse article'}), 500

        # 使用文章标题生成文件名
        filename = sanitize_filename(article_data['title']) + '.json'
        
        # 保存数据
        ensure_data_dir()
        filepath = os.path.join(DATA_DIR, filename)
        
        # 如果文件已存在，添加序号
        base_filename = filename[:-5]  # 移除 .json
        counter = 1
        while os.path.exists(filepath):
            filename = f"{base_filename}_{counter}.json"
            filepath = os.path.join(DATA_DIR, filename)
            counter += 1
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(article_data, f, indent=4, ensure_ascii=False)

        return jsonify({
            'success': True, 
            'filename': filename,
            'title': article_data['title']
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_data_list', methods=['GET'])
def get_data_list():
    """获取数据列表接口"""
    try:
        ensure_data_dir()
        files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]
        files.sort(reverse=True)
        
        result = []
        for filename in files:
            filepath = os.path.join(DATA_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    result.append({
                        'filename': filename,
                        'title': data.get('title', ''),
                        'timestamp': data.get('timestamp', '')
                    })
            except Exception as e:
                print(f"Error reading file {filename}: {e}")
            continue

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_data/<filename>', methods=['GET'])
def get_data(filename):
    """获取特定数据接口"""
    try:
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404

        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates', methods=['GET'])
def get_templates_list():
    """获取模板列表"""
    try:
        ensure_templates_dir()
        files = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.json')]
        files.sort()
        
        result = []
        for filename in files:
            filepath = os.path.join(TEMPLATES_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    template = json.load(f)
                    result.append({
                        'filename': filename,
                        'name': template.get('name', ''),
                        'description': template.get('description', ''),
                        'preview_image': template.get('preview_image', ''),
                        'created_at': template.get('created_at', ''),
                        'updated_at': template.get('updated_at', '')
                    })
            except Exception as e:
                print(f"Error reading template {filename}: {e}")
                continue
                
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates/<filename>', methods=['GET'])
def get_template(filename):
    """获取特定模板"""
    try:
        filepath = os.path.join(TEMPLATES_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'Template not found'}), 404

        with open(filepath, 'r', encoding='utf-8') as f:
            template = json.load(f)
        return jsonify(template)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates', methods=['POST'])
def create_template():
    """创建新模板"""
    try:
        template_data = request.get_json()
        
        # 验证必要字段
        required_fields = ['name', 'xpath_rules', 'template_content']
        for field in required_fields:
            if field not in template_data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # 添加创建时间和预览图片默认值
        template_data['created_at'] = datetime.now().isoformat()
        if 'preview_image' not in template_data:
            template_data['preview_image'] = "https://cdn.ddp.life/default_template_preview.png"
        
        # 生成文件名
        filename = sanitize_filename(template_data['name']) + '.json'
        filepath = os.path.join(TEMPLATES_DIR, filename)
        
        # 检查是否存在同名文件
        if os.path.exists(filepath):
            return jsonify({'error': 'Template with this name already exists'}), 409
        
        # 保存模板
        ensure_templates_dir()
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, indent=4, ensure_ascii=False)
            
        return jsonify({
            'success': True,
            'filename': filename,
            'message': 'Template created successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates/<filename>', methods=['PUT'])
def update_template(filename):
    """更新模板"""
    try:
        filepath = os.path.join(TEMPLATES_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'Template not found'}), 404
            
        template_data = request.get_json()
        
        # 验证必要字段
        required_fields = ['name', 'xpath_rules', 'template_content']
        for field in required_fields:
            if field not in template_data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # 保留创建时间，更新修改时间
        with open(filepath, 'r', encoding='utf-8') as f:
            old_template = json.load(f)
            template_data['created_at'] = old_template.get('created_at')
            template_data['updated_at'] = datetime.now().isoformat()
            
            # 保留预览图片（如果新数据没有提供）
            if 'preview_image' not in template_data:
                template_data['preview_image'] = old_template.get('preview_image')
        
        # 保存更新后的模板
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, indent=4, ensure_ascii=False)
            
        return jsonify({
            'success': True,
            'message': 'Template updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates/<filename>', methods=['DELETE'])
def delete_template(filename):
    """删除模板"""
    try:
        filepath = os.path.join(TEMPLATES_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'Template not found'}), 404
            
        os.remove(filepath)
        return jsonify({
            'success': True,
            'message': 'Template deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/templates/upload_preview', methods=['POST'])
def upload_preview_image():
    """上传模板预览图片"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            new_filename = f"preview_{timestamp}_{filename}"
            
            # 确保上传目录存在
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            
            filepath = os.path.join(UPLOAD_FOLDER, new_filename)
            file.save(filepath)
            
            # 返回图片URL
            image_url = f"/static/preview_images/{new_filename}"
            return jsonify({
                'success': True,
                'image_url': image_url
            })
            
        return jsonify({'error': 'Invalid file type'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/save_data', methods=['POST'])
def save_data():
    """保存数据到文件"""
    try:
    data = request.get_json()

        # 验证数据
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # 验证必要字段
        required_fields = ['title', 'profile', 'steps']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # 添加时间戳
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now().isoformat()
        
        # 生成文件名
        filename = sanitize_filename(data['title']) + '.json'
        
        # 保存数据
        ensure_data_dir()
        filepath = os.path.join(DATA_DIR, filename)
        
        # 如果文件已存在，添加序号
        base_filename = filename[:-5]  # 移除 .json
        counter = 1
        while os.path.exists(filepath):
            filename = f"{base_filename}_{counter}.json"
            filepath = os.path.join(DATA_DIR, filename)
            counter += 1
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': filepath,
            'message': 'Data saved successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/handlebars_templates', methods=['GET'])
def get_handlebars_templates_list():
    """获取 Handlebars 模板列表"""
    try:
        ensure_handlebars_templates_dir()
        files = [f for f in os.listdir(HANDLEBARS_TEMPLATES_DIR) if f.endswith(HANDLEBARS_TEMPLATE_EXT)]
        files.sort()
        
        result = []
        for filename in files:
            filepath = os.path.join(HANDLEBARS_TEMPLATES_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    template = f.read()
                    result.append({
                        'filename': filename[:-len(HANDLEBARS_TEMPLATE_EXT)],
                        'template_content': template
                    })
            except Exception as e:
                print(f"Error reading Handlebars template {filename}: {e}")
                continue
                
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_template_json_path(filename):
    """获取模板的 JSON 配置文件路径"""
    return os.path.join(HANDLEBARS_TEMPLATES_DIR, f"{filename}.json")

def get_template_hbs_path(filename):
    """获取模板的 HBS 文件路径"""
    return os.path.join(HANDLEBARS_TEMPLATES_DIR, f"{filename}{HANDLEBARS_TEMPLATE_EXT}")

@app.route('/handlebars_templates/<filename>', methods=['GET'])
def get_handlebars_template(filename):
    """获取特定 Handlebars 模板"""
    try:
        # 移除文件名中可能包含的扩展名
        base_filename = filename.rsplit('.', 1)[0] if '.' in filename else filename
        hbs_path = get_template_hbs_path(base_filename)
        
        print(f"Looking for file: {hbs_path}")  # 添加调试日志
        
        if not os.path.exists(hbs_path):
            print(f"HBS file not found: {hbs_path}")  # 添加调试日志
            return jsonify({'error': 'Template not found'}), 404

        # 读取模板内容
        with open(hbs_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
            
        # 返回数据
        template_data = {
            'filename': base_filename,
            'template_content': template_content
        }
        
        return jsonify(template_data)
    except Exception as e:
        print(f"Error loading template: {str(e)}")  # 添加调试日志
        return jsonify({'error': str(e)}), 500

@app.route('/handlebars_templates', methods=['POST'])
def create_handlebars_template():
    """创建新的 Handlebars 模板"""
    try:
        template_data = request.get_json()
        
        # 验证必要字段
        if 'template_content' not in template_data or 'name' not in template_data:
            return jsonify({'error': 'Missing required fields: template_content and name'}), 400
        
        # 生成基础文件名（不包含扩展名）
        base_filename = sanitize_filename(template_data['name'])
        hbs_path = get_template_hbs_path(base_filename)
        
        # 检查是否存在同名文件
        if os.path.exists(hbs_path):
            return jsonify({'error': 'Template with this name already exists'}), 409
        
        # 保存模板内容到 .hbs 文件
        ensure_handlebars_templates_dir()
        with open(hbs_path, 'w', encoding='utf-8') as f:
            f.write(template_data['template_content'])
            
        return jsonify({
            'success': True,
            'filename': base_filename,
            'message': 'Handlebars template created successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/handlebars_templates/<filename>', methods=['PUT'])
def update_handlebars_template(filename):
    """更新 Handlebars 模板"""
    try:
        # 移除文件名中可能包含的扩展名
        base_filename = filename.rsplit('.', 1)[0] if '.' in filename else filename
        hbs_path = get_template_hbs_path(base_filename)
        
        if not os.path.exists(hbs_path):
            return jsonify({'error': 'Template not found'}), 404
            
        template_data = request.get_json()
        
        # 验证必要字段
        if 'template_content' not in template_data:
            return jsonify({'error': 'Missing required field: template_content'}), 400
        
        # 保存更新后的模板内容
        with open(hbs_path, 'w', encoding='utf-8') as f:
            f.write(template_data['template_content'])
            
        return jsonify({
            'success': True,
            'message': 'Handlebars template updated successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/handlebars_templates/<filename>', methods=['DELETE'])
def delete_handlebars_template(filename):
    """删除 Handlebars 模板"""
    try:
        # 移除文件名中可能包含的扩展名
        base_filename = filename.rsplit('.', 1)[0] if '.' in filename else filename
        hbs_path = get_template_hbs_path(base_filename)
        
        # 删除文件
        if os.path.exists(hbs_path):
            os.remove(hbs_path)
            
        return jsonify({
            'success': True,
            'message': 'Handlebars template deleted successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/handlebars_templates/<filename>/precompiled', methods=['GET'])
def get_precompiled_template(filename):
    """获取预编译的 Handlebars 模板"""
    try:
        # 移除文件名中可能包含的扩展名
        base_filename = filename.rsplit('.', 1)[0] if '.' in filename else filename
        hbs_path = get_template_hbs_path(base_filename)
        
        if not os.path.exists(hbs_path):
            return jsonify({'error': 'Template not found'}), 404

        # 读取模板内容
        with open(hbs_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
            
        # 调用预编译服务
        response = requests.post('http://localhost:3000/precompile', json={
            'template': template_content
        })
        response.raise_for_status()
        
        precompiled = response.json()['precompiled']
            
        return jsonify({
            'filename': base_filename,
            'precompiled': precompiled
        })
    except requests.RequestException as e:
        print(f"Error calling precompile service: {str(e)}")
        return jsonify({'error': 'Precompilation service failed'}), 500
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 确保必要的目录存在
    ensure_data_dir()
    ensure_templates_dir()
    ensure_handlebars_templates_dir()
    
    # 加载配置
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            "url": "https://xxxx",
            "title_xpath": "//div[@class='headline_info']/h3/span[@class='mw-headline']",
            "profile_xpath": "//div[@class='mf-section-0']/p",
            "step_xpath": "//div[@id='mf-section-1']/div",
            "step_title_xpath": ".//div[@class='headline_info']/h3/span[@class='mw-headline']",
            "step_item_xpath": ".//li",
            "step_item_img_xpath": ".//div[@class='content-spacer']/img",
            "step_item_content_xpath": ".//div[@class='step']"
        }
        save_config(default_config)
    
    app.run(debug=True, port=5508)

