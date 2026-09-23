/**
 * ADONESCELL — Backend Google Apps Script
 * Mesma arquitetura usada no projeto DG Eletros:
 * - site/admin hospedados no Git/Vercel
 * - API JSON via doPost
 * - dados em Google Planilhas
 * - senha armazenada somente como hash
 * - token de sessão salvo na aba Usuarios
 *
 * Instalação: execute configurarSistema() uma vez.
 * O script detecta a planilha vinculada automaticamente e salva o ID.
 */

const CFG = {
  ABAS: {
    ORDENS: 'Ordens',
    RECIBOS: 'Recibos',
    ESTOQUE: 'Estoque',
    GASTOS: 'Gastos',
    RETIRADAS: 'Retiradas',
    USUARIOS: 'Usuarios',
    LOG: 'Log'
  },
  TOKEN_HORAS: 720,
  STATUS: ['Recebido','Em análise','Aguardando peça','Em reparo','Pronto','Entregue','Cancelado'],
  RETIRADA_STATUS: ['Nova solicitação','Aguardando aprovação','Agendado','Em rota para retirada','Aparelho coletado','Na assistência','Pronto','Devolução agendada','Finalizado','Cancelado']
};

function planilha_(){
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty('SPREADSHEET_ID') || '').trim();

  if(id){
    try{
      return SpreadsheetApp.openById(id);
    }catch(err){
      throw new Error('O SPREADSHEET_ID configurado não pôde ser aberto. Verifique se o ID está correto e se você tem acesso à planilha.');
    }
  }

  // Se o Apps Script foi criado por Extensões > Apps Script dentro da planilha,
  // usa automaticamente a planilha vinculada e grava o ID para o Web App.
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if(ativa){
    props.setProperty('SPREADSHEET_ID', ativa.getId());
    return ativa;
  }

  throw new Error('Nenhuma planilha foi vinculada. Abra a planilha > Extensões > Apps Script e execute configurarSistema(), ou configure SPREADSHEET_ID nas Propriedades do script.');
}

function configurarSistema(){
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty('HASH_SALT')) props.setProperty('HASH_SALT', Utilities.getUuid()+Utilities.getUuid());

  let ss;
  const idSalvo = String(props.getProperty('SPREADSHEET_ID') || '').trim();

  if(idSalvo){
    ss = SpreadsheetApp.openById(idSalvo);
  }else{
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if(!ss){
      ss = SpreadsheetApp.create('ADONESCELL - Sistema');
    }
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  criarAba_(ss, CFG.ABAS.ORDENS, [
    'ID','Protocolo','Data de entrada','Cliente','WhatsApp','Aparelho','Modelo','IMEI / Serial',
    'Defeito informado','Diagnóstico','Serviço realizado','Status','Valor cobrado','Custo peça',
    'Outros gastos','Custo total','Lucro','Técnico','Previsão','Observações','Criado por',
    'Data de cadastro','Última atualização','Checklist técnico','Fotos entrada','Fotos pronto'
  ]);
  criarAba_(ss, CFG.ABAS.RECIBOS, [
    'ID','Número','Data','Cliente','CPF','Valor','Forma de pagamento','Descrição','Observações','Emitido por','Data de cadastro',
    'Tipo de venda','Produto ID','Produto','Quantidade','Preço unitário','Custo unitário','Custo total','Lucro','Itens JSON'
  ]);
  criarAba_(ss, CFG.ABAS.ESTOQUE, [
    'ID','Nome','SKU','Categoria','Quantidade','Estoque mínimo','Custo unitário','Preço venda','Status','Data de cadastro','Última atualização'
  ]);
  criarAba_(ss, CFG.ABAS.GASTOS, [
    'ID','Data','Categoria','Descrição','Valor','Criado por','Data de cadastro'
  ]);
  criarAba_(ss, CFG.ABAS.RETIRADAS, [
    'ID','Protocolo','Data solicitação','Cliente','WhatsApp','CEP','Endereço','Número','Complemento','Bairro',
    'Aparelho','Modelo','Problema','Serviço logístico','Data desejada','Período','Status','Data confirmada','Horário confirmado',
    'Observações cliente','Observações internas','OS protocolo','Origem','Campanha','Data de cadastro','Última atualização','Cidade','Estado'
  ]);
  criarAba_(ss, CFG.ABAS.USUARIOS, [
    'ID','Nome','Usuário','Senha Hash','Perfil','Status','Token','Validade token','Data de cadastro'
  ]);
  criarAba_(ss, CFG.ABAS.LOG, ['Data','Ação','ID','Detalhe','Usuário']);

  const sh = ss.getSheetByName(CFG.ABAS.USUARIOS);
  if(sh.getLastRow() < 2){
    sh.appendRow([uid_('USR'),'Administrador','admin',hash_('123456'),'Administrador','Ativo','','',new Date()]);
  }

  // Se a planilha ainda tiver a aba padrão vazia, remove para deixar a estrutura limpa.
  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if(padrao && ss.getSheets().length > 6 && padrao.getLastRow() <= 1 && padrao.getLastColumn() <= 1){
    try{ ss.deleteSheet(padrao); }catch(_){ }
  }

  const pastaFotos = pastaFotosRaiz_();

  const resultado = {
    ok: true,
    mensagem: 'Sistema ADONESCELL configurado com sucesso.',
    planilha: ss.getName(),
    planilhaId: ss.getId(),
    planilhaUrl: ss.getUrl(),
    abas: [CFG.ABAS.ORDENS, CFG.ABAS.RECIBOS, CFG.ABAS.ESTOQUE, CFG.ABAS.GASTOS, CFG.ABAS.RETIRADAS, CFG.ABAS.USUARIOS, CFG.ABAS.LOG],
    loginInicial: 'admin',
    senhaInicial: '123456',
    pastaFotosUrl: pastaFotos.getUrl()
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function verificarInstalacao(){
  const ss = planilha_();
  const abas = ss.getSheets().map(s => s.getName());
  return {
    ok: true,
    planilha: ss.getName(),
    planilhaUrl: ss.getUrl(),
    abas: abas,
    ordens: !!ss.getSheetByName(CFG.ABAS.ORDENS),
    recibos: !!ss.getSheetByName(CFG.ABAS.RECIBOS),
    estoque: !!ss.getSheetByName(CFG.ABAS.ESTOQUE),
    gastos: !!ss.getSheetByName(CFG.ABAS.GASTOS),
    retiradas: !!ss.getSheetByName(CFG.ABAS.RETIRADAS),
    usuarios: !!ss.getSheetByName(CFG.ABAS.USUARIOS),
    log: !!ss.getSheetByName(CFG.ABAS.LOG)
  };
}

function doGet(e){
  try{
    const acao = String(e?.parameter?.acao || '');
    if(acao === 'ping') return json_({ok:true,sistema:'ADONESCELL'});
    if(acao === 'consultarOS') return json_(consultarOSPublica_(e?.parameter?.protocolo || ''));
    return json_({ok:true,sistema:'ADONESCELL',mensagem:'API online'});
  }catch(err){
    return json_({ok:false,erro:msg_(err)});
  }
}

function doPost(e){
  try{
    const d = JSON.parse(e?.postData?.contents || '{}');
    const a = String(d.acao || '');

    if(a === 'login') return json_(login_(d));
    if(a === 'consultarOS') return json_(consultarOSPublica_(d.protocolo));
    if(a === 'salvarRetiradaPublica') return json_(salvarRetiradaPublica_(d));

    const u = auth_(d.token);
    const mapa = {
      verificarToken: () => ({ok:true,usuario:publicUser_(u)}),
      dashboard: () => dashboard_(u),
      listarOrdens: () => listarOrdens_(u,d),
      salvarOrdem: () => salvarOrdem_(u,d),
      atualizarStatusOrdem: () => atualizarStatusOrdem_(u,d),
      adicionarFotosOrdem: () => adicionarFotosOrdem_(u,d),
      excluirOrdem: () => excluirOrdem_(u,d),
      listarRecibos: () => listarRecibos_(u,d),
      salvarRecibo: () => salvarRecibo_(u,d),
      excluirRecibo: () => excluirRecibo_(u,d),
      listarEstoque: () => listarEstoque_(u,d),
      salvarProduto: () => salvarProduto_(u,d),
      financeiro: () => financeiro_(u),
      salvarGasto: () => salvarGasto_(u,d),
      excluirGasto: () => excluirGasto_(u,d),
      listarRetiradas: () => listarRetiradas_(u,d),
      atualizarRetirada: () => atualizarRetirada_(u,d),
      criarOSDeRetirada: () => criarOSDeRetirada_(u,d),
      listarUsuarios: () => listarUsuarios_(u),
      salvarUsuario: () => salvarUsuario_(u,d),
      alterarStatusUsuario: () => alterarStatusUsuario_(u,d)
    };
    if(!mapa[a]) throw new Error('Ação inválida.');
    return json_(mapa[a]());
  }catch(err){
    return json_({ok:false,erro:msg_(err)});
  }
}

function login_(d){
  const usuario = String(d.usuario || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  if(!usuario || !senha) throw new Error('Informe usuário e senha.');

  const sh = planilha_().getSheetByName(CFG.ABAS.USUARIOS);
  if(!sh) throw new Error('Execute configurarSistema() primeiro.');

  const us = objetos_(sh);
  const u = us.find(x =>
    String(x['Usuário'] || '').trim().toLowerCase() === usuario &&
    String(x['Senha Hash'] || '') === hash_(senha) &&
    String(x['Status'] || '') === 'Ativo'
  );
  if(!u) throw new Error('Usuário ou senha inválidos.');

  const token = Utilities.getUuid() + Utilities.getUuid();
  const validade = new Date(Date.now() + CFG.TOKEN_HORAS * 3600000);
  atualizarLinha_(sh,u._linha,{'Token':token,'Validade token':validade});
  return {ok:true,token,usuario:publicUser_(u)};
}

function auth_(token){
  if(!token) throw new Error('Sessão expirada.');
  const sh = planilha_().getSheetByName(CFG.ABAS.USUARIOS);
  const u = objetos_(sh).find(x => String(x.Token || '') === String(token) && String(x.Status || '') === 'Ativo');
  if(!u || new Date(u['Validade token']).getTime() < Date.now()) throw new Error('Sessão expirada.');
  return u;
}

function admin_(u){
  if(String(u.Perfil || '') !== 'Administrador') throw new Error('Acesso permitido somente ao administrador.');
}

function publicUser_(u){
  return {id:u.ID,nome:u.Nome,usuario:u['Usuário'],perfil:u.Perfil};
}

function dashboard_(u){
  const ss=planilha_();
  const ordens = objetos_(ss.getSheetByName(CFG.ABAS.ORDENS)).map(ordemNormalizada_);
  const recibos = objetos_(ss.getSheetByName(CFG.ABAS.RECIBOS)).map(reciboNormalizado_);
  const gastosLista = objetos_(ss.getSheetByName(CFG.ABAS.GASTOS)).map(gastoNormalizado_);
  const agora = new Date();
  const mesmoMes = x => {
    const d = new Date(Number(x.timestamp||0));
    return !isNaN(d) && d.getMonth()===agora.getMonth() && d.getFullYear()===agora.getFullYear();
  };
  const osMes=ordens.filter(o=>mesmoMes(o) && o.status!=='Cancelado');
  const vendasMes=recibos.filter(mesmoMes);
  const gastosMes=gastosLista.filter(mesmoMes);

  const abertas = ordens.filter(o => !['Entregue','Cancelado'].includes(o.status)).length;
  const prontas = ordens.filter(o => o.status === 'Pronto').length;
  const aguardando = ordens.filter(o => o.status === 'Aguardando peça').length;

  const receitaManutencao=osMes.reduce((s,o)=>s+o.valor,0);
  const lucroManutencao=osMes.reduce((s,o)=>s+o.lucro,0);
  const receitaAcessorios=vendasMes.reduce((s,r)=>s+r.valor,0);
  const lucroAcessorios=vendasMes.reduce((s,r)=>s+r.lucro,0);
  const gastosExtras=gastosMes.reduce((s,g)=>s+g.valor,0);
  const receitaTotal=receitaManutencao+receitaAcessorios;
  const lucroLiquido=lucroManutencao+lucroAcessorios-gastosExtras;

  return {ok:true,abertas,prontas,aguardando,receita:receitaTotal,lucro:lucroLiquido,receitaTotal,lucroLiquido,total:ordens.length,status:CFG.STATUS};
}

function listarOrdens_(u,d){
  let ordens = objetos_(planilha_().getSheetByName(CFG.ABAS.ORDENS)).map(ordemNormalizada_);
  const busca = normaliza_(d.busca || '');
  const status = String(d.status || '').trim();
  if(busca) ordens = ordens.filter(o => normaliza_([o.protocolo,o.cliente,o.whatsapp,o.aparelho,o.modelo,o.imei,o.defeito,o.tecnico].join(' ')).includes(busca));
  if(status) ordens = ordens.filter(o => o.status === status);
  ordens.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  return {ok:true,ordens:ordens.slice(0,800),status:CFG.STATUS};
}

function salvarOrdem_(u,d){
  const sh = planilha_().getSheetByName(CFG.ABAS.ORDENS);
  const todos = objetos_(sh);
  const id = String(d.id || '').trim();
  let atual = id ? todos.find(x => String(x.ID || '') === id) : null;

  const cliente = clean_(d.cliente,120);
  const whatsapp = clean_(d.whatsapp,40);
  const modelo = clean_(d.modelo,120);
  const defeito = clean_(d.defeito,900);
  if(!cliente || !whatsapp || !modelo || !defeito) throw new Error('Preencha cliente, WhatsApp, modelo e defeito.');

  const valor = num_(d.valor);
  const custoPeca = num_(d.custoPeca);
  const outrosGastos = num_(d.outrosGastos);
  const custoTotal = custoPeca + outrosGastos;
  const lucro = valor - custoTotal;
  const status = CFG.STATUS.includes(String(d.status)) ? String(d.status) : 'Recebido';
  const agora = new Date();

  const obj = {
    'Cliente':cliente,
    'WhatsApp':whatsapp,
    'Aparelho':clean_(d.aparelho,60) || 'Smartphone',
    'Modelo':modelo,
    'IMEI / Serial':clean_(d.imei,100),
    'Defeito informado':defeito,
    'Diagnóstico':clean_(d.diagnostico,1600),
    'Serviço realizado':clean_(d.servico,1200),
    'Status':status,
    'Valor cobrado':valor,
    'Custo peça':custoPeca,
    'Outros gastos':outrosGastos,
    'Custo total':custoTotal,
    'Lucro':lucro,
    'Técnico':clean_(d.tecnico,120) || u.Nome,
    'Previsão':clean_(d.previsao,80),
    'Observações':clean_(d.observacoes,1800),
    'Checklist técnico':clean_(d.checklist,6000),
    'Última atualização':agora
  };

  if(atual){
    atualizarLinha_(sh,atual._linha,obj);
    log_('EDITAR_OS', atual.ID, atual.Protocolo || '', u);
    const atualizado = objetos_(sh).find(x => String(x.ID || '') === String(atual.ID));
    return {ok:true,id:atual.ID,protocolo:atual.Protocolo,ordem:ordemNormalizada_(atualizado)};
  }

  const novoId = uid_('OS');
  const protocolo = proximoProtocolo_(sh,agora);
  const linha = [
    novoId,protocolo,clean_(d.dataEntrada,40) || Utilities.formatDate(agora,Session.getScriptTimeZone(),'yyyy-MM-dd'),
    cliente,whatsapp,obj['Aparelho'],modelo,obj['IMEI / Serial'],defeito,obj['Diagnóstico'],obj['Serviço realizado'],
    status,valor,custoPeca,outrosGastos,custoTotal,lucro,obj['Técnico'],obj['Previsão'],obj['Observações'],u['Usuário'],agora,agora,obj['Checklist técnico']
  ];
  sh.appendRow(linha);
  log_('CRIAR_OS',novoId,protocolo,u);
  const criado = objetos_(sh).find(x => String(x.ID || '') === String(novoId));
  return {ok:true,id:novoId,protocolo,ordem:ordemNormalizada_(criado)};
}

function atualizarStatusOrdem_(u,d){
  const id = String(d.id || '').trim();
  const status = String(d.status || '').trim();
  if(!id) throw new Error('Ordem não informada.');
  if(!CFG.STATUS.includes(status)) throw new Error('Status inválido.');
  const sh = planilha_().getSheetByName(CFG.ABAS.ORDENS);
  const r = objetos_(sh).find(x => String(x.ID || '') === id);
  if(!r) throw new Error('Ordem não encontrada.');
  atualizarLinha_(sh,r._linha,{'Status':status,'Última atualização':new Date()});
  log_('STATUS_OS',id,(r.Protocolo || '') + ' → ' + status,u);
  return {ok:true,id,protocolo:r.Protocolo,status};
}



function adicionarFotosOrdem_(u,d){
  const id=String(d.id||'').trim();
  const tipo=String(d.tipo||'').trim().toLowerCase();
  if(!id)throw new Error('Ordem não informada.');
  if(!['entrada','pronto'].includes(tipo))throw new Error('Tipo de foto inválido.');
  const fotos=Array.isArray(d.fotos)?d.fotos:[];
  if(!fotos.length)throw new Error('Nenhuma foto enviada.');
  if(fotos.length>6)throw new Error('Envie no máximo 6 fotos por vez.');

  const sh=planilha_().getSheetByName(CFG.ABAS.ORDENS);
  const r=objetos_(sh).find(x=>String(x.ID||'')===id);
  if(!r)throw new Error('Ordem não encontrada.');

  const coluna=tipo==='entrada'?'Fotos entrada':'Fotos pronto';
  const existentes=fotosObj_(r[coluna]);
  const pastaOS=pastaOS_(String(r.Protocolo||id));
  const nomeSub=tipo==='entrada'?'Entrada':'Pronto';
  const sub=pastaFilha_(pastaOS,nomeSub);
  const novas=[];

  fotos.forEach((f,i)=>{
    const mime=String(f.mime||'image/jpeg');
    if(!/^image\//i.test(mime))throw new Error('Arquivo de foto inválido.');
    const b64=String(f.base64||'');
    if(!b64)throw new Error('Uma das fotos veio vazia.');
    const bytes=Utilities.base64Decode(b64);
    if(bytes.length>1500000)throw new Error('Uma das fotos ficou muito grande. Tente novamente.');
    const ext=mime.includes('png')?'png':'jpg';
    const nome=(String(r.Protocolo||'OS')+'-'+tipo+'-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+(i+1)+'.'+ext);
    const blob=Utilities.newBlob(bytes,mime,nome);
    const file=sub.createFile(blob);
    try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(_){ }
    const fid=file.getId();
    novas.push({id:fid,nome:file.getName(),url:'https://drive.google.com/thumbnail?id='+fid+'&sz=w1200',viewUrl:'https://drive.google.com/file/d/'+fid+'/view',tipo,data:fmtDataHora_(new Date())});
  });

  const todas=existentes.concat(novas).slice(-30);
  atualizarLinha_(sh,r._linha,{[coluna]:JSON.stringify(todas),'Última atualização':new Date()});
  log_('FOTOS_OS',id,(r.Protocolo||'')+' • '+tipo+' • '+novas.length+' foto(s)',u);
  const atualizado=objetos_(sh).find(x=>String(x.ID||'')===id);
  return {ok:true,fotos:novas,ordem:ordemNormalizada_(atualizado)};
}

function pastaFotosRaiz_(){
  const props=PropertiesService.getScriptProperties();
  const salvo=String(props.getProperty('FOTOS_FOLDER_ID')||'').trim();
  if(salvo){try{return DriveApp.getFolderById(salvo);}catch(_){ }}
  const nome='ADONESCELL - Fotos das OS';
  const it=DriveApp.getFoldersByName(nome);
  const pasta=it.hasNext()?it.next():DriveApp.createFolder(nome);
  props.setProperty('FOTOS_FOLDER_ID',pasta.getId());
  return pasta;
}
function pastaOS_(protocolo){return pastaFilha_(pastaFotosRaiz_(),clean_(protocolo,80)||'SEM-PROTOCOLO');}
function pastaFilha_(pai,nome){const it=pai.getFoldersByName(nome);return it.hasNext()?it.next():pai.createFolder(nome);}
function fotosObj_(v){
  if(Array.isArray(v))return v;
  const s=String(v||'').trim();if(!s)return[];
  try{const a=JSON.parse(s);return Array.isArray(a)?a:[];}catch(_){return[];}
}

function excluirOrdem_(u,d){
  admin_(u);
  const id = String(d.id || '');
  const sh = planilha_().getSheetByName(CFG.ABAS.ORDENS);
  const r = objetos_(sh).find(x => String(x.ID || '') === id);
  if(!r) throw new Error('Ordem não encontrada.');
  sh.deleteRow(r._linha);
  log_('EXCLUIR_OS',id,r.Protocolo || '',u);
  return {ok:true};
}


function listarRecibos_(u,d){
  let recibos = objetos_(planilha_().getSheetByName(CFG.ABAS.RECIBOS)).map(reciboNormalizado_);
  const busca = normaliza_(d.busca || '');
  if(busca) recibos = recibos.filter(r => normaliza_([r.numero,r.cliente,r.cpf,r.formaPagamento,r.descricao,r.produto,r.tipoVenda].join(' ')).includes(busca));
  recibos.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  return {ok:true,recibos:recibos.slice(0,1000)};
}

function salvarRecibo_(u,d){
  const ss=planilha_();
  const sh=ss.getSheetByName(CFG.ABAS.RECIBOS);
  const shEstoque=ss.getSheetByName(CFG.ABAS.ESTOQUE);
  if(!sh) throw new Error('Execute configurarSistema() para criar a aba Recibos.');

  const cliente=clean_(d.cliente,160);
  const cpf=clean_(d.cpf,30);
  const forma=clean_(d.formaPagamento,60)||'PIX';
  const observacoes=clean_(d.observacoes,1200);
  if(!cliente) throw new Error('Informe o nome do cliente.');
  if(!cpf) throw new Error('Informe o CPF do cliente.');

  let itensEntrada=[];
  try{
    if(d.itens) itensEntrada=JSON.parse(String(d.itens));
  }catch(_){throw new Error('Os itens do recibo estão inválidos.');}

  // Compatibilidade com a versão anterior do formulário.
  if(!Array.isArray(itensEntrada)||!itensEntrada.length){
    const tipo=String(d.tipoVenda||'rapida').toLowerCase();
    if(tipo==='estoque') itensEntrada=[{tipo:'estoque',produtoId:d.produtoId,quantidade:d.quantidade}];
    else itensEntrada=[{tipo:'rapida',descricao:d.descricaoRapida||d.descricao,quantidade:1,preco:d.valorRapido||d.valor,custo:d.custoRapido||0}];
  }
  if(itensEntrada.length>30) throw new Error('O recibo aceita no máximo 30 itens.');

  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const estoque=objetos_(shEstoque);
    const necessidade={};
    itensEntrada.forEach(i=>{
      if(String(i.tipo||'').toLowerCase()==='estoque'){
        const id=String(i.produtoId||'').trim();
        const qtd=Math.max(1,parseInt(i.quantidade,10)||1);
        if(id) necessidade[id]=(necessidade[id]||0)+qtd;
      }
    });
    Object.keys(necessidade).forEach(id=>{
      const item=estoque.find(x=>String(x.ID||'')===id);
      if(!item) throw new Error('Um dos produtos não foi encontrado no estoque.');
      if(String(item.Status||'Ativo')!=='Ativo') throw new Error('O produto '+String(item.Nome||'')+' está inativo.');
      const disp=Math.max(0,parseInt(item.Quantidade,10)||0);
      if(disp<necessidade[id]) throw new Error('Estoque insuficiente para '+String(item.Nome||'')+'. Disponível: '+disp+' unidade(s).');
    });

    const itens=[];
    itensEntrada.forEach((i,idx)=>{
      const tipo=String(i.tipo||'rapida').toLowerCase()==='estoque'?'estoque':'rapida';
      const qtd=Math.max(1,parseInt(i.quantidade,10)||1);
      if(tipo==='estoque'){
        const produtoId=String(i.produtoId||'').trim();
        const item=estoque.find(x=>String(x.ID||'')===produtoId);
        if(!item) throw new Error('Selecione o produto do item '+(idx+1)+'.');
        const preco=num_(item['Preço venda']);
        const custo=num_(item['Custo unitário']);
        itens.push({tipo:'Estoque',produtoId,nome:clean_(item.Nome,220),quantidade:qtd,precoUnitario:preco,custoUnitario:custo,total:preco*qtd,custoTotal:custo*qtd});
      }else{
        const nome=clean_(i.descricao||i.nome,400);
        const preco=num_(i.preco||i.valor);
        const custo=num_(i.custo||0);
        if(!nome) throw new Error('Informe a descrição do item '+(idx+1)+'.');
        if(preco<=0) throw new Error('Informe o valor do item '+(idx+1)+'.');
        itens.push({tipo:'Venda rápida',produtoId:'',nome,quantidade:qtd,precoUnitario:preco,custoUnitario:custo,total:preco*qtd,custoTotal:custo*qtd});
      }
    });

    Object.keys(necessidade).forEach(id=>{
      const item=estoque.find(x=>String(x.ID||'')===id);
      const disp=Math.max(0,parseInt(item.Quantidade,10)||0);
      atualizarLinha_(shEstoque,item._linha,{'Quantidade':disp-necessidade[id],'Última atualização':new Date()});
    });

    const valor=itens.reduce((s,i)=>s+i.total,0);
    const custoTotal=itens.reduce((s,i)=>s+i.custoTotal,0);
    const lucro=valor-custoTotal;
    const quantidade=itens.reduce((s,i)=>s+i.quantidade,0);
    const nomes=itens.map(i=>i.nome);
    const descricao=nomes.length<=2?nomes.join(' + '):(nomes[0]+' + '+(nomes.length-1)+' item(ns)');
    const tipos=[...new Set(itens.map(i=>i.tipo))];
    const tipoVenda=itens.length>1?(tipos.length>1?'Mista':'Múltiplos itens'):tipos[0];
    const primeiro=itens[0];
    const agora=new Date();
    const data=clean_(d.data,40)||Utilities.formatDate(agora,Session.getScriptTimeZone(),'yyyy-MM-dd');
    const id=uid_('REC');
    const numero=proximoRecibo_(sh,agora);
    sh.appendRow([id,numero,data,cliente,cpf,valor,forma,descricao,observacoes,u['Usuário'],agora,tipoVenda,primeiro.produtoId||'',descricao,quantidade,primeiro.precoUnitario,primeiro.custoUnitario,custoTotal,lucro,JSON.stringify(itens)]);
    log_('CRIAR_VENDA',id,numero+' • '+cliente+' • '+descricao,u);
    const criado=objetos_(sh).find(x=>String(x.ID||'')===id);
    return {ok:true,id,numero,recibo:reciboNormalizado_(criado)};
  }finally{lock.releaseLock();}
}

function excluirRecibo_(u,d){
  admin_(u);
  const ss=planilha_();
  const sh=ss.getSheetByName(CFG.ABAS.RECIBOS);
  const r=objetos_(sh).find(x=>String(x.ID||'')===String(d.id||''));
  if(!r) throw new Error('Recibo não encontrado.');
  const normal=reciboNormalizado_(r);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const shEstoque=ss.getSheetByName(CFG.ABAS.ESTOQUE);
    const estoque=objetos_(shEstoque);
    const devolver={};
    (normal.itens||[]).forEach(i=>{if(i.produtoId)devolver[i.produtoId]=(devolver[i.produtoId]||0)+Math.max(1,parseInt(i.quantidade,10)||1)});
    Object.keys(devolver).forEach(id=>{
      const item=estoque.find(x=>String(x.ID||'')===id);
      if(item) atualizarLinha_(shEstoque,item._linha,{'Quantidade':Math.max(0,parseInt(item.Quantidade,10)||0)+devolver[id],'Última atualização':new Date()});
    });
    sh.deleteRow(r._linha);
    log_('EXCLUIR_VENDA',r.ID,r['Número']||'',u);
    return {ok:true};
  }finally{lock.releaseLock();}
}

function reciboNormalizado_(r){
  const dt=data_(r.Data)||data_(r['Data de cadastro']);
  const valor=num_(r.Valor),custo=num_(r['Custo total']);
  let itens=[];
  const bruto=String(r['Itens JSON']||'').trim();
  if(bruto){try{const x=JSON.parse(bruto);if(Array.isArray(x))itens=x;}catch(_){}}
  if(!itens.length){
    itens=[{tipo:String(r['Tipo de venda']||'Venda rápida'),produtoId:String(r['Produto ID']||''),nome:String(r.Produto||r['Descrição']||''),quantidade:Math.max(1,parseInt(r.Quantidade,10)||1),precoUnitario:num_(r['Preço unitário'])||valor,custoUnitario:num_(r['Custo unitário']),total:valor,custoTotal:custo}];
  }
  itens=itens.map(i=>({tipo:String(i.tipo||'Venda rápida'),produtoId:String(i.produtoId||''),nome:String(i.nome||i.descricao||''),quantidade:Math.max(1,parseInt(i.quantidade,10)||1),precoUnitario:num_(i.precoUnitario),custoUnitario:num_(i.custoUnitario),total:num_(i.total),custoTotal:num_(i.custoTotal)}));
  return {
    id:String(r.ID||''),numero:String(r['Número']||''),data:fmtData_(r.Data),cliente:String(r.Cliente||''),cpf:String(r.CPF||''),valor,
    formaPagamento:String(r['Forma de pagamento']||''),descricao:String(r['Descrição']||''),observacoes:String(r['Observações']||''),emitidoPor:String(r['Emitido por']||''),
    tipoVenda:String(r['Tipo de venda']||'Venda rápida'),produtoId:String(r['Produto ID']||''),produto:String(r.Produto||r['Descrição']||''),
    quantidade:itens.reduce((s,i)=>s+i.quantidade,0),precoUnitario:num_(r['Preço unitário'])||valor,custoUnitario:num_(r['Custo unitário']),custoTotal:custo,
    lucro:r.Lucro===''||r.Lucro===null||typeof r.Lucro==='undefined'?valor-custo:num_(r.Lucro),itens,
    dataCadastro:fmtDataHora_(r['Data de cadastro']),timestamp:dt?dt.getTime():0
  };
}

function proximoRecibo_(sh,d){
  const prefix='REC'+Utilities.formatDate(d,Session.getScriptTimeZone(),'yyMMdd');
  let maior=0;
  if(sh.getLastRow()>1){
    const nums=sh.getRange(2,2,sh.getLastRow()-1,1).getValues().flat().map(String);
    nums.forEach(n=>{
      if(n.indexOf(prefix+'-')===0){
        const v=parseInt(n.split('-').pop(),10);
        if(isFinite(v)) maior=Math.max(maior,v);
      }
    });
  }
  return prefix+'-'+String(maior+1).padStart(4,'0');
}

function listarEstoque_(u,d){
  const sh=planilha_().getSheetByName(CFG.ABAS.ESTOQUE);
  let produtos=objetos_(sh).map(produtoNormalizado_);
  const busca=normaliza_(d.busca||'');
  const status=String(d.status||'').trim();
  if(busca) produtos=produtos.filter(p=>normaliza_([p.nome,p.sku,p.categoria].join(' ')).includes(busca));
  if(status) produtos=produtos.filter(p=>p.status===status);
  produtos.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const ativos=produtos.filter(p=>p.status==='Ativo');
  const resumo={
    produtosAtivos:ativos.length,
    unidades:ativos.reduce((s,p)=>s+p.quantidade,0),
    custoEstoque:ativos.reduce((s,p)=>s+p.quantidade*p.custo,0),
    potencialVenda:ativos.reduce((s,p)=>s+p.quantidade*p.preco,0)
  };
  return {ok:true,produtos,resumo};
}

function salvarProduto_(u,d){
  admin_(u);
  const sh=planilha_().getSheetByName(CFG.ABAS.ESTOQUE);
  const todos=objetos_(sh);
  const id=String(d.id||'').trim();
  const atual=id?todos.find(x=>String(x.ID||'')===id):null;
  const nome=clean_(d.nome,220);
  const sku=clean_(d.sku,80);
  const categoria=clean_(d.categoria,120);
  const quantidade=Math.max(0,parseInt(d.quantidade,10)||0);
  const estoqueMinimo=Math.max(0,parseInt(d.estoqueMinimo,10)||0);
  const custo=num_(d.custo);
  const preco=num_(d.preco);
  const status=String(d.status)==='Inativo'?'Inativo':'Ativo';
  if(!nome)throw new Error('Informe o nome do produto.');
  if(preco<=0)throw new Error('Informe o preço de venda.');
  if(sku && todos.some(x=>String(x.SKU||'').trim().toLowerCase()===sku.toLowerCase() && (!atual||x._linha!==atual._linha)))throw new Error('Já existe um produto com esse SKU.');
  const agora=new Date();
  if(atual){
    atualizarLinha_(sh,atual._linha,{'Nome':nome,'SKU':sku,'Categoria':categoria,'Quantidade':quantidade,'Estoque mínimo':estoqueMinimo,'Custo unitário':custo,'Preço venda':preco,'Status':status,'Última atualização':agora});
    log_('EDITAR_PRODUTO',atual.ID,nome,u);
    return {ok:true,id:atual.ID};
  }
  const novoId=uid_('PROD');
  sh.appendRow([novoId,nome,sku,categoria,quantidade,estoqueMinimo,custo,preco,status,agora,agora]);
  log_('CRIAR_PRODUTO',novoId,nome,u);
  return {ok:true,id:novoId};
}

function produtoNormalizado_(r){
  return {
    id:String(r.ID||''),nome:String(r.Nome||''),sku:String(r.SKU||''),categoria:String(r.Categoria||''),
    quantidade:Math.max(0,parseInt(r.Quantidade,10)||0),estoqueMinimo:Math.max(0,parseInt(r['Estoque mínimo'],10)||0),
    custo:num_(r['Custo unitário']),preco:num_(r['Preço venda']),status:String(r.Status||'Ativo'),
    dataCadastro:fmtDataHora_(r['Data de cadastro']),atualizado:fmtDataHora_(r['Última atualização'])
  };
}

function financeiro_(u){
  admin_(u);
  const ss=planilha_(),agora=new Date();
  const mesmoMes=x=>{
    const d=new Date(Number(x.timestamp||0));
    return !isNaN(d)&&d.getMonth()===agora.getMonth()&&d.getFullYear()===agora.getFullYear();
  };
  const ordens=objetos_(ss.getSheetByName(CFG.ABAS.ORDENS)).map(ordemNormalizada_).filter(o=>mesmoMes(o)&&o.status!=='Cancelado');
  const vendas=objetos_(ss.getSheetByName(CFG.ABAS.RECIBOS)).map(reciboNormalizado_).filter(mesmoMes);
  const gastos=objetos_(ss.getSheetByName(CFG.ABAS.GASTOS)).map(gastoNormalizado_).filter(mesmoMes);

  const receitaManutencao=ordens.reduce((s,o)=>s+o.valor,0);
  const custoManutencao=ordens.reduce((s,o)=>s+o.custoTotal,0);
  const lucroManutencao=ordens.reduce((s,o)=>s+o.lucro,0);
  const receitaAcessorios=vendas.reduce((s,r)=>s+r.valor,0);
  const custoAcessorios=vendas.reduce((s,r)=>s+r.custoTotal,0);
  const lucroAcessorios=vendas.reduce((s,r)=>s+r.lucro,0);
  const gastosExtras=gastos.reduce((s,g)=>s+g.valor,0);
  const faturamentoTotal=receitaManutencao+receitaAcessorios;
  const lucroLiquido=lucroManutencao+lucroAcessorios-gastosExtras;

  const movimentacoes=[
    ...ordens.map(o=>({timestamp:o.timestamp,data:o.dataEntrada,tipo:'Manutenção',documento:o.protocolo,descricao:o.cliente+' • '+o.modelo,receita:o.valor,custo:o.custoTotal,lucro:o.lucro})),
    ...vendas.map(r=>({timestamp:r.timestamp,data:r.data,tipo:'Acessório',documento:r.numero,descricao:r.cliente+' • '+(r.produto||r.descricao),receita:r.valor,custo:r.custoTotal,lucro:r.lucro}))
  ].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,1000);

  return {ok:true,faturamentoTotal,receitaManutencao,custoManutencao,lucroManutencao,receitaAcessorios,custoAcessorios,lucroAcessorios,gastosExtras,lucroLiquido,movimentacoes,gastos};
}

function salvarGasto_(u,d){
  admin_(u);
  const sh=planilha_().getSheetByName(CFG.ABAS.GASTOS);
  const descricao=clean_(d.descricao,500);
  const categoria=clean_(d.categoria,100)||'Outros';
  const valor=num_(d.valor);
  if(!descricao)throw new Error('Informe a descrição do gasto.');
  if(valor<=0)throw new Error('Informe o valor do gasto.');
  const agora=new Date();
  const data=clean_(d.data,40)||Utilities.formatDate(agora,Session.getScriptTimeZone(),'yyyy-MM-dd');
  const id=uid_('GAS');
  sh.appendRow([id,data,categoria,descricao,valor,u['Usuário'],agora]);
  log_('CRIAR_GASTO',id,descricao+' • '+valor,u);
  return {ok:true,id};
}

function excluirGasto_(u,d){
  admin_(u);
  const sh=planilha_().getSheetByName(CFG.ABAS.GASTOS);
  const r=objetos_(sh).find(x=>String(x.ID||'')===String(d.id||''));
  if(!r)throw new Error('Gasto não encontrado.');
  sh.deleteRow(r._linha);
  log_('EXCLUIR_GASTO',r.ID,r['Descrição']||'',u);
  return {ok:true};
}

function gastoNormalizado_(r){
  const dt=data_(r.Data)||data_(r['Data de cadastro']);
  return {id:String(r.ID||''),data:fmtData_(r.Data),categoria:String(r.Categoria||''),descricao:String(r['Descrição']||''),valor:num_(r.Valor),criadoPor:String(r['Criado por']||''),timestamp:dt?dt.getTime():0};
}

function listarUsuarios_(u){
  admin_(u);
  const usuarios = objetos_(planilha_().getSheetByName(CFG.ABAS.USUARIOS)).map(x=>({
    id:x.ID,nome:x.Nome,usuario:x['Usuário'],perfil:x.Perfil,status:x.Status,data:x['Data de cadastro']
  }));
  return {ok:true,usuarios};
}

function salvarUsuario_(u,d){
  admin_(u);
  const sh = planilha_().getSheetByName(CFG.ABAS.USUARIOS);
  const todos = objetos_(sh);
  const id = String(d.id || '').trim();
  let atual = id ? todos.find(x=>String(x.ID||'')===id) : null;
  const nome = clean_(d.nome,120);
  const usuario = clean_(d.usuario,80).toLowerCase();
  const perfil = ['Administrador','Técnico','Atendente'].includes(String(d.perfil)) ? String(d.perfil) : 'Técnico';
  const status = String(d.status)==='Inativo' ? 'Inativo' : 'Ativo';
  const senha = String(d.senha || '');
  if(!nome || !usuario) throw new Error('Informe nome e usuário.');
  if(!atual && senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
  if(todos.some(x=>String(x['Usuário']||'').toLowerCase()===usuario && (!atual || x._linha!==atual._linha))) throw new Error('Esse usuário já existe.');

  if(atual){
    const dados = {'Nome':nome,'Usuário':usuario,'Perfil':perfil,'Status':status};
    if(senha) dados['Senha Hash']=hash_(senha);
    atualizarLinha_(sh,atual._linha,dados);
    return {ok:true};
  }
  sh.appendRow([uid_('USR'),nome,usuario,hash_(senha),perfil,status,'','',new Date()]);
  return {ok:true};
}

function alterarStatusUsuario_(u,d){
  admin_(u);
  const sh = planilha_().getSheetByName(CFG.ABAS.USUARIOS);
  const r = objetos_(sh).find(x=>String(x.ID||'')===String(d.id||''));
  if(!r) throw new Error('Usuário não encontrado.');
  if(String(r.ID)===String(u.ID) && String(d.status)==='Inativo') throw new Error('Você não pode desativar seu próprio usuário.');
  atualizarLinha_(sh,r._linha,{'Status':String(d.status)==='Inativo'?'Inativo':'Ativo','Token':'','Validade token':''});
  return {ok:true};
}

function salvarRetiradaPublica_(d){
  const sh=planilha_().getSheetByName(CFG.ABAS.RETIRADAS);
  if(!sh) throw new Error('Sistema de retirada ainda não foi configurado.');
  const cliente=clean_(d.cliente,160),whatsapp=clean_(d.whatsapp,40),endereco=clean_(d.endereco,220),numero=clean_(d.numero,40),modelo=clean_(d.modelo,140),problema=clean_(d.problema,1200);
  if(!cliente||!whatsapp||!endereco||!numero||!modelo||!problema) throw new Error('Preencha nome, WhatsApp, endereço, número, modelo e problema.');
  const agora=new Date(),id=uid_('RET'),protocolo=proximoRetirada_(sh,agora);
  const status='Nova solicitação';
  sh.appendRow([id,protocolo,Utilities.formatDate(agora,Session.getScriptTimeZone(),'yyyy-MM-dd'),cliente,whatsapp,clean_(d.cep,20),endereco,numero,clean_(d.complemento,120),clean_(d.bairro,120),clean_(d.aparelho,60)||'Smartphone',modelo,problema,clean_(d.tipoLogistica,80)||'Retirada',clean_(d.dataDesejada,40),clean_(d.periodo,60),status,'','',clean_(d.observacoes,1200),'','',clean_(d.utmSource,120),clean_(d.utmCampaign,160),agora,agora,clean_(d.cidade,120),clean_(d.estado,2).toUpperCase()]);
  logPublico_('NOVA_RETIRADA',id,protocolo+' • '+cliente);
  return {ok:true,id,protocolo,status,mensagem:'Solicitação recebida. A ADONES CELL entrará em contato pelo WhatsApp para confirmar o agendamento.'};
}

function listarRetiradas_(u,d){
  const sh=planilha_().getSheetByName(CFG.ABAS.RETIRADAS);
  let lista=objetos_(sh).map(retiradaNormalizada_);
  const busca=normaliza_(d.busca||''),status=String(d.status||'').trim();
  if(busca) lista=lista.filter(r=>normaliza_([r.protocolo,r.cliente,r.whatsapp,r.endereco,r.bairro,r.cidade,r.estado,r.modelo,r.problema,r.osProtocolo].join(' ')).includes(busca));
  if(status) lista=lista.filter(r=>r.status===status);
  lista.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
  return {ok:true,retiradas:lista.slice(0,1000),status:CFG.RETIRADA_STATUS};
}

function atualizarRetirada_(u,d){
  const sh=planilha_().getSheetByName(CFG.ABAS.RETIRADAS);
  const r=objetos_(sh).find(x=>String(x.ID||'')===String(d.id||''));
  if(!r) throw new Error('Solicitação não encontrada.');
  const status=CFG.RETIRADA_STATUS.includes(String(d.status))?String(d.status):String(r.Status||'Nova solicitação');
  atualizarLinha_(sh,r._linha,{'Status':status,'Data confirmada':clean_(d.dataConfirmada,40),'Horário confirmado':clean_(d.horarioConfirmado,60),'Observações internas':clean_(d.observacoesInternas,1600),'Última atualização':new Date()});
  log_('ATUALIZAR_RETIRADA',r.ID,(r.Protocolo||'')+' → '+status,u);
  const atualizado=objetos_(sh).find(x=>String(x.ID||'')===String(r.ID));
  return {ok:true,retirada:retiradaNormalizada_(atualizado)};
}

function criarOSDeRetirada_(u,d){
  const sh=planilha_().getSheetByName(CFG.ABAS.RETIRADAS);
  const r=objetos_(sh).find(x=>String(x.ID||'')===String(d.id||''));
  if(!r) throw new Error('Solicitação não encontrada.');
  if(String(r['OS protocolo']||'').trim()) throw new Error('Essa retirada já possui uma OS: '+String(r['OS protocolo']));
  const obs=['Solicitação de retirada: '+String(r.Protocolo||''),'Endereço: '+[r.Endereço,r.Número,r.Complemento,r.Bairro,r.Cidade,r.Estado,r.CEP].filter(Boolean).join(', '),'Logística: '+String(r['Serviço logístico']||'Retirada')].join('\n');
  const criado=salvarOrdem_(u,{cliente:r.Cliente,whatsapp:r.WhatsApp,aparelho:r.Aparelho||'Smartphone',modelo:r.Modelo,defeito:r.Problema,status:'Recebido',dataEntrada:Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd'),observacoes:obs,checklist:'{}'});
  atualizarLinha_(sh,r._linha,{'OS protocolo':criado.protocolo,'Status':'Na assistência','Última atualização':new Date()});
  log_('RETIRADA_PARA_OS',r.ID,(r.Protocolo||'')+' → '+criado.protocolo,u);
  return {ok:true,protocolo:criado.protocolo,ordem:criado.ordem};
}

function retiradaNormalizada_(r){
  const dt=data_(r['Data de cadastro'])||data_(r['Data solicitação']);
  return {id:String(r.ID||''),protocolo:String(r.Protocolo||''),dataSolicitacao:fmtDataSeguro_(r['Data solicitação']),cliente:String(r.Cliente||''),whatsapp:String(r.WhatsApp||''),cep:String(r.CEP||''),endereco:String(r.Endereço||''),numero:String(r.Número||''),complemento:String(r.Complemento||''),bairro:String(r.Bairro||''),cidade:String(r.Cidade||''),estado:String(r.Estado||''),aparelho:String(r.Aparelho||''),modelo:String(r.Modelo||''),problema:String(r.Problema||''),tipoLogistica:String(r['Serviço logístico']||''),dataDesejada:fmtDataSeguro_(r['Data desejada']),periodo:String(r.Período||''),status:String(r.Status||'Nova solicitação'),dataConfirmada:fmtDataSeguro_(r['Data confirmada']),horarioConfirmado:String(r['Horário confirmado']||''),observacoesCliente:String(r['Observações cliente']||''),observacoesInternas:String(r['Observações internas']||''),osProtocolo:String(r['OS protocolo']||''),atualizado:fmtDataHora_(r['Última atualização']),timestamp:dt?dt.getTime():0};
}

function fmtDataSeguro_(v){
  if(v instanceof Date) return Utilities.formatDate(v,Session.getScriptTimeZone(),'dd/MM/yyyy');
  const s=String(v||'').trim();
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return m[3]+'/'+m[2]+'/'+m[1];
  return fmtData_(v);
}

function proximoRetirada_(sh,d){
  const prefix='RET'+Utilities.formatDate(d,Session.getScriptTimeZone(),'yyMMdd');let maior=0;
  if(sh.getLastRow()>1){sh.getRange(2,2,sh.getLastRow()-1,1).getValues().flat().map(String).forEach(n=>{if(n.indexOf(prefix+'-')===0){const v=parseInt(n.split('-').pop(),10);if(isFinite(v))maior=Math.max(maior,v)}})}
  return prefix+'-'+String(maior+1).padStart(4,'0');
}

function logPublico_(acao,id,detalhe){
  try{const sh=planilha_().getSheetByName(CFG.ABAS.LOG);if(sh)sh.appendRow([new Date(),acao,id,detalhe,'site']);}catch(_){ }
}

function consultarOSPublica_(protocolo){
  protocolo = clean_(protocolo,60).toUpperCase();
  if(!protocolo) throw new Error('Informe o protocolo.');
  const r = objetos_(planilha_().getSheetByName(CFG.ABAS.ORDENS)).find(x => String(x.Protocolo || '').toUpperCase() === protocolo);
  if(!r) throw new Error('Protocolo não encontrado.');
  const o = ordemNormalizada_(r);
  return {ok:true,ordem:{
    protocolo:o.protocolo,dataEntrada:o.dataEntrada,aparelho:o.aparelho,modelo:o.modelo,
    status:o.status,diagnostico:o.diagnostico,servico:o.servico,previsao:o.previsao,
    atualizado:o.atualizado,fotosEntrada:o.fotosEntrada,fotosPronto:o.fotosPronto
  }};
}

function ordemNormalizada_(r){
  const dt = r['Data de cadastro'] || r['Data de entrada'];
  const d = data_(dt);
  return {
    id:String(r.ID||''),protocolo:String(r.Protocolo||''),dataEntrada:fmtData_(r['Data de entrada']),
    cliente:String(r.Cliente||''),whatsapp:String(r.WhatsApp||''),aparelho:String(r.Aparelho||''),modelo:String(r.Modelo||''),
    imei:String(r['IMEI / Serial']||''),defeito:String(r['Defeito informado']||''),diagnostico:String(r['Diagnóstico']||''),
    servico:String(r['Serviço realizado']||''),status:String(r.Status||'Recebido'),valor:num_(r['Valor cobrado']),
    custoPeca:num_(r['Custo peça']),outrosGastos:num_(r['Outros gastos']),custoTotal:num_(r['Custo total']),lucro:num_(r.Lucro),
    tecnico:String(r['Técnico']||''),previsao:String(r['Previsão']||''),observacoes:String(r['Observações']||''),
    checklist:checklistObj_(r['Checklist técnico']),
    fotosEntrada:fotosObj_(r['Fotos entrada']),fotosPronto:fotosObj_(r['Fotos pronto']),
    criadoPor:String(r['Criado por']||''),dataCadastro:fmtDataHora_(r['Data de cadastro']),atualizado:fmtDataHora_(r['Última atualização']),
    timestamp:d?d.getTime():0
  };
}

function checklistObj_(v){
  if(v && typeof v === 'object') return v;
  const s=String(v || '').trim();
  if(!s) return {};
  try{const o=JSON.parse(s);return o && typeof o === 'object' ? o : {};}catch(_){return {};}
}

function criarAba_(ss,nome,cab){
  let sh=ss.getSheetByName(nome);
  if(!sh) sh=ss.insertSheet(nome);
  if(sh.getMaxColumns()<cab.length) sh.insertColumnsAfter(sh.getMaxColumns(),cab.length-sh.getMaxColumns());
  if(sh.getLastRow()<1) sh.insertRows(1);
  const largura=Math.max(sh.getLastColumn(),cab.length);
  const atual=sh.getRange(1,1,1,largura).getValues()[0].map(v=>String(v).trim());
  cab.forEach((c,i)=>{if(atual[i]!==c)sh.getRange(1,i+1).setValue(c);});
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,cab.length).setFontWeight('bold').setBackground('#0a63ff').setFontColor('#ffffff');
  return sh;
}

function objetos_(sh){
  if(!sh || sh.getLastRow()<2) return [];
  const v=sh.getDataRange().getValues(),cab=v[0].map(String);
  return v.slice(1).map((row,i)=>{const o={_linha:i+2};cab.forEach((h,j)=>o[h]=row[j]);return o;});
}

function atualizarLinha_(sh,linha,obj){
  const cab=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  Object.keys(obj).forEach(k=>{const i=cab.indexOf(k);if(i>=0)sh.getRange(linha,i+1).setValue(obj[k]);});
}

function proximoProtocolo_(sh,d){
  const prefix='AD'+Utilities.formatDate(d,Session.getScriptTimeZone(),'yyMMdd');
  const n=Math.max(1,sh.getLastRow());
  return prefix+'-'+String(n).padStart(4,'0');
}

function hash_(s){
  const salt=PropertiesService.getScriptProperties().getProperty('HASH_SALT')||'ADONESCELL';
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+'|'+String(s),Utilities.Charset.UTF_8);
  return bytes.map(b=>('0'+((b<0?b+256:b).toString(16))).slice(-2)).join('');
}

function uid_(p){return p+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();}
function num_(v){const s=String(v??'').replace(/R\$/gi,'').trim();if(!s)return 0;const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s.replace(/[^0-9.-]/g,''));return isFinite(n)?n:0;}
function clean_(v,max){return String(v??'').replace(/[<>]/g,'').trim().slice(0,max||1000);}
function normaliza_(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function data_(v){if(v instanceof Date)return isNaN(v)?null:v;const d=new Date(v);return isNaN(d)?null:d;}
function fmtData_(v){const d=data_(v);return d?Utilities.formatDate(d,Session.getScriptTimeZone(),'dd/MM/yyyy'):String(v||'');}
function fmtDataHora_(v){const d=data_(v);return d?Utilities.formatDate(d,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm'):String(v||'');}
function msg_(e){return String(e?.message||e||'Erro inesperado.');}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function log_(acao,id,detalhe,u){try{planilha_().getSheetByName(CFG.ABAS.LOG).appendRow([new Date(),acao,id,detalhe,u?.['Usuário']||'']);}catch(_){}}
