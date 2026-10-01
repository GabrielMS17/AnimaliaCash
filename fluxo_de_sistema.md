# 📋 Requisitos do Sistema & Especificação Funcional

> **Animalia Cash** — Sistema de Gestão Financeira e Controle de Estoque por Fracionamento para Clínicas Veterinárias e Pet Shops.

---

## 1. Visão Geral da Solução

O sistema tem como objetivo principal **controlar com precisão cirúrgica os custos de atendimento** de uma clínica veterinária. 

A aplicação automatiza a conversão de compras em lote (frascos de medicamentos em mL, pacotes de insumos e acessórios por vida útil) em **custos unitários de consumo**. O profissional veterinário ou esteticista registra apenas o consumo operacional (quantidade em mL, unidades ou tempo), enquanto o sistema realiza o **abate automático no estoque** e o cálculo do **Lucro Líquido por atendimento em tempo real**.

---

## 2. Perfis de Acesso e Autenticação (RBAC)

### 2.1 Perfil Administrador (`ADMIN`)
- **Autenticação:** E-mail e Senha.
- **Permissões de Acesso:** 
  - Gestão de compras e estoque geral.
  - Cadastro de custos fixos e taxas financeiras.
  - Parametrização de serviços e fichas técnicas.
  - Gestão de equipe e comissões.
  - Relatórios financeiros e DRE (Demonstrativo do Resultado do Exercício).

### 2.2 Perfil Profissional (`PROFESSIONAL` — Veterinário / Esteticista)
- **Autenticação:** E-mail (ou CRMV) e Senha.
- **Permissões de Acesso:** 
  - Lançamento operacional de cirurgias, internações, banho e tosa.
  - Acesso estritamente restrito a informações financeiras sigilosas da clínica (custos fixos, margens de lucro consolidadas e DRE).

---

## 3. Arquitetura Modular de Funcionalidades

### Módulo 1: Gestão de Estoque e Compras (Administração)

- **Entrada de Nota / Lote de Compras:**
  - Cadastro do produto/medicamento (Nome, Marca, Lote, Validade).
  - Tipo de fracionamento (Volume total em mL, Gramas ou Unidades).
  - Valor total pago na compra do lote.

- **Motor de Cálculo Automático do Custo Médio:**
  - **Custo por Mililitro (mL):**
    ```text
    Custo/mL = Valor do Lote / Volume Total em mL
    ```
  - **Custo por Vida Útil (Objetos / Utensílios):**
    ```text
    Custo/Uso = Valor do Objeto / Nº de Usos Estimados
    ```

- **Alertas e Gestão de Inventário:**
  - Alertas automáticos de estoque mínimo (em mL e unidades).
  - Relatório de perdas, quebras e produtos vencidos.

---

### Módulo 2: Cadastro de Custos Fixos e Taxas (Administração)

- **Custos Fixos Mensais:**
  - Registro de aluguel, energia, água, internet, folha salarial fixa e contabilidade.
  - **Cálculo da Hora/Sala Operacional:** Utilizado para cobrir custos de estrutura e energia proporcional ao tempo gasto nos atendimentos.

- **Taxas de Meios de Pagamento:**
  - Cadastro de taxas percentuais por bandeira e forma de pagamento (Débito, Crédito à vista, Crédito parcelado e PIX).

---

### Módulo 3: Fichas Técnicas e Padrões de Serviços (Templates)

- **Atrelamento de Insumos Padrão:**
  - Criação de templates para procedimentos e estética (ex: *Banho Porte P*, *Castração Felina*).
  - Pré-configuração dos insumos médios consumidos (ex: 30 mL de Shampoo, 1 lâmina/uso, 2,5 mL de Anestésico X).
  - Permite agilizar o lançamento no dia a dia, exigindo apenas ajustes de variação pelo operador no momento do atendimento.

---

### Módulo 4: Operação de Atendimentos (Lançamentos Diários)

#### A. Cirurgia
- **Dados de Identificação:** Paciente, raça, peso (kg), veterinário responsável, anestesista e tipo de procedimento.
- **Consumo de Insumos:** Seleção de medicamentos e anestésicos (quantidade real aplicada em mL).
- **Utensílios e Materiais:** Registro de kits cirúrgicos, campos e utensílios utilizados.
- **Tempo e Estrutura:** Período e tempo total de cirurgia (calcula o custo proporcional de energia/sala).
- **Comissão:** Percentual ou valor fixo destinado aos profissionais envolvidos.

#### B. Internação
- **Dados de Entrada:** Paciente, peso (kg), tipo de internação e duração (diárias/horas).
- **Pacote Padrão:** Cobrança base que inclui leito, monitoramento e medicações básicas.
- **Medicações e Insumos Extra:** Campo opcional para lançamento de medicamentos administrados fora do pacote (com baixa automática do estoque em mL).
- **Comissão Veterinária:** Regra de repasse atrelada ao tipo de internação e peso do paciente.

#### C. Banho e Tosa
- **Dados de Entrada:** Paciente, porte (P, M, G, GG) e tipo de serviço (Banho, Tosa Higiênica, Tosa Completa).
- **Consumo de Produtos Líquidos:** Quantidade real utilizada em mL (Shampoo, Condicionador, Perfume, Máscara).
- **Desgaste e Acessórios:** Uso de lâminas, gravatas, laços e toalhas.
- **Tempo e Mão de Obra:** Tempo de execução e comissão do tosador/banhista.

---

### 🛒 Módulo 5: Checkout e Apuração Financeira por Atendimento

Ao finalizar um atendimento, o sistema processa automaticamente:

1. **Baixa em Estoque:** Subtração exata da quantidade utilizada em mL e unidades no saldo geral do banco de dados.
2. **Custo do Serviço Prestado (CSP):**
   ```text
   CSP = (Insumos em mL × Custo/mL) + (Utensílios × Custo/Uso) + Comissão + Custo Estrutural de Sala