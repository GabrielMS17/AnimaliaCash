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

## Como funciona

Usa o **mesmo banco e as mesmas contas** do app em React Native (`src/supabase.js`). Para testar em outro projeto, crie `web/.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

O que é salvo em uma versão aparece na outra: cada alteração é enviada ao banco, e cada versão busca as novidades ao abrir, ao voltar para a guia e a cada minuto. Se duas pessoas alterarem o mesmo registro, vale a última gravação.

## O que esta versão ainda não faz

- **Estoque:** fica só no navegador, fora do banco.
- **Cadastro em Templates e em Custos e Taxas:** como no app, essas telas mostram só dados de exemplo.

## Onde está cada parte

| Parte | Arquivo |
| --- | --- |
| Rotas | `src/App.jsx` |
| Cabeçalho, navegação e avatar | `src/components/Layout.jsx` |
| Telas | `src/pages/` |
| Cirurgias, Internação e Banho & Tosa (página compartilhada) | `src/components/ProceduresPage.jsx` |
| Formulários de procedimento | `src/components/ProcedureEditModal.jsx` e `ProcedureDetailModal.jsx` |
| Login | `src/store/AuthContext.jsx` e `src/pages/Login.jsx` |
| Dados e sincronização | `src/store/DataContext.jsx` e `src/services/supabaseSync.js` |
| Dados iniciais e cálculos | `src/data/` e `src/utils/costCalculations.js` |
| Estilos | `src/styles.css` |

Os arquivos de `src/data/`, `src/utils/` e `src/services/supabaseSync.js` são cópias dos usados pelo app em `../src/`. Se uma regra de cálculo ou de sincronização mudar, atualize os dois lugares.
