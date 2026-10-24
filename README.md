# 🐾 Animalia Cash

> **Sistema de Gestão Financeira e Controle de Estoque por Fracionamento para Clínicas Veterinárias e Pet Shops.**

O **Animalia Cash** é uma solução completa desenvolvida para controlar com precisão o custo operacional de atendimentos veterinários e estéticos. O sistema automatiza a conversão de compras em lote (frascos de medicamentos em mL, pacotes de insumos e utensílios por vida útil) em custos unitários de consumo, permitindo o abate automático de estoque e o cálculo do Lucro Líquido por atendimento em tempo real.

---

## Tecnologias Utilizadas

- **Mobile:** [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/) (TypeScript)
- **Estilização:** NativeWind / Tailwind CSS
- **Back-end & Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL, Autenticação e Row Level Security)
- **Gerenciamento de Estado & Hooks:** React Hooks, Context API e Supabase JS Client

---

## Principais Funcionalidades

### 1. Gestão de Estoque e Compras por Fracionamento
- Cadastro de produtos com fracionamento dinâmico (mL, gramas ou unidades).
- Motor de cálculo automático de custo médio por mililitro e por vida útil de utensílios.
- Alertas de estoque mínimo e relatórios de perdas/vencimentos.

### 2. Custos Fixos e Taxas
- Cadastro de custos fixos mensais (aluguel, energia, salários, etc.).
- Cálculo automático do valor da Hora/Sala Operacional.
- Configuração de taxas percentuais por meio de pagamento (Débito, Crédito, PIX).

### 3. Fichas Técnicas e Templates de Serviços
- Pré-configuração de insumos padrão por procedimento (ex: Banho Porte P, Castração Felina, Cirurgias).
- Agilidade no lançamento operacional diário com ajustes de variação.

### 4. Operação Diária de Atendimentos
- **Cirurgias e Internações:** Lançamento de dosagens exatas em mL, tempo de sala e comissão da equipe.
- **Banho e Tosa:** Registro por porte do animal, quantidade real de produtos líquidos e desgastes de lâminas/acessórios.

### 5. Checkout & Apuração por Atendimento
- Baixa automática no estoque em tempo real.
- Cálculo do **Custo do Serviço Prestado (CSP)** e **Margem Bruta Operacional**.
- Indicador visual instantâneo de rentabilidade (Lucro x Prejuízo).

### 6. Relatórios Financeiros & DRE
- Demonstrativo do Resultado do Exercício (DRE) Sintética e Analítica.
- Painel de indicadores com gráfico de procedimentos mais lucrativos e Ponto de Equilíbrio Operacional.

---

## 🗂️ Onde está cada tela

Cada endereço do app é um arquivo em `src/app/` (Expo Router). Ele apenas abre a tela correspondente em `src/services/screens/`:

| Tela | Rota (`src/app/`) | Tela (`src/services/screens/`) | Conteúdo principal |
| --- | --- | --- | --- |
| Login | `Login.jsx` | `possivelLogin.jsx` | — |
| Tela Inicial | `index.jsx` | `TelaInicial.jsx` | — |
| Banho & Tosa | `banho-tosa.jsx` | `banho-tosa.jsx` | `components/ProceduresPage.jsx` |
| Cirurgias | `cirurgia.jsx` | `cirurgia.jsx` | `components/ProceduresPage.jsx` |
| Internação | `internacao.jsx` | `internacao.jsx` | `components/ProceduresPage.jsx` |
| Insumos | `insumos.jsx` | `insumos.jsx` | `components/InsumosPage.jsx` |
| Configurações | `configuracoes.jsx` | `configuracoes.jsx` | `components/SettingsPage.jsx` |
| Estoque | `estoque.jsx` | `estoqueScreen.jsx` | — |
| Templates | `templates.jsx` | `Templates.jsx` | — |
| Custos e Taxas | `custos.jsx` | `CustosFixosTaxas.jsx` | — |

Banho & Tosa, Cirurgias e Internação usam a mesma página (`ProceduresPage.jsx`), que muda só a categoria. Os formulários ficam em `components/ProcedureEditModal.jsx` (cadastro/edição) e `components/ProcedureDetailModal.jsx` (detalhamento do custo). O cabeçalho e a navegação entre esses módulos ficam em `components/AnimaliaDataRoute.jsx`; os dados e a sincronização com o Supabase, em `store/AnimaliaDataContext.jsx` e `services/supabaseSync.js`.

---

## 🔐 Perfis de Acesso (RBAC)

1. **Administrador:** Acesso completo a compras, estoque, custos fixos, relatórios financeiros e DRE.
2. **Profissional (Veterinário / Esteticista):** Acesso restrito a lançamentos operacionais de atendimentos, sem visualização de dados financeiros sigilosos.

---

## Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) instalado.
- Aplicação [Expo Go](https://expo.dev/go) instalada no dispositivo móvel (Android/iOS).
- Conta configurada no [Supabase](https://supabase.com/).

### Passo a Passo

```bash
# 1. Clonar o repositório
git clone [https://github.com/julianicioli/AnimaliaCash.git](https://github.com/julianicioli/AnimaliaCash.git)

# 2. Entrar na pasta do projeto
cd AnimaliaCash

# 3. Instalar as dependências
npm install

# 4. Configurar as variáveis de ambiente
# Crie um arquivo .env na raiz do projeto com as chaves do seu Supabase:
EXPO_PUBLIC_SUPABASE_URL=sua_url_do_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase

# 5. Iniciar o servidor de desenvolvimento Expo
npx expo start -c