import os, sys, re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
app_code = read_file(app_path)

seed_p_start_marker = "// --- HANDLER: POBLAR tiradores DEMO ---"
seed_p_end_marker = " // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---"
p_idx_start = app_code.find(seed_p_start_marker)
p_idx_end = app_code.find(seed_p_end_marker)

seed_p_code = app_code[p_idx_start:p_idx_end]

s_idx_start = app_code.find(seed_p_end_marker)
s_idx_end = app_code.find(" // --- HANDLER: REALIZAR SORTEO ALEATORIO (32 competidores / 4 Tandas) ---")

seed_s_code = app_code[s_idx_start:s_idx_end]

new_p_code = re.sub(
    r"document\.getElementById\('btn-seed-participants'\)\?\.addEventListener\('click', async \(\) => \{",
    "export async function handleSeedParticipants(id: string, participants: Participant[], findFirstFreeSpot: (pts: Participant[]) => any, onComplete: () => Promise<void>) {",
    seed_p_code
)
new_p_code = re.sub(r"\}\);\s*$", "}", new_p_code)

# Replace the recargar block
recargar_pattern = r"// recargar.*?if \(btnSeedScores\) btnSeedScores\.disabled = false;"
new_p_code = re.sub(recargar_pattern, "await onComplete();", new_p_code, flags=re.DOTALL)


new_s_code = re.sub(
    r"document\.getElementById\('btn-seed-scores'\)\?\.addEventListener\('click', async \(\) => \{",
    "export async function handleSeedScores(id: string, participants: Participant[], onComplete: () => Promise<void>) {",
    seed_s_code
)
new_s_code = re.sub(r"\}\);\s*$", "}", new_s_code)

recargar_pattern_s = r"// recargar.*?await renderEvent\(String\(id\)\);"
new_s_code = re.sub(recargar_pattern_s, "await onComplete();", new_s_code, flags=re.DOTALL)


gen_start = new_s_code.find("   // Funci")
gen_end = new_s_code.find("   // Generar 2 series para cada participante")
if gen_start != -1 and gen_end != -1:
    gen_code = new_s_code[gen_start:gen_end]
    new_s_code = new_s_code.replace(gen_code, "")
    gen_code = gen_code.replace("   function ", "export function ")
else:
    gen_code = ""

seeder_code = f"import {{ db }} from './db';\nimport type {{ Participant, Series, Shot }} from './types';\nimport {{ showToast, showConfirm, showPrompt }} from './modals';\n\n{new_p_code}\n\n{new_s_code}\n\n{gen_code}\n"
write_file('g:\\.22 LR\\cptp-scoring\\src\\lib\\seeder.ts', seeder_code)


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
 });\n"""

replacement_s = """ // --- HANDLER: SIMULAR RESULTADOS (SERIES Y PUNTUACIONES DEMO) ---
 document.getElementById('btn-seed-scores')?.addEventListener('click', async () => {
  await handleSeedScores(id, participants, async () => {
   allSeries = await db.series.where('eventId').equals(id).toArray();
   renderListaSeries();
   await renderEvent(String(id));
  });
 });\n"""

app_code = app_code.replace(seed_p_code, replacement_p)
app_code = app_code.replace(seed_s_code, replacement_s)
write_file(app_path, app_code)

print("Seeder extracted regex!")
