# AFA-TWIN — Guia de Instalação e Execução

Documento 5 de 6 — ver também: [01 - Contexto e Brainstorming](01-contexto-e-brainstorming.md),
[02 - Arquitetura da Solução](02-arquitetura-da-solucao.md), [03 - Modelo de Dados](03-modelo-de-dados.md),
[04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md), [06 - Implantação em Nuvem](06-implantacao-nuvem.md).

---

## 1. Pré-requisitos

- Python 3.11+ (testado com 3.14)
- Node.js 18+ (testado com 24) e npm
- Windows, Linux ou macOS — instruções abaixo usam PowerShell (Windows); adapte para bash se necessário

## 2. Backend (API)

```powershell
cd afa-twin\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Na primeira execução, o banco `data/afa_twin.db` é criado automaticamente e populado com dados de
  demonstração (frota FAB, pessoal, componentes, ordens de serviço, protocolos).
- Documentação interativa da API: **http://localhost:8000/docs**
- `--host 0.0.0.0` permite acesso de outros dispositivos na mesma rede (ex.: tablet físico) — use o IP
  da máquina (ex.: `http://192.168.0.X:8000`) nesse caso.

### Usuários de demonstração

| Usuário | Senha | Perfil |
|---|---|---|
| `gestor` | `AfaTwin@2026` | Gestor / Responsável Técnico |
| `piloto` | `AfaTwin@2026` | Piloto |
| `mecanico` | `AfaTwin@2026` | Mecânico |
| `engenheiro` | `AfaTwin@2026` | Engenheiro |
| `cientista` | `AfaTwin@2026` | Cientista (P&D) |

**Troque essas senhas (ou desative essas contas) antes de qualquer teste com dados reais.**

## 3. Frontend (aplicativo web / PWA)

Em um novo terminal:

```powershell
cd afa-twin\frontend
npm install
npm run dev
```

- Acesse **http://localhost:5173** — o Vite já está configurado para redirecionar chamadas `/api/*`
  para o backend em `http://127.0.0.1:8000` (ver `vite.config.ts`).
- Para acessar de um tablet na mesma rede Wi-Fi: descubra o IP da máquina que roda o frontend
  (`ipconfig` no Windows) e acesse `http://SEU_IP:5173` no navegador do tablet.

### Instalar como aplicativo no tablet

1. Abra o endereço do AFA-TWIN no navegador do tablet (Chrome no Android, Safari no iPad).
2. Android/Chrome: menu ⋮ → "Adicionar à tela inicial" / "Instalar aplicativo".
3. iPad/Safari: botão de compartilhar → "Adicionar à Tela de Início".
4. O ícone do AFA-TWIN (caça estilizado sobre losango nas cores da bandeira brasileira) aparecerá como
   um aplicativo normal, abrindo em tela cheia, sem a barra de endereço do navegador.

### Gerar a versão de produção (build otimizado)

```powershell
cd afa-twin\frontend
npm run build
npm run preview   # serve o build em http://localhost:4173 para validação
```

Para servir o build gerado (`dist/`) sem o Vite (ex.: em um servidor de arquivos simples ou atrás do
próprio FastAPI), utilize a pasta `dist/` diretamente.

## 4. Encerrando os serviços

- Backend: `Ctrl+C` no terminal do uvicorn.
- Frontend: `Ctrl+C` no terminal do Vite.
- Os dados ficam persistidos em `afa-twin/backend/data/afa_twin.db` entre execuções.

## 5. Resetando os dados de demonstração

Para recomeçar do zero (apaga todos os cadastros feitos durante o teste):

```powershell
Remove-Item afa-twin\backend\data\afa_twin.db
```

Na próxima inicialização do backend, o banco será recriado e populado novamente com os dados de
demonstração.

## 6. Variáveis de ambiente úteis

| Variável | Padrão | Uso |
|---|---|---|
| `AFA_TWIN_DATABASE_URL` | `sqlite:///.../data/afa_twin.db` | Trocar para um DSN Postgres/MySQL ao migrar para nuvem |
| `AFA_TWIN_SECRET_KEY` | chave de desenvolvimento fixa | **Defina um valor único e secreto** antes de qualquer uso além do notebook do desenvolvedor |
| `AFA_TWIN_SMTP_HOST` | não definida | Host SMTP para envio **real** de e-mails de notificação (ex.: `smtp.gmail.com`) |
| `AFA_TWIN_SMTP_PORT` | `587` | Porta SMTP (STARTTLS) |
| `AFA_TWIN_SMTP_USER` | não definida | Usuário/e-mail da conta usada para autenticar no SMTP |
| `AFA_TWIN_SMTP_PASSWORD` | não definida | Senha (ou senha de aplicativo) da conta SMTP |
| `AFA_TWIN_SMTP_FROM` | igual a `AFA_TWIN_SMTP_USER` | Endereço de remetente exibido nos e-mails enviados |
| `AFA_TWIN_ALLOWED_ORIGINS` | não definida (libera qualquer origem) | Lista de URLs (separadas por vírgula) autorizadas a chamar a API por CORS — **defina ao publicar em nuvem** (ver docs/06) |
| `AFA_TWIN_ACCESS_KEY` | não definida (camada desligada) | Chave extra opcional exigida no cabeçalho `X-AFA-TWIN-Key` de toda chamada à API — reforço de acesso ao publicar em nuvem (ver docs/06) |

Sem essas variáveis de SMTP configuradas, as notificações por e-mail ficam registradas no histórico
como "Simuladas" (não são perdidas, apenas não são realmente entregues) - útil para testar o fluxo sem
depender de credenciais reais. Notificações por SMS e WhatsApp são sempre simuladas nesta fase piloto,
por exigirem contratação de um gateway pago de terceiros (ver docs/04, seção 6).

As duas últimas variáveis (`AFA_TWIN_ALLOWED_ORIGINS` e `AFA_TWIN_ACCESS_KEY`) só fazem sentido ao
publicar o sistema fora da rede local — para uso local/tablet na mesma rede Wi-Fi, deixe-as sem definir.
Veja o passo a passo completo de publicação em nuvem gratuita em
[docs/06-implantacao-nuvem.md](06-implantacao-nuvem.md).

## 7. Checklist antes de expandir o teste para mais usuários

- [ ] Trocar `AFA_TWIN_SECRET_KEY` por um valor gerado aleatoriamente e mantido em segredo.
- [ ] Trocar as senhas padrão de demonstração ou criar contas individuais por usuário.
- [ ] Confirmar que o dispositivo/rede usados atendem às políticas de segurança da informação da
      organização (FAB/ITA/Embraer) antes de inserir qualquer dado sensível real.
- [ ] Definir rotina de backup do arquivo `afa_twin.db` enquanto ele for a fonte de dados local.

## 8. Manual do usuário (com telas de exemplo)

Além desta documentação técnica, existe um **manual do usuário ilustrado**, com telas de exemplo de
cada módulo do sistema, pensado para quem vai operar o AFA-TWIN no dia a dia (piloto, mecânico,
engenheiro, cientista ou gestor) — não apenas para quem vai instalá-lo ou mantê-lo:

- PDF pronto para distribuição/impressão: [`docs/AFA-TWIN-Manual-do-Usuario.pdf`](AFA-TWIN-Manual-do-Usuario.pdf)
- Fonte editável (HTML) e capturas de tela usadas: [`docs/manual/`](manual/)

Para gerar uma nova versão do PDF depois de alterações na interface (recapturando as telas e
recompilando o manual), use os scripts em `tools/` (Playwright/Node.js):

```powershell
cd afa-twin\tools
npm install
npx playwright install chromium
node capture-screens.mjs   # recaptura as 24 telas em tools/shots/ (backend e frontend precisam estar rodando)
# copie os PNGs atualizados para docs/manual/screens/
node make-pdf.mjs          # recompila docs/AFA-TWIN-Manual-do-Usuario.pdf a partir de docs/manual/manual-usuario.html
```
