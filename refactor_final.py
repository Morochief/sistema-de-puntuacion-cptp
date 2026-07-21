import os, sys, re

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
with open(app_path, 'r', encoding='utf-8') as f:
    app_code = f.read()

# 1. Modals
esc_match = re.search(r'function esc\(.*?\n\}\n', app_code, re.DOTALL)
toastkind_match = re.search(r'type ToastKind =.*?;', app_code, re.DOTALL)
toast_match = re.search(r'function showToast\(.*?\n\}\n', app_code, re.DOTALL)
confirm_match = re.search(r'export function showConfirm\(.*?\n\}\n', app_code, re.DOTALL)
prompt_match = re.search(r'export function showPrompt\(.*?\n\}\n', app_code, re.DOTALL)

modals = [
    'export ' + esc_match.group(0),
    'export ' + toastkind_match.group(0),
    'export ' + toast_match.group(0),
    confirm_match.group(0),
    prompt_match.group(0)
]

for m in [esc_match, toastkind_match, toast_match, confirm_match, prompt_match]:
    app_code = app_code.replace(m.group(0), '')

with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\modals.ts', 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(modals) + '\n')


# 2. Router
nav_match = re.search(r'function navigate\(.*?\n\}\n', app_code, re.DOTALL)
getroute_match = re.search(r'function getRoute\(.*?\n\}\n', app_code, re.DOTALL)
showview_match = re.search(r'function showView\(.*?\n\}\n', app_code, re.DOTALL)

router = [
    'export ' + nav_match.group(0),
    'export ' + getroute_match.group(0),
    'export ' + showview_match.group(0)
]

for m in [nav_match, getroute_match, showview_match]:
    app_code = app_code.replace(m.group(0), '')

with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\router.ts', 'w', encoding='utf-8') as f:
    f.write('\n\n'.join(router) + '\n')

# 3. Excel
excel_match = re.search(r'function exportRankingToExcel\(.*?  \}\n', app_code, re.DOTALL)
excel_code = "import type { ShootingEvent, Participant, Series } from './types';\nimport { esc, showToast } from './modals';\n\nexport " + excel_match.group(0)

app_code = app_code.replace(excel_match.group(0), '')

with open('g:\\.22 LR\\cptp-scoring\\src\\lib\\excel.ts', 'w', encoding='utf-8') as f:
    f.write(excel_code + '\n')

# 4. Seeder
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

# Extract generateRealisticSeriesShots from seed_s
gen_start = new_s.find("   // Funci")
gen_end = new_s.find("   // Generar 2 series para cada participante")
gen_code = new_s[gen_start:gen_end]
new_s = new_s.replace(gen_code, "")
gen_code = gen_code.replace("   function ", "export function ")

seeder_code = f"import {{ db }} from './db';\nimport type {{ Participant, Series, Shot }} from './types';\nimport {{ showToast, showConfirm, showPrompt }} from './modals';\n\n{new_p}\n\n{new_s}\n\n{gen_code}\n"

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

print("All done!")
