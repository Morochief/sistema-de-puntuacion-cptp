const fs = require('fs');

let content = fs.readFileSync('src/lib/print.ts', 'utf8');

// 1. Remove the second column for CF but replace it with a dummy placeholder so the first column doesn't stretch
content = content.replace(
  'const col1Html = getSeriesColumnHtml(event, participant, s1, 1);\n  const col2Html = getSeriesColumnHtml(event, participant, s2, 2);',
  `const isCF = event.modality === '.308' || event.modality === '.223';
  const col1Html = getSeriesColumnHtml(event, participant, s1, 1);
  const col2Html = isCF ? '<div class="series-column"></div>' : getSeriesColumnHtml(event, participant, s2, 2);`
);

// 2. Remove "SERIE 1" for CF
content = content.replace(
  '<span class="vl" style="font-size:11px;font-weight:900;text-transform:uppercase;">SERIE ${seriesNumberLabel}</span>',
  '<span class="vl" style="font-size:11px;font-weight:900;text-transform:uppercase;">${isCF ? "&nbsp;" : "SERIE " + seriesNumberLabel}</span>'
);

// 3. Replace calibre image for CF
content = content.replace(
  '<img src="/22lr.svg" alt=".22 LR" style="height:22px;width:auto;object-fit:contain;" />',
  '${isCF ? `<div style="font-size:16px;font-weight:900;font-family:\'Rajdhani\',sans-serif;margin-top:2px;">${event.modality}</div>` : `<img src="/22lr.svg" alt=".22 LR" style="height:22px;width:auto;object-fit:contain;" />`}'
);

// 4. Change BONUS column format
content = content.replace(
  '<td class="td-puntos" rowspan="3" style="font-size:11px;">${series ? (series.bonusActive ? \'SI\' : \'NO\') : \'\'}</td>',
  `<td class="td-puntos" rowspan="3" style="font-size:10px; font-weight: 700; line-height: 1.4;">
          \${series ? 
            \`<div style="border-radius:3px; margin-bottom: 2px; \${series.bonusActive ? 'background:#000;color:#fff;' : ''}">SI</div>
             <div style="border-radius:3px; \${!series.bonusActive ? 'background:#000;color:#fff;' : ''}">NO</div>\`
          : \`<div style="margin-bottom:2px;">SI</div><div>NO</div>\`}
        </td>`
);

// Adjust widths to make it fit beautifully
content = content.replace(
  '<col class="th-pts" style="width: 8%;">\n       <col class="th-add" style="width: 10%;">\n       <col class="th-pts" style="width: 8%;">',
  '<col class="th-pts" style="width: 6%;">\n       <col class="th-add" style="width: 9%;">\n       <col class="th-pts" style="width: 7%;">'
);

fs.writeFileSync('src/lib/print.ts', content, 'utf8');
console.log('done');
