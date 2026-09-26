#!/bin/bash

# Carrega e exporta as variáveis usando . em vez de source
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

API_URL="https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_SITE_URL="http://localhost:3000"
OPENROUTER_SITE_NAME="Example Site"
NLP_MODEL="google/gemma-4-31b-it:free"

curl --silent -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "HTTP-Referer: $OPENROUTER_SITE_URL" \
  -H "X-Title: $OPENROUTER_SITE_NAME" \
  -d '{
    "model": "'"$NLP_MODEL"'",
    "messages": [
      {
        "role": "user",
        "content": "Me conte uma curiosidade sobre LLMs"
      }
    ],
    "temperature": 0.3,
    "max_tokens": 1000
  }' | jq