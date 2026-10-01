# Manual do Usuário e Guia Operacional

> **Animalia Cash** — Passo a passo para gestão financeira, fracionamento de insumos e formação de preços na rotina veterinária.

---

## 1. Primeiro Acesso e Autenticação

1. Abra o aplicativo **Animalia Cash**.
2. Na tela de login, insira seu **e-mail** e **senha** cadastrados.
3. Dependendo do seu nível de permissão:
   - **Administrador:** Acesso completo a estoque, custos fixos, precificação e relatórios DRE.
   - **Profissional:** Acesso focado no lançamento de ordens de serviço e consultas operacionais.

---

## 2. Gestão de Estoque e Compras (Módulo 1)

### 2.1 Cadastrando um Produto Base
1. Aceda ao menu **Estoque** > **Produtos**.
2. Clique no botão **+ Novo Produto**.
3. Preencha o **Nome** (ex: *Anestésico X*), a **Unidade de Medida** (*mL*, *unidade*, *grama*) e a **Categoria**.
4. Clique em **Guardar**.

### 2.2 Efetuando Entrada de Lote e Fracionamento
1. No produto desejado, selecione a opção **Registrar Entrada de Lote**.
2. Informe o **Número do Lote**, a **Data de Validade**, a **Quantidade Adquirida** (ex: *100 mL*) e o **Preço Total Pago** (ex: *R$ 200,00*).
3. O aplicativo calcula automaticamente o **Custo/mL** (ex: *R$ 2,00/mL*) e atualiza o custo médio do estoque.

---

## 3. Custos Fixos e Taxas (Módulo 2 e 3)

### 3.1 Cadastrando Custos Fixos Mensais
1. Aceda ao menu **Configurações** > **Custos Fixos**.
2. Adicione despesas como *Aluguel*, *Energia*, *Salários* e *Softwares*.
3. O sistema somará o valor total mensal para calcular a **Taxa de Custo Fixo Operacional** por hora ou por atendimento.

### 3.2 Configurando Taxas de Maquininha e Impostos
1. Em **Configurações** > **Taxas e Impostos**:
   - Defina a alíquota do **Imposto sobre Vendas / Serviços** (ex: *6%*).
   - Cadastre as taxas de **Cartão de Crédito/Débito** conforme a bandeira e parcelamento.

---

## 4. Criando Templates de Serviços / Fichas Técnicas (Módulo 4)

1. Aceda ao menu **Templates de Serviços**.
2. Clique em **+ Novo Template** (ex: *Castração Canina 10kg*).
3. Adicione os **Insumos Requeridos**:
   - Exemplo: 2.5 mL de Anestésico X, 1 Luva Cirúrgica, 2 Seringas.
4. Defina a **Mão de Obra ESTIMADA** e a **Margem de Lucro Desejada**.
5. O aplicativo sugerirá o **Preço de Venda Mínimo Recomendado** com base no Custo do Serviço Prestado (CSP).

---

## 5. Lançando um Atendimento no Checkout (Módulo 5)

1. Aceda ao menu **Novo Atendimento / Ordem de Serviço**.
2. Selecione um **Template Pré-configurado** ou monte os insumos manualmente na hora.
3. Ajuste as quantidades reais utilizadas durante o procedimento, se necessário.
4. Selecione a **Forma de Pagamento** (PIX, Dinheiro, Cartão de Crédito em X vezes).
5. Clique em **Finalizar Atendimento**:
   - O estoque dos insumos consumidos será **subtraído automaticamente**.
   - O resultado financeiro (Receita Bruta - Impostos - CSP - Taxa Cartão = Lucro Líquido) é gravado no histórico.

---

## 6. Consultando o DRE e Relatórios (Módulo 6)

1. Aceda ao menu **Relatórios** > **DRE Financeiro**.
2. Selecione o período desejado (Mês Atual, Mês Anterior ou Personalizado).
3. Visualize a DRE detalhada:
   - **(+) Receita Bruta Total**
   - **(-) Impostos e Taxas de Cartão**
   - **(=) Receita Líquida**
   - **(-) Custo dos Serviços Prestados (CSP - Insumos consumidos)**
   - **(=) Margem de Contribuição**
   - **(-) Custos Fixos do Período**
   - **(=) Lucro / Prejuízo Líquido Operacional**