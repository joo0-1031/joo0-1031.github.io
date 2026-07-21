(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const gridSize = 24;
  const cellSize = canvas.width / gridSize;
  const tickRate = 125;
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const scoreElement = document.querySelector('#score');
  const bestScoreElement = document.querySelector('#best-score');
  const statusElement = document.querySelector('#game-status');
  const enemyCountElement = document.querySelector('#enemy-count');
  const feedbackElement = document.querySelector('#game-feedback');
  const overlay = document.querySelector('#game-overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayMessage = document.querySelector('#overlay-message');
  const startButton = document.querySelector('#start-button');
  const pauseButton = document.querySelector('#pause-button');
  const restartButton = document.querySelector('#restart-button');
  const bestKey = 'joo-worm-best-score';

  let snake;
  let direction;
  let queuedDirection;
  let food;
  let enemies;
  let characters;
  let effects;
  let score = 0;
  let timer = null;
  let running = false;
  let paused = false;

  const randomCell = () => ({ x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) });
  const sameCell = (a, b) => a.x === b.x && a.y === b.y;
  const isBlocked = (cell, ignoredCharacter = null) => snake.some((part) => sameCell(part, cell))
    || enemies.some((enemy) => sameCell(enemy, cell))
    || characters.some((character) => character !== ignoredCharacter && sameCell(character, cell));

  function openCell(ignoredCharacter = null) {
    let candidate = randomCell();
    while (isBlocked(candidate, ignoredCharacter) || (food && sameCell(candidate, food))) candidate = randomCell();
    return candidate;
  }

  function getBestScore() {
    try { return Number(localStorage.getItem(bestKey)) || 0; } catch { return 0; }
  }

  function saveBestScore() {
    try { localStorage.setItem(bestKey, String(score)); } catch { /* storage may be unavailable */ }
  }

  function placeFood() {
    food = openCell();
  }

  function createEnemy() {
    const candidate = openCell();
    return { ...candidate, direction: Object.keys(directions)[Math.floor(Math.random() * 4)] };
  }

  function resetState() {
    snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
    direction = 'right';
    queuedDirection = 'right';
    score = 0;
    enemies = [];
    characters = [{ x: 4, y: 4, icon: '🐶', label: '강아지', points: 50, color: '#d98954' }, { x: 19, y: 18, icon: '👶', label: '아기', points: 100, color: '#e8b8a7' }];
    effects = [];
    placeFood();
    enemies = [createEnemy(), createEnemy()];
    updateScore();
    updateEnemyCount();
    setFeedback('빨간 뿔 얼굴은 적이에요. 강아지와 아기를 먹으면 보너스 점수와 함께 자랍니다.');
    draw();
  }

  function updateScore() {
    scoreElement.textContent = String(score);
    bestScoreElement.textContent = String(Math.max(score, getBestScore()));
  }

  function setOverlay(title, message, visible = true) {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlay.classList.toggle('is-hidden', !visible);
  }

  function setStatus(value) {
    statusElement.textContent = value;
  }

  function updateEnemyCount() {
    enemyCountElement.textContent = `적 ${enemies.length}`;
  }

  function setFeedback(message) {
    feedbackElement.textContent = message;
  }

  function addPopEffect(cell, character) {
    effects.push({ x: cell.x, y: cell.y, text: `뿅! +${character.points}`, color: character.color, life: 14 });
  }

  function start() {
    if (running && !paused) return;
    if (!running) resetState();
    running = true;
    paused = false;
    setStatus('RUNNING');
    setOverlay('', '', false);
    startButton.disabled = true;
    pauseButton.disabled = false;
    if (timer === null) timer = window.setInterval(tick, tickRate);
  }

  function pause() {
    if (!running) return;
    paused = !paused;
    setStatus(paused ? 'PAUSED' : 'RUNNING');
    setOverlay(paused ? '일시정지' : '', paused ? '계속하려면 일시정지 버튼을 다시 누르세요.' : '', paused);
  }

  function restart() {
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    running = false;
    paused = false;
    resetState();
    setStatus('READY');
    setOverlay('지렁이 게임', '시작 버튼을 눌러 게임을 시작하세요.');
    startButton.disabled = false;
    pauseButton.disabled = true;
  }

  function gameOver() {
    running = false;
    paused = false;
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    if (score > getBestScore()) saveBestScore();
    updateScore();
    setStatus('GAME OVER');
    setOverlay('게임 오버', `점수 ${score}점 · 재시작 버튼으로 다시 도전하세요.`);
    startButton.disabled = false;
    pauseButton.disabled = true;
  }

  function setDirection(next) {
    if (!directions[next] || reverse[direction] === next) return;
    queuedDirection = next;
  }

  function moveEnemies() {
    enemies = enemies.map((enemy) => {
      if (Math.random() < 0.35) enemy.direction = Object.keys(directions)[Math.floor(Math.random() * 4)];
      const step = directions[enemy.direction];
      const next = { x: enemy.x + step.x, y: enemy.y + step.y };
      if (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize) {
        enemy.direction = reverse[enemy.direction];
        return { ...enemy, direction: enemy.direction };
      }
      return { ...enemy, x: next.x, y: next.y };
    });
  }

  function tick() {
    if (!running || paused) return;
    direction = queuedDirection;
    const step = directions[direction];
    const head = { x: snake[0].x + step.x, y: snake[0].y + step.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
    const hitSelf = snake.some((part) => sameCell(part, head));
    const hitEnemy = enemies.some((enemy) => sameCell(enemy, head));
    if (hitWall || hitSelf || hitEnemy) { gameOver(); return; }
    snake.unshift(head);
    const eatenCharacter = characters.find((character) => sameCell(character, head));
    const ateFood = sameCell(head, food);
    if (ateFood) {
      score += 10;
      placeFood();
      setFeedback('사과를 먹었어요! +10점 · 지렁이가 한 칸 자랐습니다.');
    } else if (eatenCharacter) {
      score += eatenCharacter.points;
      addPopEffect(head, eatenCharacter);
      const nextPosition = openCell(eatenCharacter);
      eatenCharacter.x = nextPosition.x;
      eatenCharacter.y = nextPosition.y;
      setFeedback(`${eatenCharacter.icon} ${eatenCharacter.label}을(를) 먹었어요! +${eatenCharacter.points}점 · 크게 성장!`);
    } else {
      snake.pop();
    }
    if (score >= 50 && enemies.length < 4 && score % 50 < 10) enemies.push(createEnemy());
    updateEnemyCount();
    updateScore();
    moveEnemies();
    effects = effects.map((effect) => ({ ...effect, y: effect.y - 0.08, life: effect.life - 1 })).filter((effect) => effect.life > 0);
    if (enemies.some((enemy) => sameCell(enemy, snake[0]))) { gameOver(); return; }
    draw();
  }

  function drawCell(cell, color, radius = 4) {
    const x = cell.x * cellSize;
    const y = cell.y * cellSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, radius);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#dfe7df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(28,43,42,.06)';
    for (let i = 1; i < gridSize; i += 1) { const position = i * cellSize; ctx.beginPath(); ctx.moveTo(position, 0); ctx.lineTo(position, canvas.height); ctx.moveTo(0, position); ctx.lineTo(canvas.width, position); ctx.stroke(); }
    characters.forEach((character) => {
      drawCell(character, character.color, 8);
      ctx.strokeStyle = '#fffdf9'; ctx.lineWidth = 2; ctx.strokeRect(character.x * cellSize + 3, character.y * cellSize + 3, cellSize - 6, cellSize - 6);
      ctx.font = `${cellSize * .72}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(character.icon, character.x * cellSize + cellSize / 2, character.y * cellSize + cellSize / 2 + 1);
    });
    drawCell(food, '#d94f3d', 10);
    enemies.forEach(drawEnemy);
    snake.forEach((part, index) => drawCell(part, index === 0 ? '#1c2b2a' : '#55776b', 8));
    drawCell(snake[0], '#1c2b2a', 8);
    ctx.fillStyle = '#f5f3ee'; ctx.beginPath(); ctx.arc(snake[0].x * cellSize + cellSize * .38, snake[0].y * cellSize + cellSize * .38, 2, 0, Math.PI * 2); ctx.arc(snake[0].x * cellSize + cellSize * .62, snake[0].y * cellSize + cellSize * .38, 2, 0, Math.PI * 2); ctx.fill();
    effects.forEach(drawPopEffect);
  }

  function drawPopEffect(effect) {
    const x = effect.x * cellSize + cellSize / 2;
    const y = effect.y * cellSize + cellSize / 2;
    const alpha = Math.min(1, effect.life / 6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, cellSize * (1.1 - effect.life / 35), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8b3f35';
    ctx.font = `700 ${cellSize * .52}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effect.text, x, y - cellSize * .72);
    ctx.restore();
  }

  function drawEnemy(enemy) {
    const x = enemy.x * cellSize;
    const y = enemy.y * cellSize;
    ctx.strokeStyle = '#8f3028'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * .48, 0, Math.PI * 2); ctx.stroke();
    drawCell(enemy, '#e26d5a', 8);
    ctx.fillStyle = '#f8f4eb';
    ctx.beginPath();
    ctx.moveTo(x + cellSize * .2, y + 4); ctx.lineTo(x + cellSize * .32, y - 1); ctx.lineTo(x + cellSize * .44, y + 4);
    ctx.moveTo(x + cellSize * .56, y + 4); ctx.lineTo(x + cellSize * .68, y - 1); ctx.lineTo(x + cellSize * .8, y + 4); ctx.fill();
    ctx.fillStyle = '#1c2b2a';
    ctx.beginPath();
    ctx.arc(x + cellSize * .35, y + cellSize * .42, 2, 0, Math.PI * 2); ctx.arc(x + cellSize * .65, y + cellSize * .42, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c2b2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + cellSize * .28, y + cellSize * .28); ctx.lineTo(x + cellSize * .42, y + cellSize * .34); ctx.moveTo(x + cellSize * .58, y + cellSize * .34); ctx.lineTo(x + cellSize * .72, y + cellSize * .28); ctx.moveTo(x + cellSize * .36, y + cellSize * .68); ctx.quadraticCurveTo(x + cellSize * .5, y + cellSize * .8, x + cellSize * .64, y + cellSize * .68); ctx.stroke();
  }

  document.addEventListener('keydown', (event) => {
    const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (keyMap[event.key]) { event.preventDefault(); setDirection(keyMap[event.key]); }
    if (event.key === ' ') { event.preventDefault(); pause(); }
  });
  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', pause);
  restartButton.addEventListener('click', restart);
  bestScoreElement.textContent = String(getBestScore());
  resetState();
})();
