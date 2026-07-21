import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

def extract_function(name, is_export=False):
    prefix = 'export function ' if is_export else 'function '
    start = app_code.find(prefix + name + '(')
    if start == -1: return None, app_code
    
    braces = 0
    in_str = False
    str_char = ''
    i = start
    while i < len(app_code):
        c = app_code[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == str_char:
                in_str = False
        else:
            if c in ('\"', '\'', ''):
                in_str = True
                str_char = c
            elif c == '{':
                braces += 1
            elif c == '}':
                braces -= 1
                if braces == 0:
                    return app_code[start:i+1], app_code[:start] + app_code[i+1:]
        i += 1
    return None, app_code

def extract_type(name):
    start = app_code.find('type ' + name + ' =')
    if start == -1: return None, app_code
    end = app_code.find(';', start)
    return app_code[start:end+1], app_code[:start] + app_code[end+1:]



# MODALS
esc_code, app_code = extract_function('esc')
toastkind_code, app_code = extract_type('ToastKind')
toast_code, app_code = extract_function('showToast')
confirm_code, app_code = extract_function('showConfirm', True)
prompt_code, app_code = extract_function('showPrompt', True)

modals_code = f"export {esc_code}\n\nexport {toastkind_code}\n\nexport {toast_code}\n\n{confirm_code}\n\n{prompt_code}\n"
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\modals.ts', modals_code)

# ROUTER
nav_code, app_code = extract_function('navigate')
getroute_code, app_code = extract_function('getRoute')
showview_code, app_code = extract_function('showView')
router_code = f"export {nav_code}\n\nexport {getroute_code}\n\nexport {showview_code}\n"
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\router.ts', router_code)

# EXCEL
excel_code_fn, app_code = extract_function('exportRankingToExcel')
excel_file_code = f"import type {{ ShootingEvent, Participant, Series }} from './types';\nimport {{ esc, showToast }} from './modals';\n\nexport {excel_code_fn}\n"
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\excel.ts', excel_file_code)

# SEEDER
seeder_code_fn, app_code = extract_function('generateRealisticSeriesShots')
seeder_file_code = f"import type {{ Shot }} from './types';\n\nexport {seeder_code_fn}\n"
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\seeder.ts', seeder_file_code)

# Add imports to top of app.ts
imports = '''import { esc, showToast, showConfirm, showPrompt } from './modals';
import { navigate, getRoute, showView } from './router';
import { exportRankingToExcel } from './excel';
import { generateRealisticSeriesShots } from './seeder';
'''
# find first import
import_idx = app_code.find('import { db } from')
app_code = app_code[:import_idx] + imports + app_code[import_idx:]

write_file(app_path, app_code)
print('Done!')
