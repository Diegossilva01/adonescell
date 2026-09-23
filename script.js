// ==========================================================
// ADONESCELL
// ALTERE SOMENTE O NÚMERO ABAIXO PARA O WHATSAPP DA LOJA.
// Formato: código do país + DDD + número, somente números.
// Exemplo: 5511999999999
// ==========================================================
const WHATSAPP_NUMBER = "5511983752451";
const PUBLIC_API_URL = "https://script.google.com/macros/s/AKfycbx2QSzErbD1Ham0-iUmb1f3GWHOUA3YegeGuQDBoHK8tRVt_nW0tU2cslIa-0_kRr80/exec";

const buildWhatsAppUrl = (message) => {
  const text = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
};

document.querySelectorAll(".js-whatsapp").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();

    const message =
      link.dataset.message ||
      "Olá! Vim pelo site da ADONESCELL e quero solicitar um orçamento.";

    window.open(buildWhatsAppUrl(message), "_blank", "noopener");
    pushEvent("whatsapp_click", { source: "site_button" });
  });
});

// Preenche o serviço escolhido no formulário e leva o usuário até o orçamento.
document.querySelectorAll(".open-service").forEach((button) => {
  button.addEventListener("click", () => {
    const service = button.dataset.service || "Outro problema";
    const problemField = document.getElementById("problem");
    const detailsField = document.getElementById("details");

    const optionExists = [...problemField.options].some(
      (option) => option.text === service || option.value === service
    );

    if (optionExists) {
      problemField.value = service;
    } else {
      problemField.value = "Outro problema";
      detailsField.value = service;
    }

    updateProgress();
    document.getElementById("orcamento").scrollIntoView({ behavior: "smooth" });
    pushEvent("service_interest", { service });
  });
});

const phoneInput = document.getElementById("clientPhone");

phoneInput.addEventListener("input", () => {
  let value = phoneInput.value.replace(/\D/g, "").slice(0, 11);

  if (value.length > 10) {
    value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  } else if (value.length > 6) {
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d+)/, "($1) $2");
  } else if (value.length > 0) {
    value = value.replace(/^(\d*)/, "($1");
  }

  phoneInput.value = value;
  updateProgress();
});

const form = document.getElementById("quoteForm");
const trackedFields = [
  "deviceType",
  "deviceModel",
  "problem",
  "details",
  "clientName",
  "clientPhone",
];

trackedFields.forEach((id) => {
  const field = document.getElementById(id);
  field.addEventListener("input", updateProgress);
  field.addEventListener("change", updateProgress);
});

function updateProgress() {
  const requiredIds = ["deviceType", "deviceModel", "problem", "clientName", "clientPhone"];
  let filled = 0;

  requiredIds.forEach((id) => {
    const value = document.getElementById(id).value.trim();
    if (value) filled++;
  });

  const details = document.getElementById("details").value.trim();
  const total = requiredIds.length + 1;

  if (details) filled++;

  const progress = Math.round((filled / total) * 100);
  document.getElementById("progressBar").style.width = `${progress}%`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const deviceType = document.getElementById("deviceType").value;
  const deviceModel = document.getElementById("deviceModel").value.trim();
  const problem = document.getElementById("problem").value;
  const details = document.getElementById("details").value.trim();
  const clientName = document.getElementById("clientName").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();

  if (!deviceType || !deviceModel || !problem || !clientName || !clientPhone) {
    alert("Preencha os campos obrigatórios para solicitar o orçamento.");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || "direto";
  const utmCampaign = params.get("utm_campaign") || "sem_campanha";

  const message = [
    "Olá! Vim pelo site da ADONESCELL e quero solicitar um orçamento.",
    "",
    `👤 Nome: ${clientName}`,
    `📞 WhatsApp: ${clientPhone}`,
    `📱 Aparelho: ${deviceType}`,
    `🔎 Modelo: ${deviceModel}`,
    `🛠 Problema: ${problem}`,
    details ? `📝 Detalhes: ${details}` : "",
    "",
    `Origem: ${utmSource}`,
    `Campanha: ${utmCampaign}`,
  ]
    .filter(Boolean)
    .join("\n");

  pushEvent("lead_submit", {
    device_type: deviceType,
    problem,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
  });

  window.open(buildWhatsAppUrl(message), "_blank", "noopener");
});

// Compatível com Google Tag Manager / Google Ads quando você adicionar suas tags.
function pushEvent(eventName, data = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...data,
  });
}

document.getElementById("year").textContent = new Date().getFullYear();
updateProgress();

// Ao reproduzir um vídeo, pausa os outros para evitar áudio sobreposto.
document.querySelectorAll(".video-frame video").forEach((video) => {
  video.addEventListener("play", () => {
    document.querySelectorAll(".video-frame video").forEach((otherVideo) => {
      if (otherVideo !== video && !otherVideo.paused) otherVideo.pause();
    });

    pushEvent("video_play", {
      video_source: video.querySelector("source")?.getAttribute("src") || "video_site",
    });
  });
});


// ==========================================================
// RETIRADA E AGENDAMENTO
// ==========================================================
const pickupForm = document.getElementById('pickupForm');
if (pickupForm) {
  const dateField = pickupForm.querySelector('[name="dataDesejada"]');
  if (dateField) dateField.min = new Date().toISOString().slice(0,10);

  const pickupPhone = pickupForm.querySelector('[name="whatsapp"]');
  if (pickupPhone) pickupPhone.addEventListener('input', () => {
    let value = pickupPhone.value.replace(/\D/g, '').slice(0,11);
    if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d+)/, '($1) $2');
    pickupPhone.value = value;
  });

  const cep = pickupForm.querySelector('[name="cep"]');
  const cepStatus = document.getElementById('cepStatus');
  const enderecoField = pickupForm.querySelector('[name="endereco"]');
  const bairroField = pickupForm.querySelector('[name="bairro"]');
  const cidadeField = pickupForm.querySelector('[name="cidade"]');
  const estadoField = pickupForm.querySelector('[name="estado"]');
  let ultimoCepConsultado = '';
  let cepTimer = null;

  async function buscarEnderecoPorCep(valor) {
    const d = String(valor || '').replace(/\D/g, '').slice(0, 8);
    if (d.length !== 8 || d === ultimoCepConsultado) return;
    ultimoCepConsultado = d;
    if (cepStatus) {
      cepStatus.className = 'cep-status loading';
      cepStatus.textContent = 'Buscando endereço...';
    }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${d}/json/`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao consultar o CEP.');
      const data = await response.json();
      if (data.erro) throw new Error('CEP não encontrado.');
      if (enderecoField && data.logradouro) enderecoField.value = data.logradouro;
      if (bairroField && data.bairro) bairroField.value = data.bairro;
      if (cidadeField && data.localidade) cidadeField.value = data.localidade;
      if (estadoField && data.uf) estadoField.value = data.uf;
      if (cepStatus) {
        cepStatus.className = 'cep-status success';
        cepStatus.textContent = 'Endereço preenchido automaticamente.';
      }
      const numeroField = pickupForm.querySelector('[name="numero"]');
      if (numeroField) numeroField.focus();
    } catch (error) {
      ultimoCepConsultado = '';
      if (cepStatus) {
        cepStatus.className = 'cep-status error';
        cepStatus.textContent = error.message || 'Não foi possível consultar o CEP.';
      }
    }
  }

  if (cep) {
    cep.addEventListener('input', () => {
      const d = cep.value.replace(/\D/g,'').slice(0,8);
      cep.value = d.length > 5 ? d.replace(/(\d{5})(\d{0,3})/,'$1-$2') : d;
      clearTimeout(cepTimer);
      if (d.length === 8) cepTimer = setTimeout(() => buscarEnderecoPorCep(d), 250);
      else {
        ultimoCepConsultado = '';
        if (cepStatus) { cepStatus.className = 'cep-status'; cepStatus.textContent = ''; }
      }
    });
    cep.addEventListener('blur', () => buscarEnderecoPorCep(cep.value));
  }

  pickupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const msg = document.getElementById('pickupMsg');
    const button = pickupForm.querySelector('button[type="submit"]');
    const dados = Object.fromEntries(new FormData(pickupForm).entries());
    const params = new URLSearchParams(window.location.search);
    dados.utmSource = params.get('utm_source') || 'direto';
    dados.utmCampaign = params.get('utm_campaign') || 'sem_campanha';
    dados.acao = 'salvarRetiradaPublica';

    msg.className = 'pickup-form-message loading';
    msg.textContent = 'Enviando sua solicitação...';
    button.disabled = true;
    try {
      const response = await fetch(PUBLIC_API_URL, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(dados),
        cache: 'no-store',
        redirect: 'follow'
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.erro || 'Não foi possível enviar a solicitação.');
      msg.className = 'pickup-form-message success';
      msg.innerHTML = `<strong>Solicitação enviada!</strong><span>Protocolo ${result.protocolo}. Vamos confirmar o agendamento pelo WhatsApp.</span>`;
      pickupForm.reset();
      if (dateField) dateField.min = new Date().toISOString().slice(0,10);
      pushEvent('pickup_request', {protocol: result.protocolo});
    } catch (error) {
      msg.className = 'pickup-form-message error';
      msg.textContent = error.message || 'Erro ao enviar. Tente novamente.';
    } finally {
      button.disabled = false;
    }
  });
}
