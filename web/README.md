# Animalia Cash — versão web

Versão para navegador do Animalia Cash, feita em **React + Vite** (JavaScript e CSS puro), com as mesmas telas, cores e regras de cálculo do app em React Native.

## Como rodar

Pré-requisito: Node.js 22 ou mais recente.

```bash
cd web
npm install
npm run dev
```

O site abre em <http://localhost:5173>.

## O que esta versão ainda não faz

- **Banco de dados:** os dados ficam no `localStorage` do navegador, sem Supabase.
- **Login real:** o acesso é simulado, e qualquer usuário preenchido entra. A senha não é conferida nem guardada. O ponto de troca é `src/store/AuthContext.jsx`.
- **Cadastro em Templates e em Custos e Taxas:** como no app, essas telas mostram só dados de exemplo.

## Onde está cada parte

| Parte | Arquivo |
| --- | --- |
| Rotas | `src/App.jsx` |
| Cabeçalho, navegação e avatar | `src/components/Layout.jsx` |
| Telas | `src/pages/` |
| Cirurgias, Internação e Banho & Tosa (página compartilhada) | `src/components/ProceduresPage.jsx` |
| Formulários de procedimento | `src/components/ProcedureEditModal.jsx` e `ProcedureDetailModal.jsx` |
| Dados salvos no navegador | `src/store/DataContext.jsx` |
| Dados iniciais e cálculos | `src/data/` e `src/utils/costCalculations.js` |
| Estilos | `src/styles.css` |

Os arquivos de `src/data/` e `src/utils/` são cópias em JavaScript dos usados pelo app em `../src/`. Se uma regra de cálculo mudar, atualize os dois lugares.
