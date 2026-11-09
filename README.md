# conversador-site

Mensageiro privado e temporário com criptografia ponta a ponta.
Conversas duram 24 horas e só o administrador cria e exclui conversas.

## Stack

React + Vite + TypeScript + Tailwind · Supabase (Postgres/RLS, Auth, Storage, Realtime, Edge Functions) · Web Crypto API

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha URL e publishable key
npm run dev
```

| Comando | Descrição |
|---|---|
| `npm test` | Testes unitários (Vitest) |
| `npm run test:db` | Testes de segurança do banco (pgTAP, requer `supabase start`) |
| `npm run typecheck` | Verificação de tipos |
| `npm run create-admin` | Cria o administrador (lê credenciais do ambiente) |

## Segurança

- Mensagens e arquivos são cifrados no navegador (AES-256-GCM); o servidor guarda só dados cifrados.
- O código de convite deriva, via HKDF, um token de acesso (o servidor guarda só o hash) e a chave da sala (nunca sai do navegador).
- Nunca coloque a `service_role`/secret key em variáveis `VITE_*` nem no repositório.
