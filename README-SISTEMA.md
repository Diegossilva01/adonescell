# ADONES CELL — Sistema V8

## Atualização desta versão

Esta versão integra vendas, estoque, ordens de serviço e financeiro.

### Financeiro
- Junta manutenção e vendas de acessórios em um único painel.
- Mostra faturamento total do mês.
- Mostra lucro de manutenção separado.
- Mostra lucro de acessórios separado.
- Permite lançar gastos extras.
- Calcula lucro líquido: lucro manutenção + lucro acessórios - gastos extras.
- Exibe histórico unificado das movimentações do mês.

### Estoque
- Nova aba `Estoque`.
- Cadastro de produto, SKU, categoria, quantidade, estoque mínimo, custo e preço de venda.
- Mostra custo total do estoque e potencial de venda.
- Venda de produto cadastrado baixa o estoque automaticamente.
- Se um recibo de produto cadastrado for excluído pelo administrador, a quantidade volta ao estoque.

### Recibos / vendas
- Pode escolher `Produto do estoque` ou `Venda rápida`.
- Produto do estoque carrega preço automaticamente.
- Basta informar cliente, CPF, produto e quantidade; o total é calculado pelo sistema.
- Venda rápida permite registrar um produto não cadastrado, valor e custo.
- O lucro da venda fica registrado para o Financeiro.

## Atualização do Google Apps Script

1. Abra a planilha da ADONES CELL.
2. Vá em **Extensões > Apps Script**.
3. Substitua todo o conteúdo do `Code.gs` pelo `Code.gs` desta pasta.
4. Salve.
5. Execute `configurarSistema()` uma vez.
6. Autorize se o Google solicitar.
7. Vá em **Implantar > Gerenciar implantações**.
8. Edite a implantação existente e selecione **Nova versão**.
9. Clique em **Implantar**.

`configurarSistema()` adiciona automaticamente as abas `Estoque` e `Gastos` e acrescenta as novas colunas da aba `Recibos`. As ordens e recibos antigos não são apagados.

## Login inicial

Usuário: `admin`
Senha: `123456`


## V9 — Retirada e recibo com vários itens

Execute `configurarSistema()` após trocar o `Code.gs`. A função cria a aba `Retiradas` e adiciona a coluna `Itens JSON` em `Recibos`, preservando os dados já existentes. Depois publique uma nova versão da implantação.
