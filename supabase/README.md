# Banco de dados no Supabase — módulo de custos

Este diretório contém a estrutura do banco usada pelas telas **Cirurgias**, **Internação**, **Banho & Tosa**, **Insumos** e **Configurações**.

- `schema.sql` — cria as tabelas, chaves, restrições e políticas de segurança (RLS). Pode ser executado mais de uma vez.

## Como os dados funcionam no app

1. Tudo o que você cadastra fica salvo **no próprio navegador/dispositivo** (funciona mesmo sem internet e sem login).
2. Ao **entrar com uma conta** neste dispositivo pela primeira vez, o app baixa os dados que essa conta já tem no Supabase (se ela ainda não tiver nada, envia os dados do dispositivo). Assim, abrir o app em outro navegador não sobrescreve o que já está no banco.
3. A partir daí, cada alteração é enviada automaticamente para o Supabase (dá para desligar em *Configurações › Sincronização*).
4. Em *Configurações › Sincronização* também há os botões **Enviar dados agora** e **Baixar do Supabase** (útil para abrir os mesmos dados em outro aparelho).

## Tabelas

| Tabela | Conteúdo |
| --- | --- |
| `clinic_settings` | Nome da clínica, custo operacional por hora, comissões padrão (1 linha por usuário) |
| `external_professionals` | Anestesistas e especialistas terceirizados com custo padrão |
| `insumos` | Materiais e medicamentos: categoria, unidade, embalagem e custo unitário |
| `procedures` | Cirurgias, diárias de internação e banho & tosa |
| `procedure_items` | Insumos e quantidades usados em cada procedimento (ficha técnica) |
| `procedure_professionals` | Profissionais terceirizados de cada procedimento e o custo naquele procedimento |

Todas as tabelas têm `owner_id` (o usuário dono dos dados) e RLS ativo: cada usuário só enxerga e altera as próprias linhas.

## Criando o ambiente de teste (na sua conta)

1. Acesse <https://supabase.com>, entre na sua conta e clique em **New project** (o plano gratuito serve).
2. Com o projeto criado, abra **SQL Editor › New query**, cole todo o conteúdo de `schema.sql` e clique em **Run**.
3. Crie um usuário para testar: **Authentication › Users › Add user › Create new user** (marque *Auto Confirm User*).
4. Em **Project Settings › API**, copie a *Project URL* e a chave *anon public*.
5. Na raiz do projeto, copie `.env.example` para `.env.local` e preencha:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
6. Pare o servidor do Expo (Ctrl+C) e inicie de novo com `npx expo start --web -c` (variáveis de ambiente só são lidas na inicialização).
7. No app, faça login com o usuário criado (botão **Login** da barra Dev) e vá em **Configurações › Sincronização › Enviar dados agora**.
8. Confira os dados em **Table Editor** no painel do Supabase.

## Levando para o banco principal

O responsável pelo banco principal só precisa executar `schema.sql` lá. Pontos a avaliar na integração:

- Hoje os dados são separados **por usuário** (`owner_id`). Se a clínica tiver vários usuários compartilhando o mesmo catálogo, troque `owner_id` por um `clinic_id` e ajuste as políticas de RLS para checar se o usuário pertence à clínica (ex: tabela `profiles` com `clinic_id` e `role`).
- As tabelas `products` / `product_batches` descritas em `database_schema.md` (estoque por lote) são outro módulo; `insumos` aqui guarda o **custo de referência** usado nos cálculos de custo dos procedimentos.
