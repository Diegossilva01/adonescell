# ADONESCELL V9 — Retiradas + recibo com vários produtos

## Novidades

### Retirada e agendamento
- Nova seção pública no site para o cliente solicitar retirada do aparelho.
- O pedido NÃO confirma o horário automaticamente: entra no painel como `Nova solicitação`.
- Nova aba `Retiradas` no painel administrativo.
- Status disponíveis: Nova solicitação, Aguardando aprovação, Agendado, Em rota para retirada, Aparelho coletado, Na assistência, Pronto, Devolução agendada, Finalizado e Cancelado.
- Botão de WhatsApp na solicitação para entrar em contato com o cliente.
- Botão `Criar OS` aproveita os dados da retirada e gera uma Ordem de Serviço.
- Data e horário confirmados podem ser definidos pelo painel.

### Recibos com vários produtos
- Um único recibo aceita vários itens.
- É possível misturar produtos cadastrados no estoque e itens de venda rápida no mesmo recibo.
- Produto do estoque carrega preço/custo automaticamente.
- A quantidade vendida é baixada automaticamente do estoque.
- Ao excluir o recibo, as quantidades dos produtos cadastrados retornam ao estoque.
- O recibo A4 imprime todos os itens separadamente e o total geral.

## Atualização do Google Apps Script
1. Substitua o `Code.gs` atual pelo desta versão.
2. Salve.
3. Execute `configurarSistema()` uma vez.
   - Isso cria a aba `Retiradas`.
   - Isso adiciona a coluna `Itens JSON` à aba `Recibos`.
   - Os dados existentes não são apagados.
4. Vá em **Implantar > Gerenciar implantações > Editar**.
5. Selecione **Nova versão** e clique em **Implantar**.
6. Mantenha a mesma URL `/exec` já usada no projeto.

## Importante
O site e o painel já estão configurados para a URL atual do Apps Script usada no projeto.
