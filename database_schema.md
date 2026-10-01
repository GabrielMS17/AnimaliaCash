# Estrutura e Modelagem do Banco de Dados (Supabase / PostgreSQL)

Este documento especifica a arquitetura de dados do **Animalia Cash**, detalhando as tabelas, relacionamentos, políticas de segurança (*Row Level Security - RLS*) e funções de banco de dados no Supabase, com base nos requisitos operacionais e financeiros da aplicação.

---

## Perfis de Acesso e Autenticação (RBAC)

A aplicação possui dois perfis de acesso com permissões distintas configuradas via Row Level Security (RLS) no Supabase Auth:

1. **Perfil Administrador (`ADMIN`):**
   - **Acessos:** Gestão completa de compras/estoque, cadastro de custos fixos e taxas, parametrização de serviços (templates), gestão de equipe, relatórios financeiros e DRE.
2. **Perfil Profissional (`PROFESSIONAL` - Veterinário / Esteticista):**
   - **Acessos:** Lançamento operacional diário de atendimentos (Cirurgias, Internações, Banho e Tosa). Acesso estritamente bloqueado a dados financeiros sigilosos da clínica (margem da clínica, DRE e custos fixos consolidados).

---

## Diagrama Entidade-Relacionamento (Conceitual)

```text
[profiles] ──(1:N)──> [service_orders] ──(1:N)──> [service_order_items]
                                                      │
[products] ──(1:N)──> [product_batches] ──────────────┘
    │
    └──(1:N)──> [procedure_template_items] ──(N:1)──> [procedure_templates]

[fixed_costs]
[payment_method_fees]