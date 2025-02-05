import os
import json
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from lxml import etree, html
from lxml_html_clean import Cleaner
import requests

app = Flask(__name__)
CORS(app)

# 配置
DATA_DIR = 'data'
CONFIG_FILE = 'config.json'

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

        # 保存数据
        ensure_data_dir()
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(DATA_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(article_data, f, indent=4, ensure_ascii=False)

        return jsonify({'success': True, 'filename': filename})

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

if __name__ == '__main__':
    # 确保必要的目录存在
    ensure_data_dir()
    
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

