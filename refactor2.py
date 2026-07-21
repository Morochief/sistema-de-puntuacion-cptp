import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

# 2. ROUTER
router_code = ""

nav_pattern = r'function navigate\(.*?\n\}\n'
nav_match = re.search(nav_pattern, app_code, re.DOTALL)
app_code = app_code.replace(nav_match.group(0), '')
router_code += 'export ' + nav_match.group(0) + '\n\n'

getroute_pattern = r'function getRoute\(.*?\n\}\n'
getroute_match = re.search(getroute_pattern, app_code, re.DOTALL)
app_code = app_code.replace(getroute_match.group(0), '')
router_code += 'export ' + getroute_match.group(0) + '\n\n'

showview_pattern = r'function showView\(.*?\n\}\n'
showview_match = re.search(showview_pattern, app_code, re.DOTALL)
app_code = app_code.replace(showview_match.group(0), '')
router_code += 'export ' + showview_match.group(0) + '\n\n'

write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\router.ts', router_code)

print('Router extracted')
