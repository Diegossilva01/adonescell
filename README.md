# ADONESCELL — Landing Page

Projeto estático pronto para GitHub, Vercel, Netlify ou hospedagem comum.

## Arquivos

- `index.html` — página principal
- `style.css` — visual responsivo
- `script.js` — WhatsApp, formulário, máscara de telefone, UTMs e eventos para `dataLayer`
- `politica-de-privacidade.html` — política básica de privacidade

## 1. Alterar o número do WhatsApp

Abra `script.js` e altere:

```js
const WHATSAPP_NUMBER = "5511999999999";
```

Use apenas números, no formato:

- 55 = Brasil
- 11 = DDD
- restante = número

Exemplo:

```js
const WHATSAPP_NUMBER = "5511988887777";
```

## 2. Subir no GitHub

1. Crie um repositório.
2. Envie todos os arquivos da pasta para a raiz do projeto.
3. No Vercel, importe o repositório.
4. Não precisa configurar Framework Preset. Pode usar `Other`.
5. Não existe processo de build.

## 3. Tráfego pago

O formulário preserva automaticamente:

- `utm_source`
- `utm_campaign`

Exemplo:

`https://seudominio.com/?utm_source=google&utm_campaign=reparo-iphone`

Essas informações serão incluídas na mensagem do WhatsApp.

## 4. Google Ads / Tag Manager

O projeto já envia eventos para `dataLayer`:

- `whatsapp_click`
- `service_interest`
- `lead_submit`

Depois basta instalar o Google Tag Manager / Google Ads e criar os gatilhos usando esses nomes.

## 5. Antes de anunciar

Troque o WhatsApp, revise a política de privacidade e adicione os dados reais da loja caso queira mostrar endereço, horário, Instagram e avaliações.

## Vídeos reais da assistência

Os três vídeos enviados foram convertidos para MP4/H.264 otimizado para navegador e estão em:

- `assets/videos/reparo-01.mp4`
- `assets/videos/reparo-02.mp4`
- `assets/videos/reparo-03.mp4`

As capas ficam em `assets/posters/`. A página carrega apenas os metadados inicialmente para não pesar o tráfego pago; o vídeo completo é carregado quando o usuário reproduz.




## Banner principal

A foto do técnico é usada diretamente como fundo do topo do site (`assets/banner-adonescell.webp`), com degradê responsivo para manter o texto legível em desktop e celular.


## Checklist técnico (V4)

A Nova OS agora possui checklist de entrada com OK, Falha, N/T e N/A. O checklist é salvo na coluna `Checklist técnico` da aba Ordens e aparece no comprovante impresso. Execute `configurarSistema()` novamente uma vez após atualizar o Code.gs para criar a nova coluna sem apagar as ordens existentes.


## Fotos nas Ordens de Serviço (V6)

- Nova OS permite anexar até 6 fotos de entrada por envio.
- Ao editar uma OS, aparece o campo para fotos do aparelho pronto.
- As fotos são otimizadas no navegador e armazenadas no Google Drive em `ADONESCELL - Fotos das OS`.
- A planilha guarda os vínculos nas colunas `Fotos entrada` e `Fotos pronto`.
- O cliente vê as fotos de entrada e do aparelho pronto ao consultar o protocolo em `acompanhar.html`.
- Execute `configurarSistema()` uma vez após atualizar o `Code.gs` para criar as novas colunas e a pasta de fotos.

## V8 — Financeiro e Estoque

O sistema administrativo agora possui estoque integrado às vendas, recibos com baixa automática de estoque, venda rápida para itens não cadastrados, gastos manuais e financeiro consolidado entre acessórios e manutenção.

## V9 — Retiradas e recibos com múltiplos itens

Esta versão adiciona solicitação pública de retirada/agendamento, gestão das retiradas no painel e recibos com vários produtos. Consulte `README-V9.md` antes de publicar.
