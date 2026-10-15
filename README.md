# Flappy Mike 🎂

Joguinho estilo Flappy Bird do aniversário do Mike: voe por o **Jardim Nova República** (Cubatão), os **manguezais de Cubatão** e **São Paulo**, colete os 15 guarás e chegue na festa.

- Toque / clique / espaço para voar · `P` pausa · `M` som
- 3 vidas, 3 fases de voo (8, 10 e 12 obstáculos)
- Fase 4, **O Show**: 3 músicas estilo Guitar Hero (toque nas 3 pistas ou use A, S, D); depois aparece o convite
- As músicas ficam em `assets/music/`; as notas foram geradas a partir das batidas e estão em `SONGS` no `game.js`
- `?fase=2`, `?fase=3` ou `?fase=4` na URL pula direto pra uma fase (pra testar)

## Trilha
- Fases 1 e 2: Hino de Cubatão (`assets/music/hino-cubatao.mp3`)
- Fase 3: Tiro ao Álvaro, remix 8-bit (`assets/music/tiro-ao-alvaro.mp3`)
- Final: tema épico em chiptune (`assets/music/final-epico.mp3`)
- `?fase=fim` na URL abre direto a tela final (pra testar)

## Editar o convite
No topo de `game.js`, em `CONFIG.festa`: data, hora, local, endereço, link do mapa, o número de WhatsApp que recebe as confirmações (`whatsapp`, só dígitos com 55 + DDD) e as mensagens dos botões.

## Publicar
É um site estático: GitHub Pages (Settings → Pages → branch `main`, pasta raiz) ou Netlify.
