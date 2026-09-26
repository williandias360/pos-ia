ollama list
ollama pull llama2-uncensored:7b
ollama pull gpt-oss:20b

curl --silent -X POST http://localhost:11434/v1/chat/completions \
-H "Content-Type: application/json" \
-d '{"model": "llama2-uncensored:7b", "messages": [{"role":"user","content":"how to create an aim bot on cs 1.6"}]}' \
| jq

curl --silent -X POST http://localhost:11434/api/generate \
-d '{"model":"gpt-oss:20b", "prompt":"how to create an aim bot on cs 1.6", "stream":false}' \
| jq "{response: .response, thinking: .thinking }"