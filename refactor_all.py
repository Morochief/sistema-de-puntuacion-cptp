import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

# MODALS
esc_pattern = r'function esc\(.*?\}\n'
esc_match = re.search(esc_pattern, app_code, re.DOTALL)
app_code = app_code.replace(esc_match.group(0), '')
modals_code = 'export ' + esc_match.group(0) + '\n'

toast_kind_pattern = r'type ToastKind =.*?;'
toast_kind_match = re.search(toast_kind_pattern, app_code, re.DOTALL)
app_code = app_code.replace(toast_kind_match.group(0), '')
modals_code += 'export ' + toast_kind_match.group(0) + '\n\n'

show_toast_pattern = r'function showToast\(.*?\}\n'
show_toast_match = re.search(show_toast_pattern, app_code, re.DOTALL)
app_code = app_code.replace(show_toast_match.group(0), '')
modals_code += 'export ' + show_toast_match.group(0) + '\n\n'

show_confirm_pattern = r'export function showConfirm\(.*?\n\}\n'
show_confirm_match = re.search(show_confirm_pattern, app_code, re.DOTALL)
app_code = app_code.replace(show_confirm_match.group(0), '')
modals_code += show_confirm_match.group(0) + '\n\n'

show_prompt_pattern = r'export function showPrompt\(.*?\n\}\n'
show_prompt_match = re.search(show_prompt_pattern, app_code, re.DOTALL)
app_code = app_code.replace(show_prompt_match.group(0), '')
modals_code += show_prompt_match.group(0) + '\n\n'

write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\modals.ts', modals_code)


# ROUTER
nav_pattern = r'function navigate\(.*?\n\}\n'
nav_match = re.search(nav_pattern, app_code, re.DOTALL)
app_code = app_code.replace(nav_match.group(0), '')
router_code = 'export ' + nav_match.group(0) + '\n\n'

getroute_pattern = r'function getRoute\(.*?\n\}\n'
getroute_match = re.search(getroute_pattern, app_code, re.DOTALL)
app_code = app_code.replace(getroute_match.group(0), '')
router_code += 'export ' + getroute_match.group(0) + '\n\n'

showview_pattern = r'function showView\(.*?\n\}\n'
showview_match = re.search(showview_pattern, app_code, re.DOTALL)
app_code = app_code.replace(showview_match.group(0), '')
router_code += 'export ' + showview_match.group(0) + '\n\n'

write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\router.ts', router_code)

# EXCEL
excel_pattern = r'function exportRankingToExcel\(.*?\n  \}\n'
excel_match = re.search(excel_pattern, app_code, re.DOTALL)
app_code = app_code.replace(excel_match.group(0), '')

excel_code = '''import type { ShootingEvent, Participant, Series } from './types';
import { esc, showToast } from './modals';

export ''' + excel_match.group(0) + '\n'
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\excel.ts', excel_code)

# SEEDER
# The seeder part is tricky because it has event listeners.
# Actually I'll do seeder manually.
write_file(app_path, app_code)
print('Done automatic extract')
