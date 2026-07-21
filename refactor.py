import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

# 1. MODALS
modals_code = '''import { esc } from './app'; // wait, esc in app? let's move esc to modals and export it
'''

# Let's extract esc, ToastKind, showToast, showConfirm, showPrompt
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

print('Modals extracted')
