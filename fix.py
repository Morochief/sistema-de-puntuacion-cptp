app_path = 'g:\\.22 LR\\cptp-scoring\\src\\lib\\app.ts'
with open(app_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
lines[825] = '   if (btnTiradores) btnTiradores.textContent = `Sorteo y Puestos (${participants.length}/32)`;\n'
with open(app_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
