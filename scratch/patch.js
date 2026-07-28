const fs = require('fs');

let content = fs.readFileSync('src/lib/print.ts', 'utf8');

if (!content.includes('getModalityConfig')) {
    content = content.replace("import { esc } from './modals';", "import { esc } from './modals';\nimport { getModalityConfig } from './modalityConfig';");
}

const mod_inj = `  const mConfig = getModalityConfig(event.modality || '.22 LR');
  const isCF = event.modality === '.308' || event.modality === '.223';
`;
if (!content.includes('const isCF =')) {
    content = content.replace("  const shots = series?.shots ?? [];", mod_inj + "  const shots = series?.shots ?? [];");
}

const parse_logic = `
  // .22 LR
  const hit15  = shots.find((s) => s.targetType === '15"' && s.hit);
  const hit10  = shots.find((s) => s.targetType === '10"' && s.hit);
  const hit5  = shots.find((s) => s.targetType === '5"' && s.hit);
  const addShots = shots.filter((s) => s.targetType === 'additional');

  const miss15 = new Set(shots.filter((s) => s.targetType === '15"' && !s.hit).map((s) => s.shotNumber));
  const miss10 = new Set(shots.filter((s) => s.targetType === '10"' && !s.hit).map((s) => s.shotNumber));
  const miss5 = new Set(shots.filter((s) => s.targetType === '5"' && !s.hit).map((s) => s.shotNumber));

  const pts15  = hit15?.value ?? 0;
  const pts10  = hit10?.value ?? 0;
  const pts5  = hit5?.value ?? 0;
  const addPts = addShots.reduce((s, sh) => s + sh.value, 0);
  const mainPts = pts15 + pts10 + pts5;
  const totalLR  = series ? (mainPts + addPts) : 0;

  // CF
  const hitGrande  = shots.find((s) => s.targetType === 'grande' && s.hit);
  const hitMediano = shots.find((s) => s.targetType === 'mediano' && s.hit);
  const hitPequeno = shots.find((s) => s.targetType === 'pequeno' && s.hit);

  const missGrande = new Set(shots.filter((s) => s.targetType === 'grande' && !s.hit).map((s) => s.shotNumber));
  const missMediano = new Set(shots.filter((s) => s.targetType === 'mediano' && !s.hit).map((s) => s.shotNumber));
  const missPequeno = new Set(shots.filter((s) => s.targetType === 'pequeno' && !s.hit).map((s) => s.shotNumber));

  const ptsGrande  = hitGrande?.value ?? 0;
  const ptsMediano = hitMediano?.value ?? 0;
  const ptsPequeno = hitPequeno?.value ?? 0;
  const mainPtsCF = ptsGrande + ptsMediano + ptsPequeno;
  const totalCF = series ? (mainPtsCF + addPts) : 0;

  const total = isCF ? totalCF : totalLR;
  const maxScore = isCF ? (series?.bonusActive ? 96 : 87) : 67;

  const vals15 = SCORING_TABLES['15"'];
  const vals10 = SCORING_TABLES['10"'];
  const vals5 = SCORING_TABLES['5"'];

  const valsGrande = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const valsMediano = [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4];
  const valsPequeno = [42, 38, 34, 30, 26, 22, 18, 14, 11, 7];
`;
content = content.replace(/  const hit15[\s\S]*?const vals5 = SCORING_TABLES\[\'5"\'\];/, parse_logic.trim());

const table_lr = `
      <colgroup>
       <col class="th-label">
       ${Array.from({ length: 10 }, () => '<col>').join('')}
       <col class="th-pts">
       <col class="th-add">
      </colgroup>
      <thead>
       <tr>
        <th class="th-label">Disparos</th>
        ${Array.from({ length: 10 }, (_, i) => `<th>${i + 1}</th>`).join('')}
        <th class="th-pts">Ptos</th>
        <th class="th-add">Adic</th>
       </tr>
      </thead>
      <tbody>

       <!-- ROW 15" — columnas 1 a 10 -->
       <tr>
        <td class="row-label">15"</td>
        ${vals15.map((v, i) => {
         const colN = i + 1;
         return renderScoreCell(colN, v, series ? hit15?.shotNumber : undefined, miss15);
        }).join('')}
        <td class="td-puntos" rowspan="3">${series ? (mainPts || '') : ''}</td>
        <td class="td-adicional" rowspan="3">${series ? addPts : ''}</td>
       </tr>

       <!-- ROW 10" — columna 1 vacía, columnas 2 a 10 -->
       <tr>
        <td class="row-label">10"</td>
        <td class="cell-empty"></td>
        ${vals10.map((v, i) => {
         const colN = i + 2;
         return renderScoreCell(colN, v, series ? hit10?.shotNumber : undefined, miss10);
        }).join('')}
        ${ vals10.length < 9 ? Array.from({ length: 9 - vals10.length }, () => '<td class="cell-empty"></td>').join('') : '' }
       </tr>

       <!-- ROW 5" — columnas 1-2 vacías, columnas 3 a 10 -->
       <tr>
        <td class="row-label">5"</td>
        <td class="cell-empty"></td>
        <td class="cell-empty"></td>
        ${vals5.map((v, i) => {
         const colN = i + 3;
         return renderScoreCell(colN, v, series ? hit5?.shotNumber : undefined, miss5);
        }).join('')}
        ${ vals5.length < 8 ? Array.from({ length: 8 - vals5.length }, () => '<td class="cell-empty"></td>').join('') : '' }
       </tr>
`;

const table_cf = `
      <colgroup>
       <col class="th-label">
       ${Array.from({ length: 12 }, () => '<col>').join('')}
       <col class="th-pts" style="width: 8%;">
       <col class="th-add" style="width: 10%;">
       <col class="th-pts" style="width: 8%;">
      </colgroup>
      <thead>
       <tr>
        <th class="th-label">Disparos</th>
        ${Array.from({ length: 12 }, (_, i) => `<th>${i + 1}</th>`).join('')}
        <th class="th-pts">Bonus</th>
        <th class="th-add">Adicional</th>
        <th class="th-pts">Puntos</th>
       </tr>
      </thead>
      <tbody>

       <!-- ROW GRANDE -->
       <tr>
        <td class="row-label" style="font-size:12px;">Grande</td>
        ${valsGrande.map((v, i) => {
         const colN = i + 1;
         return renderScoreCell(colN, v, series ? hitGrande?.shotNumber : undefined, missGrande);
        }).join('')}
        <td class="td-puntos" rowspan="3" style="font-size:11px;">${series ? (series.bonusActive ? 'SI' : 'NO') : ''}</td>
        <td class="td-adicional" rowspan="3">${series ? addPts : ''}</td>
        <td class="td-puntos" rowspan="3">${series ? totalCF : ''}</td>
       </tr>

       <!-- ROW MEDIANO -->
       <tr>
        <td class="row-label" style="font-size:12px;">Mediano</td>
        <td class="cell-empty"></td>
        ${valsMediano.map((v, i) => {
         const colN = i + 2;
         return renderScoreCell(colN, v, series ? hitMediano?.shotNumber : undefined, missMediano);
        }).join('')}
       </tr>

       <!-- ROW PEQUEÑO -->
       <tr>
        <td class="row-label" style="font-size:12px;">Pequeño</td>
        <td class="cell-empty"></td>
        <td class="cell-empty"></td>
        ${valsPequeno.map((v, i) => {
         const colN = i + 3;
         return renderScoreCell(colN, v, series ? hitPequeno?.shotNumber : undefined, missPequeno);
        }).join('')}
       </tr>
`;

const replacement_table = `      ${isCF ? \`${table_cf}\` : \`${table_lr}\`}`;

content = content.replace(/      <colgroup>[\s\S]*?<\/tr>\s+<!-- FILA/, replacement_table.trim() + '\n\n       <!-- FILA');

const total_lr = "${series ? `${total} / 67` : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / 67'}";
const total_dynamic = "${series ? `${total} / ${maxScore}` : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / ${isCF ? 96 : 67}`}";
content = content.replace(total_lr, total_dynamic);

const summary_lr = `
     <!-- RESUMEN DE BLANCOS IMPACTADOS -->
     <div class="target-summary">
      <p>$\{targetSummary('15"', hit15, miss15)}</p>
      <p>$\{targetSummary('10"', hit10, miss10)}</p>
      <p>$\{targetSummary('5"', hit5, miss5)}</p>
      $\{series && addShots.length > 0 ? \`<p><strong>Adicionales:</strong> $\{addShots.length} disparos — $\{addPts} pts</p>\` : series ? '' : '<p style="color:#aaa;">Adicionales: firma de fiscal al culminar</p>'}
     </div>
`;
const summary_cf = `
     <!-- RESUMEN DE BLANCOS IMPACTADOS -->
     <div class="target-summary">
      <p>$\{targetSummary('Grande', hitGrande, missGrande)}</p>
      <p>$\{targetSummary('Mediano', hitMediano, missMediano)}</p>
      <p>$\{targetSummary('Pequeño', hitPequeno, missPequeno)}</p>
      $\{series && addShots.length > 0 ? \`<p><strong>Adicionales:</strong> $\{addShots.length} disparos — $\{addPts} pts</p>\` : series ? '' : '<p style="color:#aaa;">Adicionales: firma de fiscal al culminar</p>'}
     </div>
`;
const summary_replacement = `$\{isCF ? \`${summary_cf.trim()}\` : \`${summary_lr.trim()}\`}`;

content = content.replace(/     <!-- RESUMEN DE BLANCOS IMPACTADOS -->[\s\S]*?<\/div>/, summary_replacement);

const imp_lr = `
    <!-- IMPORTANTE -->
    <div class="importante">
     <h2 class="imp-title">Reglamento CPTP</h2>
     <ul class="imp-list">
      <li>Marcar acierto con "O", fallo con "X"</li>
      <li>Firma de fiscal es obligatoria tras la serie</li>
     </ul>
     <div class="imp-banner">Protección visual y auditiva obligatoria</div>
    </div>
`;
const imp_cf = `
    <!-- IMPORTANTE -->
    <div class="importante" style="align-items:flex-start; padding: 4px 8px;">
     <h2 class="imp-title" style="align-self:center;">IMPORTANTE</h2>
     <ul class="imp-list" style="font-size:7px; font-weight:700;">
      <li>TIRO "BONUS" MARCAR CASILLA "SI"</li>
      <li>TIRO CORRECTO MARCAR CON "O"</li>
      <li>TIRO ERRADO MARCAR CON "X"</li>
      <li>AL TERMINO DE LA PRUEBA SUMAR LOS PUNTOS</li>
      <li>ES OBLIGATORIA LA FIRMA DEL FISCAL DESPUES DE CADA SERIE Y DEL TIRADOR AL FINAL DE LA PRUEBA</li>
     </ul>
    </div>
`;
const imp_replacement = `$\{isCF ? \`${imp_cf.trim()}\` : \`${imp_lr.trim()}\`}`;

content = content.replace(/    <!-- IMPORTANTE -->[\s\S]*?<\/div>/, imp_replacement);

fs.writeFileSync('src/lib/print.ts', content, 'utf8');
console.log('done');
