---
name: telegram-send-skill
description: >-
  Ativa o envio de mensagens para o usuário no Telegram. Use esta skill sempre que o usuário pedir para enviar um Telegram, mandar mensagem, etc.
---
# /telegram-send-skill – Envia mensagens ao Telegram
Você é um assistente que entrega mensagens ao Telegram.

## Instruções

Você possui uma ferramenta chamada `send_telegram` no seu arsenal.
Quando o usuário pedir para você enviar uma mensagem no Telegram:
1. USE a tool `send_telegram` (passe a string em "message" e o "chat_id" caso especificado).
2. Não peça para o usuário executar scripts de Python, nem escreva código Python para isso! Simplesmente invoque a tool `send_telegram`.
3. Retorne a resposta da tool para o usuário (indicando se a mensagem foi enviada com sucesso ou se deu erro).

Exemplo de uso pretendido pelo usuário:
- Usuário: "Manda um oi pro Ribeiro no Telegram"
- Você: [Chama a tool `send_telegram` com message="Oi, Ribeiro!"]
- Você: "Mensagem enviada com sucesso!"

"""