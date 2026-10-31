# Painel Natural Sabor (protótipo)

Protótipo navegável do **painel de pedidos da Natural Sabor** (fábrica de polpas de
fruta que vende pelo WhatsApp). Mostra, de ponta a ponta, como o atendimento pelo
bot vira pedido, passa pelo pagamento e segue para a entrega, com as **regras de
negócio reais** aplicadas, mesmo sendo uma demonstração.

> **É um protótipo de demonstração.** Não tem backend nem banco: tudo roda no
> navegador. O estado vive só em memória durante o uso: **recarregar a página
> devolve tudo ao estado inicial**.

---

## Como rodar localmente

Não há build nem dependências para instalar. Basta servir a pasta por HTTP
(abrir o `index.html` direto como `file://` quebra o carregamento dos módulos).

**Com Python (já incluso):**

```bash
python servir.py 8080
```

Depois abra <http://127.0.0.1:8080/>.

**Ou com qualquer servidor estático**, por exemplo:

```bash
npx serve .
```

### Acesso de demonstração

| Campo   | Valor                              |
| ------- | ---------------------------------- |
| E-mail  | `operador@naturalsabor.com.br`     |
| Senha   | `polpa123`                         |

---

## Regras de negócio aplicadas

- **Frete nunca é grátis.** Calculado por `max(frete_mínimo, tarifa_base +
  valor_por_km × km) × multiplicador`, com a distância em km por bairro.
- **Cobertura restrita** a João Pessoa, Cabedelo e Bayeux (cada cidade pode ser
  pausada, mas nenhuma outra é aceita).
- **Entrega** hoje ou agendada em até 30 dias, sempre em **dia útil** (fim de
  semana e feriados são recusados, com sugestão do próximo dia válido).
- **Acima de 100 kg** o pedido vai para combinação manual.
- **Nada é de graça no catálogo.** Sabor novo já nasce com um tamanho e um
  preço maior que zero, e um sabor só pode ser ligado se algum tamanho tiver preço.
- **Link de pagamento (Mercado Pago)** vale 15 minutos e é cancelado
  automaticamente quando expira.
- **Pagamento após o cancelamento** não é honrado e não gera estorno automático;
  o pedido fica sinalizado para conferência manual.
- **Conversa parada por 24 h** é marcada como abandonada.
- **Kanban** com as colunas *Conversa iniciada · Não pago · Pago · Em entrega*
  (concluído sai do quadro). O operador só arrasta **Pago → Em entrega** e
  **Em entrega → Concluído**; os demais movimentos são bloqueados com o motivo.

---

## Telas

- **Pedidos**: Kanban com arrastar e soltar, números do dia, alertas de
  pagamento tardio e de pedidos acima do limite de peso.
- **Produtos**: catálogo por sabor e tamanho, com preço e chave ativo/inativo.
- **Relatórios**: um relatório por status, filtro por período, soma no rodapé
  (a aba *Todos* soma só o que entrou de dinheiro) e exportação em CSV.
- **Configurações**: parâmetros de frete, prazos e cidades atendidas.
- **Simulador WhatsApp**: conversa com o bot para ver um pedido nascer do zero;
  inclui um relógio de simulação para adiantar o tempo e ver os timers agirem.
- **Regras do MVP**: revisão das telas e do que fica dentro/fora do escopo.

---

## Estrutura do projeto

```
prototipo-painel/
├── index.html            # Casca do app, sprite de ícones e ordem de carga
├── servir.py             # Servidor estático local (sem cache)
├── package.json          # Scripts de teste e start (sem dependências)
├── estilos/              # CSS por área (base, layout, pedidos, relatórios…)
├── src/
│   ├── nucleo/
│   │   ├── regras.js     # Regras de negócio puras (UMD: navegador + Node)
│   │   └── util.js       # Formatação, cópia, helpers de DOM
│   ├── dados/
│   │   ├── dados.js      # Config padrão, catálogo inicial, km por bairro
│   │   └── seed.js       # Gera os pedidos de exemplo em todas as etapas
│   ├── estado/
│   │   └── estado.js     # "Backend" em memória: transições, tick, sessão
│   ├── bot/
│   │   ├── textos.js     # Falas do bot
│   │   ├── cep.js        # Consulta de CEP (ViaCEP + tabela offline)
│   │   └── bot.js        # Máquina de estados da conversa do WhatsApp
│   ├── ui/
│   │   └── ui.js         # Registro de telas, modal, toasts, loop de 1s
│   ├── telas/            # Uma tela por arquivo
│   └── main.js           # Login, menu e inicialização
└── testes/
    └── regras.test.js    # Testes das regras de negócio
```

---

## Testes

As regras de negócio têm testes com o runner nativo do Node (sem dependências):

```bash
npm test
```

---

## Notas técnicas

- **JavaScript puro, sem build nem framework.** Os módulos são IIFE registrados
  em `window.FP`.
- **Estado imutável**, em memória. O `localStorage` é usado só para sincronizar
  abas abertas ao mesmo tempo (painel + simulador), nunca para restaurar sessões
  anteriores, por isso o reload zera tudo.
- **`regras.js` é UMD**: roda no navegador e também sob `node --test`.
- **CEP** consultado no ViaCEP, com tabela offline de reserva.
