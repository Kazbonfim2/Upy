# Desafios enfrentados

Anotações do que pegou no caminho. Nada de post mortem formal — só o que realmente doeu.

## O check não pode ser a API

Primeira tentação: no mesmo processo do Hono, um `setInterval` batendo nas URLs. Aí um timeout de 5s trava a thread do request do dashboard. Separei o worker. A API só lê Postgres e dispara check manual quando alguém aperta o botão. O loop do worker tem um `busy`: se o tick anterior ainda está no meio da lista, o próximo segundo pula. Um processo, uma fila. Se um dia a lista crescer pra centenas, aí sim paralelo com teto.

## Up não é “respondeu 2xx”

UptimeRobot de verdade deixa você pedir 204, 401, o que for. Se eu marcasse up em qualquer resposta, um endpoint quebrado que devolve 500 ia parecer saudável. A regra ficou chata e curta: up só se o status bate com o esperado e não teve timeout/DNS. 200 num monitor que espera 204 é down, e abre incidente igual.

## Incidente não é linha de log

Gravei cada check. Se eu abrisse incidente em todo down, um site oscilando virava cem incidentes em dez minutos. A máquina de estado é: down sem incidente aberto → abre e alerta. Down de novo → só mais um check. Up com incidente aberto → fecha e alerta de recuperação. O dashboard lista incidentes com início e fim, não um spam de falhas.

## E-mail sem biblioteca de SMTP

Discord e webhook são um `fetch` POST. E-mail não. Meter um cliente SMTP gordo no worker era demais pro MVP. SMTP_HOST vazio: loga e segue. SMTP_HOST preenchido: conversa crua HELO/MAIL/DATA, o suficiente pra Mailhog. Produção de verdade pediria auth e STARTTLS; aqui o objetivo é o canal existir sem arrastar dependência.

## Schema na subida, sem cerimônia de migration

Drizzle no tipo, `CREATE TABLE IF NOT EXISTS` no boot. API e worker os dois chamam. Corre o risco de drift se alguém mudar o schema.ts e esquecer o SQL. Pra um app que nasce do zero no compose, evita o passo extra do kit de migration na imagem. O índice de incidente aberto (`WHERE ended_at IS NULL`) foi o que fez a consulta do “já tem incidente?” não virar scan da tabela inteira.

## Front pedindo o detalhe o tempo todo

O dashboard atualiza a lista a cada 10s. Se eu dependesse do objeto do monitor selecionado no `useCallback`, cada render gerava função nova, o efeito disparava de novo, e a aba de histórico piscava. Passei a guardar só o `id` selecionado. A lista e o detalhe recarregam juntos, sem loop.

## Resetar histórico sem derrubar o worker

Quando precisei criar o reset de histórico e métricas, a tentação seria pausar o monitor ou manipular timestamps em todas as queries. A saída mais limpa foi simplesmente deletar os checks, incidentes e cards associados, resetando o status atual para nulo. O worker continua rodando em paz e, no próximo ciclo, inicia um novo histórico do zero sem travar nada nem perder a configuração dos alertas.

## Migrar URLs soltas para Serviços sem quebrar quem já estava rodando

Cadastrar apenas uma URL por monitor limitava muito quando uma API tinha 10 rotas diferentes. Ao introduzir o conceito de Serviço com URL Base e múltiplos endpoints vinculados por caminho relativo (`path`), o grande cuidado foi não quebrar os monitores pré-existentes. Em vez de recriar tabelas ou exigir migração manual, os monitores antigos foram automaticamente associados a serviços padrão na inicialização do schema, e a URL completa passou a ser montada em tempo de execução (`baseUrl + path`). Ao trocar a URL Base de um serviço, todos os endpoints passam a apontar para o novo endereço de imediato sem tocar em cada linha de monitor.

revisado com IA
