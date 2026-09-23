const API_URL="https://script.google.com/macros/s/AKfycbx2QSzErbD1Ham0-iUmb1f3GWHOUA3YegeGuQDBoHK8tRVt_nW0tU2cslIa-0_kRr80/exec";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const state={token:localStorage.getItem('adones_token')||'',user:null,ordens:[],recibos:[],estoque:[],gastos:[],retiradas:[],usuarios:[],status:[],retiradaStatus:[],receiptItems:[]};
const API_TIMEOUT_MS=30000;
const CHECKLIST_ITENS=[
  ['tela','Tela / imagem'],
  ['touch','Touch'],
  ['botoes','Botões físicos'],
  ['cameraFrontal','Câmera frontal'],
  ['cameraTraseira','Câmera traseira'],
  ['flash','Flash'],
  ['altoFalante','Alto-falante'],
  ['auricular','Auricular'],
  ['microfone','Microfone'],
  ['biometria','Face ID / Touch ID / Biometria'],
  ['wifi','Wi‑Fi'],
  ['bluetooth','Bluetooth'],
  ['sinal','Rede / sinal'],
  ['carga','Conector / carga'],
  ['bateria','Bateria'],
  ['vibracao','Vibração'],
  ['sensor','Sensor de proximidade'],
  ['carregamentoSemFio','Carga sem fio']
];
const CHECKLIST_ESTADOS=['OK','Falha','N/T','N/A'];
const EMPRESA={
  nome:'ADONES CELL',
  cnpj:'59.916.790/0001-00',
  endereco:'R. Manuel Homem de Andrade, 630 - Vila Andrade, São Paulo - SP, 05723-400',
  whatsapp:'(11) 98375-2451',
  instagram:'@ADONES_REPAIR',
  logo:new URL('assets/logo-adonescell.webp',location.href).href
};


async function api(acao,dados={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
  try{
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({acao,token:state.token,...dados}),cache:'no-store',redirect:'follow',signal:controller.signal});
    const txt=await r.text();
    let j;try{j=JSON.parse(txt)}catch(_){throw new Error('Resposta inválida do servidor. Atualize a implantação do Apps Script.');}
    if(!j.ok)throw new Error(j.erro||'Erro na operação.');
    return j;
  }catch(err){
    if(err.name==='AbortError')throw new Error('O servidor demorou para responder.');
    if(/Failed to fetch|Load failed|NetworkError/i.test(String(err.message)))throw new Error('Falha de conexão com o Google Apps Script.');
    throw err;
  }finally{clearTimeout(timer)}
}

function formObj(f){return Object.fromEntries(new FormData(f).entries())}
function isAdmin(){return state.user?.perfil==='Administrador'}
function num(v){const s=String(v||'').replace(/R\$/g,'').trim();return Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s.replace(/[^0-9.-]/g,''))||0}
function statusClass(s){s=String(s||'').toLowerCase();if(s.includes('pronto'))return'pronto';if(s.includes('reparo'))return'reparo';if(s.includes('aguard'))return'aguardando';if(s.includes('cancel'))return'cancelado';if(s.includes('entreg'))return'entregue';if(s.includes('análise')||s.includes('analise'))return'analise';return''}
function pill(s){return `<span class="status ${statusClass(s)}">${esc(s||'Recebido')}</span>`}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}

function showPage(name){
  $$('.page').forEach(x=>x.classList.remove('active'));$('#page-'+name)?.classList.add('active');
  $$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  const titles={'dashboard':'Dashboard','nova-os':'Nova ordem de serviço','ordens':'Ordens de serviço','retiradas':'Retiradas e agendamentos','recibos':'Venda e recibo','financeiro':'Financeiro','estoque':'Estoque','usuarios':'Usuários'};
  $('#titulo').textContent=titles[name]||'ADONESCELL';
  localStorage.setItem('adones_page',name);
  if(innerWidth<821)$('#sidebar').classList.remove('open');
  if(name==='dashboard')carregarDashboard();
  if(name==='ordens')carregarOrdens();
  if(name==='retiradas')carregarRetiradas();
  if(name==='recibos'){carregarRecibos();carregarEstoqueParaVenda();}
  if(name==='financeiro')carregarFinanceiro();
  if(name==='estoque'&&isAdmin())carregarEstoque();
  if(name==='usuarios'&&isAdmin())carregarUsuarios();
}

$$('.nav').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$('.go-orders').onclick=()=>showPage('ordens');
$('#novaOsBtn').onclick=()=>{limparFormOS();showPage('nova-os')};
$('#menu').onclick=()=>$('#sidebar').classList.toggle('open');

function showApp(){
  $('#login').classList.add('hidden');$('#app').classList.remove('hidden');
  $('#userInfo').textContent=`${state.user.nome} • ${state.user.perfil}`;
  $$('.admin-only').forEach(x=>x.classList.toggle('hidden',!isAdmin()));
  const p=localStorage.getItem('adones_page')||'dashboard';
  if((p==='financeiro'||p==='estoque'||p==='usuarios')&&!isAdmin())showPage('dashboard');else showPage(p);
}

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();const d=formObj(e.currentTarget);$('#loginMsg').textContent='Entrando...';
  try{const j=await api('login',d);state.token=j.token;state.user=j.usuario;localStorage.setItem('adones_token',state.token);$('#loginMsg').textContent='';showApp()}catch(err){$('#loginMsg').textContent=err.message}
};
$('#sair').onclick=()=>{localStorage.removeItem('adones_token');localStorage.removeItem('adones_page');location.reload()};

async function carregarDashboard(){
  try{
    const j=await api('dashboard');state.status=j.status||state.status;
    $('#mAbertas').textContent=j.abertas||0;
    $('#mProntas').textContent=j.prontas||0;
    $('#mReceita').textContent=money(j.receitaTotal??j.receita??0);
    $('#mLucro').textContent=money(j.lucroLiquido??j.lucro??0);
    montarStatus();
    const o=await api('listarOrdens');state.ordens=o.ordens||[];renderUltimas();
  }catch(e){toast(e.message)}
}
$('#refreshDashboard').onclick=carregarDashboard;

function renderUltimas(){
  const lista=state.ordens.slice(0,8);$('#ultimasBody').innerHTML=lista.length?lista.map(o=>`<tr><td><strong>${esc(o.protocolo)}</strong></td><td>${esc(o.cliente)}</td><td>${esc(o.modelo)}</td><td>${pill(o.status)}</td><td>${money(o.valor)}</td></tr>`).join(''):`<tr><td colspan="5">Nenhuma ordem cadastrada.</td></tr>`
}

function montarStatus(){
  const status=state.status.length?state.status:['Recebido','Em análise','Aguardando peça','Em reparo','Pronto','Entregue','Cancelado'];
  $('#statusSelect').innerHTML=status.map(s=>`<option>${esc(s)}</option>`).join('');
  $('#filtroStatus').innerHTML='<option value="">Todos os status</option>'+status.map(s=>`<option>${esc(s)}</option>`).join('');
}

async function carregarOrdens(){
  try{
    const j=await api('listarOrdens',{busca:$('#buscaOS').value,status:$('#filtroStatus').value});state.ordens=j.ordens||[];state.status=j.status||state.status;montarStatus();renderOrdens();
  }catch(e){toast(e.message)}
}
$('#buscarOS').onclick=carregarOrdens;$('#buscaOS').addEventListener('keydown',e=>{if(e.key==='Enter')carregarOrdens()});$('#filtroStatus').onchange=carregarOrdens;

function statusOptions(atual){
  const lista=state.status.length?state.status:['Recebido','Em análise','Aguardando peça','Em reparo','Pronto','Entregue','Cancelado'];
  return lista.map(s=>`<option value="${esc(s)}" ${s===atual?'selected':''}>${esc(s)}</option>`).join('');
}

function renderOrdens(){
  $('#ordensBody').innerHTML=state.ordens.length?state.ordens.map(o=>`<tr data-row-id="${esc(o.id)}"><td>${esc(o.dataEntrada)}</td><td><strong>${esc(o.protocolo)}</strong></td><td><strong>${esc(o.cliente)}</strong><br><small>${esc(o.whatsapp)}</small></td><td>${esc(o.aparelho)}<br><small>${esc(o.modelo)}</small></td><td><div class="quick-status-wrap"><select class="quick-status ${statusClass(o.status)}" data-id="${esc(o.id)}" data-current="${esc(o.status)}" aria-label="Alterar status da OS ${esc(o.protocolo)}">${statusOptions(o.status)}</select><span class="quick-status-saving" aria-live="polite"></span></div></td><td>${esc(o.tecnico||'-')}</td><td>${money(o.valor)}</td><td><div class="actions"><button class="action js-print" data-id="${esc(o.id)}">Imprimir OS</button><button class="action js-edit" data-id="${esc(o.id)}">Editar</button><button class="action js-link" data-protocolo="${esc(o.protocolo)}">Link cliente</button>${isAdmin()?`<button class="action danger js-del" data-id="${esc(o.id)}">Excluir</button>`:''}</div></td></tr>`).join(''):`<tr><td colspan="8">Nenhuma ordem encontrada.</td></tr>`;
  $$('.quick-status').forEach(s=>s.onchange=()=>alterarStatusRapido(s));
  $$('.js-print').forEach(b=>b.onclick=()=>{const o=state.ordens.find(x=>x.id===b.dataset.id);if(o)imprimirOS(o)});
  $$('.js-edit').forEach(b=>b.onclick=()=>editarOS(b.dataset.id));
  $$('.js-link').forEach(b=>b.onclick=()=>copiarLink(b.dataset.protocolo));
  $$('.js-del').forEach(b=>b.onclick=()=>excluirOS(b.dataset.id));
}

async function alterarStatusRapido(select){
  const id=select.dataset.id;
  const anterior=select.dataset.current;
  const novo=select.value;
  if(!id||novo===anterior)return;
  const saving=select.parentElement.querySelector('.quick-status-saving');
  select.disabled=true;saving.textContent='Salvando...';
  try{
    await api('atualizarStatusOrdem',{id,status:novo});
    select.dataset.current=novo;
    select.className=`quick-status ${statusClass(novo)}`;
    const o=state.ordens.find(x=>x.id===id);if(o)o.status=novo;
    saving.textContent='✓';toast(`Status alterado para ${novo}`);
    setTimeout(()=>saving.textContent='',1200);
  }catch(e){select.value=anterior;saving.textContent='';toast(e.message)}
  finally{select.disabled=false}
}

function checklistPadrao(){
  return Object.fromEntries(CHECKLIST_ITENS.map(([k])=>[k,'N/T']));
}
function checklistNormalizado(v){
  let obj={};
  if(v&&typeof v==='object')obj=v;
  else if(typeof v==='string'&&v.trim()){try{obj=JSON.parse(v)}catch(_){obj={}}}
  const out=checklistPadrao();
  CHECKLIST_ITENS.forEach(([k])=>{if(CHECKLIST_ESTADOS.includes(String(obj[k]||'')))out[k]=String(obj[k])});
  return out;
}
function montarChecklist(valores={}){
  const dados=checklistNormalizado(valores);
  const grid=$('#checklistGrid');
  if(!grid)return;
  grid.innerHTML=CHECKLIST_ITENS.map(([k,label])=>`<div class="check-item" data-key="${esc(k)}"><span class="check-item-name">${esc(label)}</span><div class="check-options">${CHECKLIST_ESTADOS.map(v=>`<button class="check-opt ${dados[k]===v?'active':''}" type="button" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`).join('');
  grid.querySelectorAll('.check-item').forEach(item=>{
    item.querySelectorAll('.check-opt').forEach(btn=>btn.onclick=()=>{
      item.querySelectorAll('.check-opt').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      atualizarChecklistHidden();
    });
  });
  atualizarChecklistHidden();
}
function atualizarChecklistHidden(){
  const out={};
  $$('#checklistGrid .check-item').forEach(item=>{
    const active=item.querySelector('.check-opt.active');
    out[item.dataset.key]=active?.dataset.value||'N/T';
  });
  const hidden=$('#checklistValue');if(hidden)hidden.value=JSON.stringify(out);
}
function checklistImpressaoHtml(checklist){
  const dados=checklistNormalizado(checklist);
  return CHECKLIST_ITENS.map(([k,label])=>{
    const v=dados[k]||'N/T';
    const cls=v==='OK'?'ok':v==='Falha'?'fail':v==='N/A'?'na':'nt';
    return `<div class="ci"><span>${esc(label)}</span><b class="${cls}">${esc(v)}</b></div>`;
  }).join('');
}



const MAX_FOTOS_ENVIO=6;
function fotoUrl(f){return f?.url||f?.thumbnailUrl||''}
function renderFotosSalvas(targetId,fotos=[]){
  const wrap=$(targetId);if(!wrap)return;
  const grid=wrap.querySelector('.photo-preview-grid');
  if(!Array.isArray(fotos)||!fotos.length){wrap.classList.add('hidden');if(grid)grid.innerHTML='';return;}
  wrap.classList.remove('hidden');
  grid.innerHTML=fotos.map((f,i)=>`<div class="photo-thumb"><a href="${esc(f.viewUrl||fotoUrl(f))}" target="_blank" rel="noopener"><img src="${esc(fotoUrl(f))}" alt="Foto ${i+1}" loading="lazy"></a><span>${i+1}</span></div>`).join('');
}
function previewArquivos(input,selector){
  const grid=$(selector);if(!grid)return;
  const files=[...(input?.files||[])].slice(0,MAX_FOTOS_ENVIO);
  grid.innerHTML='';
  files.forEach((file,i)=>{const u=URL.createObjectURL(file);const d=document.createElement('div');d.className='photo-thumb';d.innerHTML=`<img src="${u}" alt="Prévia ${i+1}"><span>${i+1}</span>`;grid.appendChild(d);});
}
async function arquivoParaFoto(file){
  if(!file.type.startsWith('image/'))throw new Error('Selecione apenas imagens.');
  const img=await new Promise((resolve,reject)=>{const i=new Image();const u=URL.createObjectURL(file);i.onload=()=>{URL.revokeObjectURL(u);resolve(i)};i.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Não foi possível ler uma das fotos.'))};i.src=u;});
  const max=1440;let w=img.naturalWidth,h=img.naturalHeight;const scale=Math.min(1,max/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
  let q=.82,blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
  while(blob&&blob.size>950000&&q>.5){q-=.08;blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));}
  if(!blob)throw new Error('Não foi possível preparar uma das fotos.');
  const dataUrl=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(new Error('Falha ao preparar foto.'));rd.readAsDataURL(blob)});
  return {nome:(file.name||'foto').replace(/\.[^.]+$/,'')+'.jpg',mime:'image/jpeg',base64:String(dataUrl).split(',')[1]};
}
async function prepararFotos(input){
  const files=[...(input?.files||[])];
  if(files.length>MAX_FOTOS_ENVIO)throw new Error(`Envie no máximo ${MAX_FOTOS_ENVIO} fotos por vez.`);
  const out=[];for(let i=0;i<files.length;i++)out.push(await arquivoParaFoto(files[i]));return out;
}
async function enviarFotosOrdem(id,tipo,input){
  if(!input?.files?.length)return null;
  const fotos=await prepararFotos(input);
  return api('adicionarFotosOrdem',{id,tipo,fotos});
}
function fotosImpressaoHtml(titulo,fotos=[]){
  if(!Array.isArray(fotos)||!fotos.length)return'';
  return `<div class="photo-print-title">${esc(titulo)}</div><div class="photo-print">${fotos.slice(0,4).map((f,i)=>`<div><img src="${esc(fotoUrl(f))}" alt="${esc(titulo)} ${i+1}"><span>${i+1}</span></div>`).join('')}</div>`;
}
$('#fotosEntradaInput')?.addEventListener('change',e=>previewArquivos(e.target,'#previewEntrada'));
$('#fotosProntoInput')?.addEventListener('change',e=>previewArquivos(e.target,'#previewPronto'));

function limparFormOS(){
  $('#osForm').reset();$('#osForm [name=id]').value='';$('#osForm [name=dataEntrada]').value=new Date().toISOString().slice(0,10);$('#osFormTitle').textContent='Nova ordem de serviço';$('#cancelEdit').classList.add('hidden');$('#osMsg').textContent='';montarStatus();montarChecklist();atualizarLucro();
  $('#previewEntrada').innerHTML='';$('#previewPronto').innerHTML='';renderFotosSalvas('#fotosEntradaSalvas',[]);renderFotosSalvas('#fotosProntoSalvas',[]);$('#fotosProntoCard').classList.add('hidden');
}
function editarOS(id){
  const o=state.ordens.find(x=>x.id===id);if(!o)return;
  showPage('nova-os');const f=$('#osForm');
  const map={id:o.id,cliente:o.cliente,whatsapp:o.whatsapp,aparelho:o.aparelho,modelo:o.modelo,imei:o.imei,defeito:o.defeito,diagnostico:o.diagnostico,servico:o.servico,status:o.status,valor:o.valor,custoPeca:o.custoPeca,outrosGastos:o.outrosGastos,tecnico:o.tecnico,previsao:o.previsao,observacoes:o.observacoes};
  Object.entries(map).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??''});
  montarChecklist(o.checklist||{});$('#fotosProntoCard').classList.remove('hidden');$('#previewEntrada').innerHTML='';$('#previewPronto').innerHTML='';renderFotosSalvas('#fotosEntradaSalvas',o.fotosEntrada||[]);renderFotosSalvas('#fotosProntoSalvas',o.fotosPronto||[]);
  $('#osFormTitle').textContent=`Editar OS ${o.protocolo}`;$('#cancelEdit').classList.remove('hidden');atualizarLucro();scrollTo({top:0,behavior:'smooth'});
}
$('#cancelEdit').onclick=()=>limparFormOS();

function atualizarLucro(){const f=$('#osForm'),lucro=num(f.elements.valor.value)-num(f.elements.custoPeca.value)-num(f.elements.outrosGastos.value);$('#lucroPreview').textContent=money(lucro)}
['valor','custoPeca','outrosGastos'].forEach(n=>$('#osForm').elements[n].addEventListener('input',atualizarLucro));
$('#osForm [name=whatsapp]').addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);if(d.length>10)d=d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');else if(d.length>6)d=d.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');e.target.value=d});
$('#osForm').onsubmit=async e=>{
  e.preventDefault();
  atualizarChecklistHidden();
  const d=formObj(e.currentTarget);
  const novaOS=!String(d.id||'').trim();
  const entradaInput=$('#fotosEntradaInput'),prontoInput=$('#fotosProntoInput');
  const temFotos=!!(entradaInput?.files?.length||prontoInput?.files?.length);
  const janelaImpressao=novaOS?window.open('','_blank'):null;
  if(janelaImpressao){janelaImpressao.document.write('<!doctype html><title>Gerando OS...</title><p style="font-family:Arial;padding:30px">Gerando ordem de serviço e enviando fotos...</p>');}
  $('#osMsg').textContent='Salvando...';
  try{
    const j=await api('salvarOrdem',d);let ordemFinal=j.ordem;
    if(entradaInput?.files?.length){$('#osMsg').textContent='Enviando fotos de entrada...';const up=await enviarFotosOrdem(j.id,'entrada',entradaInput);if(up?.ordem)ordemFinal=up.ordem;}
    if(prontoInput?.files?.length){$('#osMsg').textContent='Enviando fotos do aparelho pronto...';const up=await enviarFotosOrdem(j.id,'pronto',prontoInput);if(up?.ordem)ordemFinal=up.ordem;}
    $('#osMsg').textContent=`Salvo: ${j.protocolo}`;
    toast(novaOS?'OS criada. Comprovante pronto para impressão.':temFotos?'OS e fotos atualizadas.':'Ordem de serviço atualizada');
    if(novaOS && ordemFinal) imprimirOS(ordemFinal,janelaImpressao); else if(janelaImpressao) janelaImpressao.close();
    await carregarOrdens();
    setTimeout(()=>{limparFormOS();showPage('ordens')},650);
  }catch(err){if(janelaImpressao)janelaImpressao.close();$('#osMsg').textContent=err.message}
};

async function excluirOS(id){if(!confirm('Excluir esta ordem de serviço?'))return;try{await api('excluirOrdem',{id});toast('Ordem excluída');carregarOrdens()}catch(e){toast(e.message)}}
async function copiarLink(protocolo){const u=new URL('acompanhar.html',location.href);u.searchParams.set('protocolo',protocolo);try{await navigator.clipboard.writeText(u.toString());toast('Link do cliente copiado')}catch(_){prompt('Copie o link:',u.toString())}}


function linkAcompanhamento(protocolo){
  const u=new URL('acompanhar.html',location.href);u.searchParams.set('protocolo',protocolo);return u.toString();
}

function cabecalhoDocumentoHtml(tipo,numero,subtitulo=''){
  return `<div class="doc-head">
    <div class="brand-doc">
      <img src="${esc(EMPRESA.logo)}" alt="ADONES CELL">
      <div class="company-lines">
        <strong>${esc(EMPRESA.nome)}</strong>
        <span>CNPJ ${esc(EMPRESA.cnpj)}</span>
        <small>${esc(EMPRESA.endereco)}</small>
        <small>WhatsApp ${esc(EMPRESA.whatsapp)} • Instagram ${esc(EMPRESA.instagram)}</small>
      </div>
    </div>
    <div class="doc-number">
      <small>${esc(tipo)}</small>
      <strong>${esc(numero)}</strong>
      ${subtitulo?`<span>${esc(subtitulo)}</span>`:''}
    </div>
  </div>`;
}

function estilosDocumento(){
  return `*{box-sizing:border-box}body{margin:0;background:#eef3f8;font-family:Arial,sans-serif;color:#13233b}.sheet{width:210mm;min-height:297mm;margin:8mm auto;background:#fff;padding:10mm 12mm;box-shadow:0 5px 30px #ccd5df}.doc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:3px solid #0a63ff;padding-bottom:10px}.brand-doc{display:flex;align-items:center;gap:12px;min-width:0}.brand-doc img{width:112px;max-height:72px;object-fit:contain;object-position:left center}.company-lines{display:flex;flex-direction:column;min-width:0}.company-lines strong{font-size:13px;color:#0c1d35}.company-lines span{font-size:8px;font-weight:700;color:#496078;margin-top:3px}.company-lines small{font-size:7px;color:#6d7e91;line-height:1.45;margin-top:2px}.doc-number{text-align:right;flex:0 0 auto}.doc-number small{display:block;font-size:7px;color:#78879a;text-transform:uppercase;font-weight:800}.doc-number strong{display:block;margin-top:3px;font-size:16px;color:#0a63ff}.doc-number span{display:block;margin-top:4px;font-size:7px;color:#78879a}.doc-title{margin:13px 0 0;font-size:15px;letter-spacing:-.02em}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.box{border:1px solid #dce5ef;border-radius:7px;padding:8px;min-height:47px}.box.full{grid-column:1/-1}.box span{display:block;font-size:7px;color:#718096;text-transform:uppercase;font-weight:700;margin-bottom:4px}.box strong,.box p{font-size:10px;line-height:1.4;margin:0;white-space:pre-wrap}.status-doc{display:inline-block;background:#eaf3ff;color:#0a63ff;border-radius:999px;padding:4px 8px;font-weight:700}.check-title{font-size:9px;font-weight:800;margin:12px 0 6px;text-transform:uppercase;color:#40546d}.check-print{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.ci{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:5px 6px;border:1px solid #e0e7ef;border-radius:6px;font-size:7px}.ci span{font-weight:700;color:#40546d}.ci b{border-radius:999px;padding:3px 5px;font-size:6px}.ci b.ok{background:#e4f7ec;color:#147c49}.ci b.fail{background:#ffeaed;color:#b13241}.ci b.nt{background:#eaf2fc;color:#456682}.ci b.na{background:#f2edfb;color:#7253a0}.photo-print-title{font-size:9px;font-weight:800;margin:12px 0 6px;text-transform:uppercase;color:#40546d}.photo-print{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.photo-print>div{position:relative;height:36mm;border:1px solid #dce5ef;border-radius:6px;overflow:hidden;background:#f3f6f9}.photo-print img{width:100%;height:100%;object-fit:cover}.photo-print span{position:absolute;left:4px;bottom:4px;padding:2px 4px;border-radius:4px;background:rgba(8,27,50,.72);color:#fff;font-size:6px}.track{margin-top:10px;background:#f4f8fd;border:1px solid #dbe8f6;border-radius:7px;padding:8px;font-size:8px;word-break:break-all}.track b{color:#0a63ff}.receipt-value{margin-top:16px;padding:17px;border:1px solid #cfe1f5;border-radius:10px;background:#f6faff;text-align:center}.receipt-value small{display:block;color:#738398;font-size:8px;text-transform:uppercase;font-weight:800}.receipt-value strong{display:block;margin-top:5px;color:#0a63ff;font-size:25px}.receipt-text{margin-top:18px;font-size:11px;line-height:1.75;color:#263950;text-align:justify}.receipt-text b{color:#0a63ff}.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px}.sign div{border-top:1px solid #7d8998;padding-top:6px;text-align:center;font-size:8px;color:#66758a}.sign.one{grid-template-columns:1fr;max-width:290px;margin-left:auto;margin-right:auto}.foot{margin-top:16px;border-top:1px solid #e4e9ef;padding-top:7px;font-size:7px;color:#8591a0;display:flex;justify-content:space-between;gap:16px}.no-print{position:fixed;right:18px;bottom:18px;background:#0a63ff;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:auto;min-height:auto}.no-print{display:none}}@page{size:A4;margin:0}`;
}

function imprimirOS(o,win=null){
  const w=win||window.open('','_blank');
  if(!w){toast('O navegador bloqueou a impressão. Use o botão “Imprimir OS”.');return;}
  const link=linkAcompanhamento(o.protocolo);
  const valor=money(o.valor);
  const hoje=new Date().toLocaleString('pt-BR');
  const checks=checklistImpressaoHtml(o.checklist||{});
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OS ${esc(o.protocolo)}</title><style>${estilosDocumento()}</style></head>
  <body onload="setTimeout(()=>window.print(),1200)"><div class="sheet">
    ${cabecalhoDocumentoHtml('Ordem de serviço',o.protocolo,`Emitida em ${hoje}`)}
    <h1 class="doc-title">Ordem de Serviço</h1>
    <div class="grid">
      <div class="box"><span>Cliente</span><strong>${esc(o.cliente)}</strong></div>
      <div class="box"><span>WhatsApp</span><strong>${esc(o.whatsapp)}</strong></div>
      <div class="box"><span>Aparelho / Modelo</span><strong>${esc([o.aparelho,o.modelo].filter(Boolean).join(' • '))}</strong></div>
      <div class="box"><span>IMEI / Serial</span><strong>${esc(o.imei||'-')}</strong></div>
      <div class="box"><span>Entrada</span><strong>${esc(o.dataEntrada||'-')}</strong></div>
      <div class="box"><span>Status</span><strong class="status-doc">${esc(o.status||'Recebido')}</strong></div>
      <div class="box full"><span>Defeito informado</span><p>${esc(o.defeito||'-')}</p></div>
    </div>
    <div class="check-title">Checklist de entrada</div><div class="check-print">${checks}</div>
    ${fotosImpressaoHtml('Fotos de entrada',o.fotosEntrada||[])}
    ${fotosImpressaoHtml('Fotos do aparelho pronto',o.fotosPronto||[])}
    <div class="grid">
      <div class="box full"><span>Diagnóstico / Observação técnica</span><p>${esc(o.diagnostico||'Aguardando análise técnica.')}</p></div>
      <div class="box"><span>Previsão</span><strong>${esc(o.previsao||'A confirmar')}</strong></div>
      <div class="box"><span>Valor do serviço</span><strong>${esc(valor)}</strong></div>
    </div>
    <div class="track"><b>Acompanhe seu reparo:</b><br>${esc(link)}</div>
    <div class="sign"><div>Assinatura do cliente</div><div>ADONES CELL / Responsável</div></div>
    <div class="foot"><span>${esc(EMPRESA.endereco)}</span><span>${esc(o.protocolo)}</span></div>
  </div><button class="no-print" onclick="window.print()">Imprimir</button></body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

const RETIRADA_STATUS_PADRAO=['Nova solicitação','Aguardando aprovação','Agendado','Em rota para retirada','Aparelho coletado','Na assistência','Pronto','Devolução agendada','Finalizado','Cancelado'];
function retiradaStatusClass(s){s=String(s||'').toLowerCase();if(s.includes('final'))return'entregue';if(s.includes('cancel'))return'cancelado';if(s.includes('agend'))return'aguardando';if(s.includes('assist')||s.includes('colet')||s.includes('rota'))return'reparo';if(s.includes('pronto'))return'pronto';return'analise'}
function retiradaOptions(atual){const lista=state.retiradaStatus.length?state.retiradaStatus:RETIRADA_STATUS_PADRAO;return lista.map(x=>`<option ${x===atual?'selected':''}>${esc(x)}</option>`).join('')}
async function carregarRetiradas(){
  try{
    const j=await api('listarRetiradas',{busca:$('#buscaRetirada')?.value||'',status:$('#filtroRetiradaStatus')?.value||''});
    state.retiradas=j.retiradas||[];state.retiradaStatus=j.status||RETIRADA_STATUS_PADRAO;
    const filtro=$('#filtroRetiradaStatus');if(filtro){const atual=filtro.value;filtro.innerHTML='<option value="">Todos os status</option>'+state.retiradaStatus.map(x=>`<option>${esc(x)}</option>`).join('');filtro.value=atual}
    renderRetiradas();
  }catch(e){toast(e.message)}
}
function renderRetiradas(){
  const body=$('#retiradasBody');if(!body)return;
  const ls=state.retiradas;
  $('#rNovas').textContent=ls.filter(r=>['Nova solicitação','Aguardando aprovação'].includes(r.status)).length;
  $('#rAgendadas').textContent=ls.filter(r=>r.status==='Agendado').length;
  $('#rAndamento').textContent=ls.filter(r=>['Em rota para retirada','Aparelho coletado','Na assistência','Pronto','Devolução agendada'].includes(r.status)).length;
  $('#rFinalizadas').textContent=ls.filter(r=>r.status==='Finalizado').length;
  body.innerHTML=ls.length?ls.map(r=>`<tr>
    <td><strong>${esc(r.protocolo)}</strong><br><small>${esc(r.dataSolicitacao||'')}</small></td>
    <td><strong>${esc(r.cliente)}</strong><br><small>${esc(r.whatsapp)}</small></td>
    <td>${esc(r.endereco)}, ${esc(r.numero)}<br><small>${esc([r.complemento,r.bairro,[r.cidade,r.estado].filter(Boolean).join('/'),r.cep].filter(Boolean).join(' • '))}</small></td>
    <td><strong>${esc(r.modelo)}</strong><br><small>${esc(r.problema)}</small></td>
    <td>${esc(r.dataConfirmada||r.dataDesejada||'A confirmar')}<br><small>${esc(r.horarioConfirmado||r.periodo||'')}</small></td>
    <td><select class="pickup-status ${retiradaStatusClass(r.status)}" data-id="${esc(r.id)}" data-current="${esc(r.status)}">${retiradaOptions(r.status)}</select></td>
    <td>${r.osProtocolo?`<strong>${esc(r.osProtocolo)}</strong>`:'<small>Não criada</small>'}</td>
    <td><div class="actions"><button class="action js-ret-edit" data-id="${esc(r.id)}">Aprovar / agendar</button><button class="action js-ret-wa" data-id="${esc(r.id)}">WhatsApp</button>${r.osProtocolo?'':`<button class="action js-ret-os" data-id="${esc(r.id)}">Criar OS</button>`}</div></td>
  </tr>`).join(''):'<tr><td colspan="8">Nenhuma solicitação de retirada.</td></tr>';
  $$('.pickup-status').forEach(el=>el.onchange=()=>alterarStatusRetiradaRapido(el));
  $$('.js-ret-edit').forEach(b=>b.onclick=()=>abrirRetirada(b.dataset.id));
  $$('.js-ret-wa').forEach(b=>b.onclick=()=>whatsRetirada(b.dataset.id));
  $$('.js-ret-os').forEach(b=>b.onclick=()=>criarOSRetirada(b.dataset.id));
}
async function alterarStatusRetiradaRapido(el){const anterior=el.dataset.current,novo=el.value;el.disabled=true;try{await api('atualizarRetirada',{id:el.dataset.id,status:novo});el.dataset.current=novo;el.className=`pickup-status ${retiradaStatusClass(novo)}`;const r=state.retiradas.find(x=>x.id===el.dataset.id);if(r)r.status=novo;toast('Status da retirada atualizado')}catch(e){el.value=anterior;toast(e.message)}finally{el.disabled=false}}
function abrirRetirada(id){const r=state.retiradas.find(x=>x.id===id);if(!r)return;const f=$('#retiradaForm');f.reset();f.elements.id.value=r.id;const statusPadrao=['Nova solicitação','Aguardando aprovação'].includes(r.status)?'Agendado':r.status;f.elements.status.innerHTML=retiradaOptions(statusPadrao);f.elements.status.value=statusPadrao;f.elements.dataConfirmada.value=dataInputBr_(r.dataConfirmada);f.elements.horarioConfirmado.value=r.horarioConfirmado||'';f.elements.observacoesInternas.value=r.observacoesInternas||'';$('#retiradaResumo').innerHTML=`<strong>${esc(r.cliente)} • ${esc(r.modelo)}</strong><span>${esc(r.protocolo)} • ${esc(r.whatsapp)}</span><small>${esc(r.endereco)}, ${esc(r.numero)} ${r.bairro?'• '+esc(r.bairro):''} ${r.cidade?'• '+esc(r.cidade)+(r.estado?'/'+esc(r.estado):''):''}</small><small>${esc(r.problema)}</small>`;$('#retiradaMsg').textContent='';$('#retiradaModal').classList.remove('hidden')}
function dataInputBr(v){const s=String(v||'');const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:(/^\d{4}-\d{2}-\d{2}$/.test(s)?s:'')}
function whatsRetirada(id){const r=state.retiradas.find(x=>x.id===id);if(!r)return;const num=String(r.whatsapp||'').replace(/\D/g,'');const tel=num.startsWith('55')?num:'55'+num;const data=r.dataConfirmada||r.dataDesejada||'a confirmar',horario=r.horarioConfirmado||r.periodo||'a confirmar';const msg=`Olá, ${r.cliente}! Aqui é da ADONES CELL. Sobre sua solicitação ${r.protocolo}: status ${r.status}. Agendamento: ${data} ${horario}.`;window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,'_blank','noopener')}
async function criarOSRetirada(id){if(!confirm('Criar uma Ordem de Serviço com os dados desta retirada?'))return;try{const j=await api('criarOSDeRetirada',{id});toast('OS criada: '+j.protocolo);await carregarRetiradas();await carregarOrdens()}catch(e){toast(e.message)}}

function novoIdItem(){return 'IT'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function limparFormRecibo(){const f=$('#reciboForm');if(!f)return;f.reset();f.elements.data.value=new Date().toISOString().slice(0,10);f.elements.formaPagamento.value='PIX';state.receiptItems=[{id:novoIdItem(),tipo:'estoque',produtoId:'',quantidade:1,descricao:'',preco:'',custo:''}];$('#reciboMsg').textContent='';renderItensRecibo()}
async function carregarEstoqueParaVenda(){try{const j=await api('listarEstoque',{status:'Ativo'});state.estoque=j.produtos||[];renderItensRecibo()}catch(e){toast(e.message)}}
function produtoOptions(idAtual=''){const ativos=state.estoque.filter(p=>p.status==='Ativo'&&Number(p.quantidade)>0);return '<option value="">Selecione um produto</option>'+ativos.map(p=>`<option value="${esc(p.id)}" ${p.id===idAtual?'selected':''}>${esc(p.nome)} — ${money(p.preco)} (${p.quantidade} un.)</option>`).join('')}
function adicionarItemRecibo(tipo){state.receiptItems.push({id:novoIdItem(),tipo,produtoId:'',quantidade:1,descricao:'',preco:'',custo:''});renderItensRecibo()}
function removerItemRecibo(id){if(state.receiptItems.length<=1){toast('O recibo precisa ter pelo menos um item.');return}state.receiptItems=state.receiptItems.filter(x=>x.id!==id);renderItensRecibo()}
function renderItensRecibo(){const box=$('#reciboItens');if(!box)return;box.innerHTML=state.receiptItems.map((it,idx)=>{const stock=it.tipo==='estoque';const p=state.estoque.find(x=>x.id===it.produtoId);return `<article class="receipt-line" data-id="${esc(it.id)}"><div class="receipt-line-top"><span>Item ${idx+1}</span><div class="item-type-toggle"><button type="button" data-type="estoque" class="${stock?'active':''}">Estoque</button><button type="button" data-type="rapida" class="${!stock?'active':''}">Venda rápida</button></div><button type="button" class="remove-receipt-item" title="Remover">×</button></div>${stock?`<div class="receipt-line-grid"><label class="wide">Produto<select class="item-product">${produtoOptions(it.produtoId)}</select></label><label>Quantidade<input class="item-qty" type="number" min="1" step="1" value="${esc(it.quantidade||1)}"></label><div class="mini-total"><span>Unitário</span><strong>${money(p?.preco||0)}</strong></div><div class="mini-total"><span>Total</span><strong>${money((p?.preco||0)*(Number(it.quantidade)||1))}</strong></div>${p?`<small class="item-stock-info wide">Disponível: ${p.quantidade} un. • custo ${money(p.custo)}</small>`:''}</div>`:`<div class="receipt-line-grid"><label class="wide">Descrição<input class="item-desc" value="${esc(it.descricao||'')}" placeholder="Ex.: Película 3D"></label><label>Quantidade<input class="item-qty" type="number" min="1" step="1" value="${esc(it.quantidade||1)}"></label><label>Preço unitário<input class="item-price" inputmode="decimal" value="${esc(it.preco||'')}" placeholder="0,00"></label><label>Custo unitário<input class="item-cost" inputmode="decimal" value="${esc(it.custo||'')}" placeholder="0,00"></label></div>`}</article>`}).join('');
  $$('.receipt-line').forEach(card=>{const id=card.dataset.id,item=state.receiptItems.find(x=>x.id===id);card.querySelectorAll('.item-type-toggle button').forEach(b=>b.onclick=()=>{item.tipo=b.dataset.type;item.produtoId='';item.descricao='';item.preco='';item.custo='';renderItensRecibo()});card.querySelector('.remove-receipt-item').onclick=()=>removerItemRecibo(id);const prod=card.querySelector('.item-product');if(prod)prod.onchange=e=>{item.produtoId=e.target.value;renderItensRecibo()};const qty=card.querySelector('.item-qty');if(qty)qty.oninput=e=>{item.quantidade=Math.max(1,parseInt(e.target.value,10)||1);atualizarTotalRecibo()};qty.onchange=()=>renderItensRecibo();const desc=card.querySelector('.item-desc');if(desc)desc.oninput=e=>item.descricao=e.target.value;const price=card.querySelector('.item-price');if(price)price.oninput=e=>{item.preco=e.target.value;atualizarTotalRecibo()};const cost=card.querySelector('.item-cost');if(cost)cost.oninput=e=>item.custo=e.target.value;});atualizarTotalRecibo()}
function itensPayload(){return state.receiptItems.map(it=>({tipo:it.tipo,produtoId:it.produtoId||'',quantidade:Math.max(1,parseInt(it.quantidade,10)||1),descricao:it.descricao||'',preco:it.preco||'',custo:it.custo||''}))}
function atualizarTotalRecibo(){let total=0,qtd=0;state.receiptItems.forEach(it=>{const n=Math.max(1,parseInt(it.quantidade,10)||1);qtd+=n;if(it.tipo==='estoque'){const p=state.estoque.find(x=>x.id===it.produtoId);total+=(p?.preco||0)*n}else total+=num(it.preco)*n});if($('#reciboGrandTotal'))$('#reciboGrandTotal').textContent=money(total);if($('#reciboItemsSummary'))$('#reciboItemsSummary').textContent=`${qtd} unidade(s) em ${state.receiptItems.length} item(ns)`;if($('#reciboItensJson'))$('#reciboItensJson').value=JSON.stringify(itensPayload())}
async function carregarRecibos(){try{const j=await api('listarRecibos',{busca:$('#buscaRecibo')?.value||''});state.recibos=j.recibos||[];renderRecibos()}catch(e){toast(e.message)}}
function renderRecibos(){const body=$('#recibosBody');if(!body)return;body.innerHTML=state.recibos.length?state.recibos.map(r=>{const nomes=(r.itens||[]).map(i=>i.nome).filter(Boolean);const desc=nomes.length?nomes.slice(0,2).join(', ')+(nomes.length>2?` +${nomes.length-2}`:''):(r.produto||r.descricao||'-');return `<tr><td>${esc(r.data)}</td><td><strong>${esc(r.numero)}</strong></td><td>${esc(r.cliente)}</td><td><strong>${esc(desc)}</strong><br><small>${(r.itens||[]).length||1} item(ns)</small></td><td>${esc(r.quantidade||1)}</td><td>${money(r.valor)}</td><td><strong style="color:${Number(r.lucro)>=0?'#159a5b':'#df4050'}">${money(r.lucro)}</strong></td><td><div class="actions"><button class="action js-rec-print" data-id="${esc(r.id)}">Imprimir</button>${isAdmin()?`<button class="action danger js-rec-del" data-id="${esc(r.id)}">Excluir</button>`:''}</div></td></tr>`}).join(''):'<tr><td colspan="8">Nenhuma venda registrada.</td></tr>';$$('.js-rec-print').forEach(b=>b.onclick=()=>{const r=state.recibos.find(x=>x.id===b.dataset.id);if(r)imprimirRecibo(r)});$$('.js-rec-del').forEach(b=>b.onclick=()=>excluirRecibo(b.dataset.id))}
function imprimirRecibo(r,win=null){const w=win||window.open('','_blank');if(!w){toast('O navegador bloqueou a impressão.');return}const pagamento=r.formaPagamento||'Não informado';const observacoes=r.observacoes?`<div class="receipt-note"><span>Observações</span><p>${esc(r.observacoes)}</p></div>`:'';const itens=(r.itens&&r.itens.length?r.itens:[{nome:r.produto||r.descricao||'Produto / serviço',quantidade:r.quantidade||1,precoUnitario:r.precoUnitario||r.valor,total:r.valor,tipo:r.tipoVenda||''}]);const rows=itens.map(i=>`<tr><td class="desc"><strong>${esc(i.nome)}</strong><small>${esc(i.tipo||'Item')}</small></td><td>${esc(i.quantidade||1)}</td><td>${esc(money(i.precoUnitario||0))}</td><td><strong>${esc(money(i.total||((i.precoUnitario||0)*(i.quantidade||1))))}</strong></td></tr>`).join('');const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recibo ${esc(r.numero)}</title><style>${estilosDocumento()}.receipt-sheet{padding:14mm 18mm;display:flex;justify-content:center;align-items:flex-start;background:#fff}.market-receipt{width:100%;max-width:165mm;border:1px solid #d8e0ea;border-top:5px solid #0a63ff;border-radius:12px;background:#fff;padding:10mm 11mm 9mm}.market-head{display:flex;justify-content:space-between;gap:24px;padding-bottom:8mm;border-bottom:1px dashed #aebaca}.market-brand{display:flex;gap:13px;align-items:center}.market-brand img{width:34mm;height:22mm;object-fit:contain}.market-company{display:flex;flex-direction:column}.market-company strong{font-size:13px}.market-company span{font-size:8px;font-weight:700;color:#0a63ff;margin-top:3px}.market-company small{font-size:7px;color:#708095;margin-top:2px}.market-meta{text-align:right}.market-meta .type{font-size:8px;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#0a63ff}.market-meta .num{display:block;margin-top:5px;font-size:15px;font-weight:900}.market-meta .date{display:block;margin-top:5px;font-size:7px;color:#748397}.receipt-title-row{display:flex;justify-content:space-between;align-items:end;padding:8mm 0 4mm}.receipt-title-row h1{margin:0;font-size:18px}.paid-badge{padding:5px 9px;border-radius:999px;background:#eaf8f1;color:#16784c;font-size:7px;font-weight:900}.receipt-customer{display:grid;grid-template-columns:1.35fr .65fr;gap:7px}.receipt-info{padding:8px 9px;border:1px solid #e0e6ee;border-radius:7px;background:#fbfcfe}.receipt-info span{display:block;font-size:6.5px;text-transform:uppercase;color:#8390a1}.receipt-info strong{font-size:9.5px}.receipt-table{width:100%;border-collapse:collapse;margin-top:8mm;font-size:8px}.receipt-table th{text-align:left;padding:7px 8px;background:#f2f6fa;color:#637489;font-size:6.5px}.receipt-table th:last-child,.receipt-table td:last-child{text-align:right}.receipt-table td{padding:9px 8px;border-bottom:1px dashed #ccd5df}.receipt-table .desc strong{display:block}.receipt-table .desc small{display:block;font-size:7px;color:#738397;margin-top:2px}.receipt-summary{width:62mm;margin:7mm 0 0 auto}.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:8px}.summary-row.total{border-top:2px solid #10243f;padding-top:8px}.summary-row.total strong{font-size:17px;color:#0a63ff}.receipt-payment-line{display:flex;justify-content:space-between;margin-top:7mm;padding:8px 10px;background:#f6f9fc;border:1px solid #e1e7ef;border-radius:7px;font-size:8px}.receipt-note{margin-top:5mm;padding:8px 10px;border-left:3px solid #9db6d4;background:#f8fafc}.receipt-note span{font-size:6.5px;text-transform:uppercase;font-weight:900}.receipt-note p{margin:4px 0 0;font-size:8px}.receipt-confirm{text-align:center;margin-top:8mm;padding-top:6mm;border-top:1px dashed #aebaca;font-size:7px;color:#65788f}.market-foot{display:flex;justify-content:space-between;margin-top:7mm;padding-top:5mm;border-top:1px solid #e2e7ed;font-size:6.5px;color:#7b8998}</style></head><body onload="setTimeout(()=>window.print(),900)"><div class="sheet receipt-sheet"><section class="market-receipt"><header class="market-head"><div class="market-brand"><img src="${esc(EMPRESA.logo)}"><div class="market-company"><strong>${esc(EMPRESA.nome)}</strong><span>CNPJ ${esc(EMPRESA.cnpj)}</span><small>${esc(EMPRESA.endereco)}</small><small>${esc(EMPRESA.whatsapp)} • ${esc(EMPRESA.instagram)}</small></div></div><div class="market-meta"><span class="type">Recibo</span><strong class="num">${esc(r.numero)}</strong><span class="date">Emitido em ${esc(r.data||'-')}</span></div></header><div class="receipt-title-row"><div><h1>Recibo de pagamento</h1><p>Comprovante de valor recebido pela ADONES CELL</p></div><span class="paid-badge">✓ Pagamento recebido</span></div><div class="receipt-customer"><div class="receipt-info"><span>Cliente</span><strong>${esc(r.cliente)}</strong></div><div class="receipt-info"><span>CPF</span><strong>${esc(r.cpf)}</strong></div></div><table class="receipt-table"><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table><div class="receipt-summary"><div class="summary-row"><span>Itens</span><strong>${itens.length}</strong></div><div class="summary-row total"><span>Total recebido</span><strong>${esc(money(r.valor))}</strong></div></div><div class="receipt-payment-line"><span>Forma de pagamento: <b>${esc(pagamento)}</b></span><span>Data: <b>${esc(r.data||'-')}</b></span></div>${observacoes}<div class="receipt-confirm">Pagamento registrado com sucesso. Este documento comprova o recebimento dos valores descritos acima.</div><footer class="market-foot"><span>${esc(EMPRESA.nome)} • CNPJ ${esc(EMPRESA.cnpj)}</span><span>${esc(EMPRESA.whatsapp)} • ${esc(EMPRESA.instagram)}</span></footer></section></div><button class="no-print" onclick="window.print()">Imprimir</button></body></html>`;w.document.open();w.document.write(html);w.document.close()}

async function excluirRecibo(id){
  if(!confirm('Excluir este recibo do histórico?'))return;
  try{await api('excluirRecibo',{id});toast('Recibo excluído');carregarRecibos()}catch(e){toast(e.message)}
}

async function carregarFinanceiro(){
  try{
    const j=await api('financeiro');
    $('#fFaturamento').textContent=money(j.faturamentoTotal||0);
    $('#fLucroManutencao').textContent=money(j.lucroManutencao||0);
    $('#fLucroAcessorios').textContent=money(j.lucroAcessorios||0);
    $('#fGastosExtras').textContent=money(j.gastosExtras||0);
    $('#fLucroLiquido').textContent=money(j.lucroLiquido||0);
    state.gastos=j.gastos||[];

    const mov=j.movimentacoes||[];
    $('#financeiroBody').innerHTML=mov.length?mov.map(m=>`<tr>
      <td>${esc(m.data)}</td>
      <td><span class="finance-type ${m.tipo==='Manutenção'?'maintenance':'sale'}">${esc(m.tipo)}</span></td>
      <td><strong>${esc(m.documento)}</strong></td>
      <td>${esc(m.descricao)}</td>
      <td>${money(m.receita)}</td>
      <td>${money(m.custo)}</td>
      <td><strong style="color:${Number(m.lucro)>=0?'#159a5b':'#df4050'}">${money(m.lucro)}</strong></td>
    </tr>`).join(''):'<tr><td colspan="7">Sem movimentações neste mês.</td></tr>';
    renderGastos();
  }catch(e){toast(e.message)}
}

function renderGastos(){
  const body=$('#gastosBody');if(!body)return;
  body.innerHTML=state.gastos.length?state.gastos.map(g=>`<tr>
    <td>${esc(g.data)}</td><td>${esc(g.categoria)}</td><td>${esc(g.descricao)}</td><td><strong>${money(g.valor)}</strong></td>
    <td>${isAdmin()?`<button class="action danger js-gasto-del" data-id="${esc(g.id)}">Excluir</button>`:''}</td>
  </tr>`).join(''):'<tr><td colspan="5">Nenhum gasto lançado.</td></tr>';
  $$('.js-gasto-del').forEach(b=>b.onclick=()=>excluirGasto(b.dataset.id));
}

async function excluirGasto(id){
  if(!confirm('Excluir este gasto?'))return;
  try{await api('excluirGasto',{id});toast('Gasto excluído');carregarFinanceiro()}catch(e){toast(e.message)}
}

async function carregarEstoque(){
  try{
    const j=await api('listarEstoque',{busca:$('#buscaEstoque')?.value||'',status:$('#filtroEstoqueStatus')?.value||''});
    state.estoque=j.produtos||[];
    renderEstoque(j.resumo||{});
  }catch(e){toast(e.message)}
}

function renderEstoque(resumo={}){
  $('#eProdutos').textContent=resumo.produtosAtivos??state.estoque.filter(p=>p.status==='Ativo').length;
  $('#eUnidades').textContent=resumo.unidades??state.estoque.reduce((s,p)=>s+Number(p.quantidade||0),0);
  $('#eCusto').textContent=money(resumo.custoEstoque??state.estoque.reduce((s,p)=>s+Number(p.quantidade||0)*Number(p.custo||0),0));
  $('#eVenda').textContent=money(resumo.potencialVenda??state.estoque.reduce((s,p)=>s+Number(p.quantidade||0)*Number(p.preco||0),0));
  const body=$('#estoqueBody');if(!body)return;
  body.innerHTML=state.estoque.length?state.estoque.map(p=>`<tr>
    <td><strong>${esc(p.nome)}</strong>${Number(p.quantidade)<=Number(p.estoqueMinimo||0)?'<br><small class="low-stock">Estoque baixo</small>':''}</td>
    <td>${esc(p.sku||'-')}</td><td>${esc(p.categoria||'-')}</td><td><strong>${esc(p.quantidade)}</strong></td>
    <td>${money(p.custo)}</td><td>${money(p.preco)}</td><td><strong>${money(p.preco-p.custo)}</strong></td>
    <td>${pill(p.status)}</td>
    <td><div class="actions"><button class="action js-prod-edit" data-id="${esc(p.id)}">Editar</button></div></td>
  </tr>`).join(''):'<tr><td colspan="9">Nenhum produto cadastrado.</td></tr>';
  $$('.js-prod-edit').forEach(b=>b.onclick=()=>abrirProduto(b.dataset.id));
}

function abrirProduto(id=''){
  const f=$('#produtoForm');f.reset();f.elements.id.value='';
  $('#produtoModalTitle').textContent=id?'Editar produto':'Novo produto';
  $('#produtoMsg').textContent='';
  const p=id?state.estoque.find(x=>x.id===id):null;
  if(p){
    f.elements.id.value=p.id;f.elements.nome.value=p.nome;f.elements.sku.value=p.sku||'';f.elements.categoria.value=p.categoria||'';
    f.elements.quantidade.value=p.quantidade;f.elements.estoqueMinimo.value=p.estoqueMinimo||0;f.elements.custo.value=String(p.custo).replace('.',',');f.elements.preco.value=String(p.preco).replace('.',',');f.elements.status.value=p.status;
  }
  $('#produtoModal').classList.remove('hidden');
}

async function carregarUsuarios(){try{const j=await api('listarUsuarios');state.usuarios=j.usuarios||[];renderUsuarios()}catch(e){toast(e.message)}}
function renderUsuarios(){$('#usuariosBody').innerHTML=state.usuarios.map(u=>`<tr><td><strong>${esc(u.nome)}</strong></td><td>${esc(u.usuario)}</td><td>${esc(u.perfil)}</td><td>${pill(u.status)}</td><td><div class="actions"><button class="action js-user-edit" data-id="${esc(u.id)}">Editar</button><button class="action js-user-status" data-id="${esc(u.id)}" data-status="${u.status==='Ativo'?'Inativo':'Ativo'}">${u.status==='Ativo'?'Desativar':'Ativar'}</button></div></td></tr>`).join('');$$('.js-user-edit').forEach(b=>b.onclick=()=>abrirUsuario(b.dataset.id));$$('.js-user-status').forEach(b=>b.onclick=()=>statusUsuario(b.dataset.id,b.dataset.status))}
function abrirUsuario(id=''){const f=$('#userForm');f.reset();const u=state.usuarios.find(x=>x.id===id);f.elements.id.value=id;if(u){f.elements.nome.value=u.nome;f.elements.usuario.value=u.usuario;f.elements.perfil.value=u.perfil;f.elements.status.value=u.status;$('#userModalTitle').textContent='Editar usuário'}else{$('#userModalTitle').textContent='Novo usuário'}$('#userMsg').textContent='';$('#userModal').classList.remove('hidden')}
$('#novoUsuario').onclick=()=>abrirUsuario();$('#closeUserModal').onclick=()=>$('#userModal').classList.add('hidden');
$('#userForm').onsubmit=async e=>{e.preventDefault();const d=formObj(e.currentTarget);if(!d.id&&!d.senha){$('#userMsg').textContent='Informe uma senha de pelo menos 6 caracteres.';return}try{await api('salvarUsuario',d);$('#userModal').classList.add('hidden');toast('Usuário salvo');carregarUsuarios()}catch(err){$('#userMsg').textContent=err.message}};
async function statusUsuario(id,status){try{await api('alterarStatusUsuario',{id,status});toast('Status atualizado');carregarUsuarios()}catch(e){toast(e.message)}}

$('#refreshRetiradas').onclick=carregarRetiradas;
$('#buscarRetirada').onclick=carregarRetiradas;
$('#buscaRetirada').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();carregarRetiradas()}});
$('#filtroRetiradaStatus').onchange=carregarRetiradas;
$('#closeRetiradaModal').onclick=()=>$('#retiradaModal').classList.add('hidden');
$('#retiradaForm').onsubmit=async e=>{e.preventDefault();$('#retiradaMsg').textContent='Salvando...';try{await api('atualizarRetirada',formObj(e.currentTarget));$('#retiradaModal').classList.add('hidden');toast('Agendamento atualizado');carregarRetiradas()}catch(err){$('#retiradaMsg').textContent=err.message}};

$('#novoReciboBtn').onclick=()=>limparFormRecibo();
$('#refreshRecibos').onclick=carregarRecibos;
$('#buscarRecibo').onclick=carregarRecibos;
$('#buscaRecibo').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();carregarRecibos()}});
$('#reciboForm [name=cpf]').addEventListener('input',e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);if(d.length>9)d=d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,'$1.$2.$3-$4');else if(d.length>6)d=d.replace(/(\d{3})(\d{3})(\d{0,3})/,'$1.$2.$3');else if(d.length>3)d=d.replace(/(\d{3})(\d{0,3})/,'$1.$2');e.target.value=d});
$('#addStockItem').onclick=()=>adicionarItemRecibo('estoque');
$('#addQuickItem').onclick=()=>adicionarItemRecibo('rapida');
$('#reciboForm').onsubmit=async e=>{e.preventDefault();atualizarTotalRecibo();const d=formObj(e.currentTarget);d.itens=JSON.stringify(itensPayload());const janela=window.open('','_blank');if(janela)janela.document.write('<!doctype html><title>Gerando recibo...</title><p style="font-family:Arial;padding:30px">Gerando recibo...</p>');$('#reciboMsg').textContent='Salvando venda...';try{const j=await api('salvarRecibo',d);$('#reciboMsg').textContent=`Venda registrada: ${j.numero}`;if(j.recibo)imprimirRecibo(j.recibo,janela);else if(janela)janela.close();toast('Venda registrada e estoque atualizado');await Promise.all([carregarRecibos(),carregarEstoqueParaVenda()]);setTimeout(limparFormRecibo,500)}catch(err){if(janela)janela.close();$('#reciboMsg').textContent=err.message}};

$('#refreshFinanceiro').onclick=carregarFinanceiro;
$('#gastoForm [name=data]').value=new Date().toISOString().slice(0,10);
$('#gastoForm').onsubmit=async e=>{
  e.preventDefault();$('#gastoMsg').textContent='Salvando...';
  try{await api('salvarGasto',formObj(e.currentTarget));e.currentTarget.reset();e.currentTarget.elements.data.value=new Date().toISOString().slice(0,10);$('#gastoMsg').textContent='Gasto adicionado.';toast('Gasto registrado');carregarFinanceiro()}catch(err){$('#gastoMsg').textContent=err.message}
};

$('#novoProdutoBtn').onclick=()=>abrirProduto();
$('#closeProdutoModal').onclick=()=>$('#produtoModal').classList.add('hidden');
$('#buscarEstoque').onclick=carregarEstoque;
$('#buscaEstoque').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();carregarEstoque()}});
$('#filtroEstoqueStatus').onchange=carregarEstoque;
$('#produtoForm').onsubmit=async e=>{
  e.preventDefault();$('#produtoMsg').textContent='Salvando...';
  try{await api('salvarProduto',formObj(e.currentTarget));$('#produtoModal').classList.add('hidden');toast('Produto salvo');await carregarEstoque()}catch(err){$('#produtoMsg').textContent=err.message}
};

(async()=>{
  limparFormOS();
  limparFormRecibo();
  if(!state.token)return;
  try{const j=await api('verificarToken');state.user=j.usuario;showApp()}catch(_){localStorage.removeItem('adones_token')}
})();
