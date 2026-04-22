import re
import sys

def replace_colors(content):
    # Imports
    if "from 'antd';" in content and "theme," not in content and ", theme" not in content:
        content = content.replace("from 'antd';", ", theme\n} from 'antd';")
    
    # Token insertion
    if "const { token } = theme.useToken();" not in content:
        content = re.sub(r'(const \w+: React\.FC.*?\n)', r'\1  const { token } = theme.useToken();\n', content)
    
    # Hex to Token mappings
    # Backgrounds
    content = content.replace("'#fff'", "token.colorBgContainer")
    content = content.replace("'#f8f9fa'", "token.colorBgLayout")
    content = content.replace("'#f9f9f9'", "token.colorBgLayout")
    content = content.replace("'#fafafa'", "token.colorBgLayout")
    content = content.replace("'#f5f5f5'", "token.colorBgLayout")
    content = content.replace("'#fff7f6'", "token.colorPrimaryBg")
    
    # Borders
    content = content.replace("'#eee'", "token.colorBorderSecondary")
    content = content.replace("'#f0f0f0'", "token.colorBorderSecondary")
    content = content.replace("'#d9d9d9'", "token.colorBorder")
    content = content.replace("'#ddd'", "token.colorBorder")
    content = content.replace("'#c4c4c4'", "token.colorBorder")
    
    # Text
    content = content.replace("'#868e96'", "token.colorTextSecondary")
    content = content.replace("'#adb5bd'", "token.colorTextTertiary")
    content = content.replace("'#ccc'", "token.colorTextTertiary")
    content = content.replace("'#dee2e6'", "token.colorBorder")
    
    # Primary
    content = content.replace("'#F87C63'", "token.colorPrimary")
    
    # Props with double quotes
    content = content.replace('color="#ccc"', 'color={token.colorTextTertiary}')
    content = content.replace('color="#adb5bd"', 'color={token.colorTextTertiary}')
    content = content.replace('color="#dee2e6"', 'color={token.colorBorder}')
    content = content.replace('color="#F87C63"', 'color={token.colorPrimary}')
    
    # Complex strings like border: '1px solid #f0f0f0'
    content = re.sub(r"'(\d+px (?:solid|dashed) )#[a-fA-F0-9]+'", r"`\1${token.colorBorderSecondary}`", content)
    
    return content

files = [
    'frontend/src/pages/MyBoard.tsx',
    'frontend/src/pages/SarTable.tsx',
    'frontend/src/pages/SynthesisBoard.tsx'
]

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = replace_colors(content)
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
print("Color replacement complete.")
