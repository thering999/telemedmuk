const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/xlsx-C3mkfhSP.js","assets/rolldown-runtime-QTnfLwEv.js"])))=>i.map(i=>d[i]);
import{t as e}from"./index-NMSenSsu.js";var t=[`68`,`69`];function n(e){return e?.telemed??0}var r=[`ม.ค.`,`ก.พ.`,`มี.ค.`,`เม.ย.`,`พ.ค.`,`มิ.ย.`,`ก.ค.`,`ส.ค.`,`ก.ย.`,`ต.ค.`,`พ.ย.`,`ธ.ค.`];function i(e){let t=new Date(`${e}T00:00:00`);return Number.isNaN(t.getTime())?e:`${t.getDate()} ${r[t.getMonth()]} ${t.getFullYear()+543}`}function a(e){return`${e.getDate()} ${r[e.getMonth()]} ${e.getFullYear()+543} ${String(e.getHours()).padStart(2,`0`)}:${String(e.getMinutes()).padStart(2,`0`)}:${String(e.getSeconds()).padStart(2,`0`)}`}function o(e,t){return t.map(t=>{let n={};for(let r of e)n[r.label]=r.value(t);return n})}async function s(t,n,r){let i=await e(()=>import(`./xlsx-C3mkfhSP.js`).then(e=>e.r),__vite__mapDeps([0,1])),a=o(n,r),s=i.utils.json_to_sheet(a,{header:n.map(e=>e.label)}),c=i.utils.book_new();i.utils.book_append_sheet(c,s,`ข้อมูล`),i.writeFile(c,`${t}.xlsx`)}function c(e){let t=String(e);return/[",\n\r]/.test(t)?`"${t.replace(/"/g,`""`)}"`:t}function l(e,t,n){let r=[t.map(e=>c(e.label)).join(`,`),...n.map(e=>t.map(t=>c(t.value(e))).join(`,`))],i=new Blob([`﻿`,r.join(`\r
`)],{type:`text/csv;charset=utf-8;`}),a=URL.createObjectURL(i),o=document.createElement(`a`);o.href=a,o.download=`${e}.csv`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(a)}function u(e,t,n){let r=new Date().toLocaleString(`th-TH`),i=t.map(e=>`<th>${d(e.label)}</th>`).join(``),a=n.map(e=>`<tr>${t.map(t=>`<td>${d(String(t.value(e)))}</td>`).join(``)}</tr>`).join(``);return`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${d(e)}</title>
<style>
  body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; padding: 24px; color: #1e293b; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p.meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>${d(e)}</h1>
  <p class="meta">พิมพ์เมื่อ: ${d(r)} · จำนวน ${n.length.toLocaleString(`th-TH`)} รายการ</p>
  <table>
    <thead><tr>${i}</tr></thead>
    <tbody>${a}</tbody>
  </table>
</body>
</html>`}function d(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function f(e,t,n){let r=u(e,t,n),i=window.open(``,`_blank`);if(!i){window.alert(`เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่ — กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่`);return}i.document.open(),i.document.write(r),i.document.close(),i.focus(),i.setTimeout(()=>i.print(),250)}export{a,i,s as n,t as o,f as r,n as s,l as t};