const fs = require('fs');

let content = fs.readFileSync('src/lib/print.ts', 'utf8');

// 1. Remove the second column for CF
content = content.replace(
  'const col1Html = getSeriesColumnHtml(event, participant, s1, 1);\n  const col2Html = getSeriesColumnHtml(event, participant, s2, 2);',
  `const isCF = event.modality === '.308' || event.modality === '.223';
  const col1Html = getSeriesColumnHtml(event, participant, s1, 1);
  const col2Html = isCF ? '' : getSeriesColumnHtml(event, participant, s2, 2);`
);

// 2. Add full-width styling for CF columns
if (!content.includes('.cf-full-width')) {
    content = content.replace('.series-column {', '.cf-full-width { width: 100% !important; flex: none !important; }\n   .series-column {');
}

content = content.replace('<div class="series-column">', '<div class="series-column ${isCF ? \'cf-full-width\' : \'\'}">');

// 3. Remove "SERIE 1" for CF
content = content.replace(
  '<span class="vl" style="font-size:11px;font-weight:900;text-transform:uppercase;">SERIE ${seriesNumberLabel}</span>',
  '<span class="vl" style="font-size:11px;font-weight:900;text-transform:uppercase;">${isCF ? "&nbsp;" : "SERIE " + seriesNumberLabel}</span>'
);

// 4. Replace calibre image for CF
content = content.replace(
  '<img src="/22lr.svg" alt=".22 LR" style="height:22px;width:auto;object-fit:contain;" />',
  '${isCF ? `<div style="font-size:16px;font-weight:900;font-family:\'Rajdhani\',sans-serif;margin-top:2px;">${event.modality}</div>` : `<img src="/22lr.svg" alt=".22 LR" style="height:22px;width:auto;object-fit:contain;" />`}'
);

// 5. Change BONUS column format
content = content.replace(
  '<td class="td-puntos" rowspan="3" style="font-size:11px;">${series ? (series.bonusActive ? \'SI\' : \'NO\') : \'\'}</td>',
  `<td class="td-puntos" rowspan="3" style="font-size:10px; font-weight: 700; line-height: 1.4;">
          \${series ? 
            \`<div style="border-radius:3px; margin-bottom: 2px; \${series.bonusActive ? 'background:#000;color:#fff;' : ''}">SI</div>
             <div style="border-radius:3px; \${!series.bonusActive ? 'background:#000;color:#fff;' : ''}">NO</div>\`
          : \`<div style="margin-bottom:2px;">SI</div><div>NO</div>\`}
        </td>`
);

// Adjust widths to make it fit beautifully across the page
content = content.replace(
  '<col class="th-pts" style="width: 8%;">\n       <col class="th-add" style="width: 10%;">\n       <col class="th-pts" style="width: 8%;">',
  '<col class="th-pts" style="width: 6%;">\n       <col class="th-add" style="width: 9%;">\n       <col class="th-pts" style="width: 7%;">'
);

fs.writeFileSync('src/lib/print.ts', content, 'utf8');
console.log('done');
