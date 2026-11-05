# Banco de dados no Supabase — módulo de custos

Este diretório contém a estrutura do banco usada pelas telas **Cirurgias**, **Internação**, **Banho & Tosa**, **Insumos** e **Configurações**.

- `schema.sql` — cria as tabelas, chaves, restrições e políticas de segurança (RLS). Pode ser executado mais de uma vez.

## Como os dados funcionam no app

Esta versão atende **uma clínica**: todos os usuários logados veem e alteram os mesmos dados.

1. Tudo o que você cadastra fica salvo também no navegador/dispositivo.
2. Com login feito, cada alteração é enviada ao banco, somente o que mudou.
3. O app busca o que outros gravaram ao abrir, ao voltar para ele e a cada minuto.
4. Com o banco vazio, nada sobe sozinho: o primeiro envio é feito em *Configurações › Enviar dados agora*.
5. Se duas pessoas alterarem o mesmo registro, vale a última gravação.

## Tabelas

| Tabela | Conteúdo |
| --- | --- |
| `clinic_settings` | Nome da clínica, custo operacional por hora, comissões padrão (sempre 1 linha) |
| `external_professionals` | Anestesistas e especialistas terceirizados com custo padrão |
| `insumos` | Materiais e medicamentos: categoria, unidade, embalagem e custo unitário |
| `procedures` | Cirurgias, diárias de internação e banho & tosa |
| `procedure_items` | Insumos e quantidades usados em cada procedimento (ficha técnica) |
| `procedure_professionals` | Profissionais terceirizados de cada procedimento e o custo naquele procedimento |

Todas as tabelas têm RLS ativo: só usuários logados acessam, e todos com as mesmas permissões. Permissões por papel (ex: usando `profiles.role`) ficam para uma próxima etapa.

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

- O script não altera tabelas existentes, como `profiles`.
- As tabelas `products` / `product_batches` descritas em `database_schema.md` (estoque por lote) são outro módulo; `insumos` aqui guarda o **custo de referência** usado nos cálculos de custo dos procedimentos.
