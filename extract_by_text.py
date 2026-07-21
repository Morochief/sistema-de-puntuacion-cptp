import os, sys, re

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
with open(app_path, 'r', encoding='utf-8') as f:
    app_code = f.read()
lines = app_code.split('\n')

def get_block(start_str, end_str):
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if start_str in line and start_idx == -1:
            start_idx = i
        if end_str in line and start_idx != -1 and i > start_idx:
            end_idx = i
            break
    if start_idx == -1 or end_idx == -1:
        return -1, -1
    return start_idx, end_idx

# modals
s, e = get_block("function esc(", "return String(s)")
s, e = s, e + 6 # 6 lines after return
esc_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("type ToastKind =", "info';")
toastkind_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("function showToast(", "}, ms);")
s, e = s, e + 1
toast_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("export function showConfirm(", "backdrop.querySelector('#modal-confirm-btn')")
s, e = s, e + 2
confirm_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("export function showPrompt(", "closeWithResult(null);")
s, e = s, e + 4
prompt_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

modals = [
    'export ' + esc_code,
    'export ' + toastkind_code,
    'export ' + toast_code,
    confirm_code,
    prompt_code
]
with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\modals.ts', 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(modals) + '\n')

# router
s, e = get_block("function navigate(", "window.location.hash = hash;")
s, e = s, e + 1
nav_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("function getRoute(", "return { view, params };")
s, e = s, e + 1
route_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

s, e = get_block("function showView(", "document.getElementById(viewId)?.classList.add('active');")
s, e = s, e + 1
showview_code = '\n'.join(lines[s:e+1])
del lines[s:e+1]

router = [
    'export ' + nav_code,
    'export ' + route_code,
    'export ' + showview_code
]
with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\router.ts', 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(router) + '\n')

# excel
s, e = get_block("function exportRankingToExcel(", "document.body.removeChild(link);")
s, e = s, e + 1
excel_func = '\n'.join(lines[s:e+1])
del lines[s:e+1]

excel_code = "import type { ShootingEvent, Participant, Series } from './types';\nimport { esc, showToast } from './modals';\n\nexport " + excel_func
with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\excel.ts', 'w', encoding='utf-8') as f:
    f.write(excel_code + '\n')

# seeder generateRealisticSeriesShots
s, e = get_block("function generateRealisticSeriesShots()", "return { shots, totalScore };")
s, e = s, e + 1
gen_func = '\n'.join(lines[s:e+1])
del lines[s:e+1]

# Seeder handlers
# They are now slightly harder because they span many lines. 
# We'll just replace the whole text in pp_code.
app_code = '\n'.join(lines)

seed_p_start = app_code.find('// --- HANDLER: POBLAR tiradores DEMO ---')
seed_p_end = app_code.find(' // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---')
seed_p_code = app_code[seed_p_start:seed_p_end]

seed_s_start = seed_p_end
seed_s_end = app_code.find(' // --- HANDLER: REALIZAR SORTEO ALEATORIO (32 competidores / 4 Tandas) ---')
seed_s_code = app_code[seed_s_start:seed_s_end]


# Transform seed_p
new_p = re.sub(
    r"document\.getElementById\('btn-seed-participants'\)\?\.addEventListener\('click', async \(\) => \{",
    "export async function handleSeedParticipants(id: string, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) {",
    seed_p_code
)
new_p = re.sub(r"\}\);\s*$", "}", new_p)
new_p = re.sub(r"// recargar.*?if \(btnSeedScores\) btnSeedScores\.disabled = false;", "await onComplete();", new_p, flags=re.DOTALL)

# Transform seed_s
new_s = re.sub(
    r"document\.getElementById\('btn-seed-scores'\)\?\.addEventListener\('click', async \(\) => \{",
    "export async function handleSeedScores(id: string, participants: Participant[], onComplete: () => Promise<void>) {",
    seed_s_code
)
new_s = re.sub(r"\}\);\s*$", "}", new_s)
new_s = re.sub(r"// recargar.*?await renderEvent\(String\(id\)\);", "await onComplete();", new_s, flags=re.DOTALL)

seeder_code = "import { db } from './db';\nimport type {{ Participant, Series, Shot }} from './types';\nimport { showToast, showConfirm, showPrompt }} from './modals';\n\n" + new_p + "\n\n" + new_s + "\n\nexport " + gen_func + "\n"

with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\seeder.ts', 'w', encoding='utf-8') as f:
    f.write(seeder_code)

replacement_p = '''// --- HANDLER: POBLAR tiradores DEMO ---
 document.getElementById('btn-seed-participants')?.addEventListener('click', async () => {
  await handleSeedParticipants(id, participants, findFirstFreeSpot, async () => {
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();
   if (btnTiradores) btnTiradores.textContent = Sorteo y Puestos (/32);
   const btnShuffle = document.getElementById('btn-shuffle-sorteo') as HTMLButtonElement | null;
   if (btnShuffle) btnShuffle.disabled = participants.length === 0;
   const btnSeedScores = document.getElementById('btn-seed-scores') as HTMLButtonElement | null;
   if (btnSeedScores) btnSeedScores.disabled = false;
  });
 });
'''

replacement_s = ''' // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---
 document.getElementById('btn-seed-scores')?.addEventListener('click', async () => {
  await handleSeedScores(id, participants, async () => {
   allSeries = await db.series.where('eventId').equals(id).toArray();
   renderListaSeries();
   await renderEvent(String(id));
  });
 });
'''

app_code = app_code.replace(seed_p_code, replacement_p)
app_code = app_code.replace(seed_s_code, replacement_s)

# Add imports
imports = '''import { esc, showToast, showConfirm, showPrompt } from './modals';
import { navigate, getRoute, showView } from './router';
import { exportRankingToExcel } from './excel';
import { handleSeedParticipants, handleSeedScores } from './seeder';
'''

import_idx = app_code.find("import { db } from './db';")
app_code = app_code[:import_idx] + imports + app_code[import_idx:]

with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts', 'w', encoding='utf-8') as f:
    f.write(app_code)

print("Done extract_by_text")
