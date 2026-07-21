import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

# Extract Seeder handlers
seed_p_start_marker = "// --- HANDLER: POBLAR tiradores DEMO ---"
seed_p_end_marker = " // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---"
p_idx_start = app_code.find(seed_p_start_marker)
p_idx_end = app_code.find(seed_p_end_marker)

seed_p_code = app_code[p_idx_start:p_idx_end]

s_idx_start = app_code.find(seed_p_end_marker)
s_idx_end = app_code.find(" // --- HANDLER: REALIZAR SORTEO ALEATORIO (32 competidores / 4 Tandas) ---")

seed_s_code = app_code[s_idx_start:s_idx_end]

# Transform seed_p_code
# from:
# document.getElementById('btn-seed-participants')?.addEventListener('click', async () => { ... });
# to:
# export async function handleSeedParticipants(id: string, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) { ... }

def transform_p(code):
    lines = code.split('\n')
    lines[1] = "export async function handleSeedParticipants(id: string, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) {"
    lines = lines[:-2] # remove '});'
    
    # replace render and state updates with onComplete()
    # Find the section with:
    # participants = await db.participants.where('eventId').equals(id).toArray();
    # ...
    # if (btnSeedScores) btnSeedScores.disabled = false;
    code_str = '\n'.join(lines)
    
    replace_from = """   // recargar
   participants = await db.participants.where('eventId').equals(id).toArray();
   participants.sort((a, b) => a.competitorNumber - b.competitorNumber);
   renderListaInscritos();
   renderCuadroSorteo();
   renderListaSeries();

   // actualizar contador en el tab
   if (btnTiradores) btnTiradores.textContent = Sorteo y Puestos (/32);

   // Actualizar estado del botón de sorteo
   const btnShuffle = document.getElementById('btn-shuffle-sorteo') as HTMLButtonElement | null;
   if (btnShuffle) btnShuffle.disabled = participants.length === 0;

   // Actualizar estado del botón de simulación
   const btnSeedScores = document.getElementById('btn-seed-scores') as HTMLButtonElement | null;
   if (btnSeedScores) btnSeedScores.disabled = false;"""
    code_str = code_str.replace(replace_from, "   await onComplete();")
    
    return code_str + "\n}"

def transform_s(code):
    lines = code.split('\n')
    # lines[1] is document.getElementById
    lines[1] = "export async function handleSeedScores(id: string, participants: Participant[], onComplete: () => Promise<void>) {"
    lines = lines[:-2]
    
    code_str = '\n'.join(lines)
    replace_from = """   // recargar
   allSeries = await db.series.where('eventId').equals(id).toArray();
   renderListaSeries();

   // Forzar re-render de la vista de evento general
   await renderEvent(String(id));"""
    code_str = code_str.replace(replace_from, "   await onComplete();")
    
    return code_str + "\n}"

new_p_code = transform_p(seed_p_code)
new_s_code = transform_s(seed_s_code)

seeder_code = f"import {{ db }} from './db';\nimport type {{ Participant, Series, Shot }} from './types';\nimport {{ showToast, showConfirm, showPrompt }} from './modals';\n\n{new_p_code}\n\n{new_s_code}\n"
# Also need to export generateRealisticSeriesShots if it's inside handleSeedScores, wait, it IS inside. It should be extracted outside.
# Let's extract generateRealisticSeriesShots manually in the seeder code.
gen_start = seeder_code.find("   // Función helper para generar disparos")
gen_end = seeder_code.find("   // Generar 2 series para cada participante")
gen_code = seeder_code[gen_start:gen_end]
seeder_code = seeder_code.replace(gen_code, "")
seeder_code = seeder_code + "\n\nexport " + gen_code.replace("   function ", "function ")

write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\seeder.ts', seeder_code)

# Replace in app.ts
replacement_p = """// --- HANDLER: POBLAR tiradores DEMO ---
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
 });"""

replacement_s = """// --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---
 document.getElementById('btn-seed-scores')?.addEventListener('click', async () => {
  await handleSeedScores(id, participants, async () => {
   allSeries = await db.series.where('eventId').equals(id).toArray();
   renderListaSeries();
   await renderEvent(String(id));
  });
 });"""

app_code = app_code.replace(seed_p_code, replacement_p)
app_code = app_code.replace(seed_s_code, replacement_s)
write_file(app_path, app_code)

print("Seeder extracted!")
