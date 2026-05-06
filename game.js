// ============================================================
//  DOT CONNECT — A Dots & Boxes Game
//  Two players connect dots to complete boxes. Completing a
//  box earns a point and an extra turn. Most boxes wins!
// ============================================================

(() => {
  'use strict';

  // ---- Configuration ----
  const COLORS = {
    p1: { primary: '#6366f1', light: '#a5b4fc', fill: 'rgba(99,102,241,0.18)', glow: 'rgba(99,102,241,0.5)' },
    p2: { primary: '#f43f5e', light: '#fda4af', fill: 'rgba(244,63,94,0.18)', glow: 'rgba(244,63,94,0.5)' },
    dot:       '#94a3b8',
    dotGlow:   'rgba(148,163,184,0.35)',
    lineIdle:  'rgba(148,163,184,0.12)',
    lineHover: 'rgba(255,255,255,0.3)',
  };

  const DOT_RADIUS   = 6;
  const LINE_WIDTH   = 4;
  const PADDING      = 40;
  const CELL_SIZE    = 80;    // px between dots

  // ---- State ----
  let gridSize   = 4;         // dots per side
  let currentPlayer = 1;      // 1 or 2
  let scores     = [0, 0];
  let lines      = {};        // "r,c-r,c" → player
  let boxes      = {};        // "r,c" → player  (top-left corner)
  let hoveredLine = null;
  let gameOver   = false;
  let totalBoxes = 0;

  // ---- DOM Refs ----
  const canvas  = document.getElementById('game-canvas');
  const ctx     = canvas.getContext('2d');
  const bgCanvas = document.getElementById('bg-canvas');
  const bgCtx   = bgCanvas.getContext('2d');

  const p1Card  = document.getElementById('player1-card');
  const p2Card  = document.getElementById('player2-card');
  const p1Score = document.getElementById('player1-score');
  const p2Score = document.getElementById('player2-score');
  const statusText = document.getElementById('status-text');

  const modal       = document.getElementById('victory-modal');
  const winnerText  = document.getElementById('winner-text');
  const finalScore  = document.getElementById('final-score');
  const playAgainBtn = document.getElementById('play-again-btn');
  const resetBtn    = document.getElementById('reset-btn');
  const confettiContainer = document.getElementById('confetti-container');

  // ---- Helpers ----
  function lineKey(r1, c1, r2, c2) {
    // Normalize: smaller coord first
    if (r1 < r2 || (r1 === r2 && c1 < c2)) return `${r1},${c1}-${r2},${c2}`;
    return `${r2},${c2}-${r1},${c1}`;
  }

  function dotPos(r, c) {
    return { x: PADDING + c * CELL_SIZE, y: PADDING + r * CELL_SIZE };
  }

  function canvasSize() {
    return PADDING * 2 + (gridSize - 1) * CELL_SIZE;
  }

  // ---- Init / Reset ----
  function initGame() {
    const size = canvasSize();
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    currentPlayer = 1;
    scores = [0, 0];
    lines  = {};
    boxes  = {};
    hoveredLine = null;
    gameOver = false;
    totalBoxes = (gridSize - 1) * (gridSize - 1);

    updateUI();
    draw();
    modal.classList.add('hidden');
  }

  function updateUI() {
    p1Score.textContent = scores[0];
    p2Score.textContent = scores[1];

    p1Card.classList.toggle('active', currentPlayer === 1 && !gameOver);
    p2Card.classList.toggle('active', currentPlayer === 2 && !gameOver);

    if (!gameOver) {
      statusText.textContent = `Player ${currentPlayer}'s Turn`;
      statusText.style.color = currentPlayer === 1 ? COLORS.p1.light : COLORS.p2.light;
    }
  }

  // ---- Drawing ----
  function draw() {
    const size = canvasSize();
    ctx.clearRect(0, 0, size, size);

    drawIdleLines();
    drawPlacedLines();
    drawFilledBoxes();
    if (hoveredLine && !gameOver) drawHoverLine();
    drawDots();
  }

  function drawIdleLines() {
    ctx.strokeStyle = COLORS.lineIdle;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    // Horizontal lines
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const key = lineKey(r, c, r, c + 1);
        if (!lines[key]) {
          const a = dotPos(r, c), b = dotPos(r, c + 1);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    // Vertical lines
    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = lineKey(r, c, r + 1, c);
        if (!lines[key]) {
          const a = dotPos(r, c), b = dotPos(r + 1, c);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
  }

  function drawPlacedLines() {
    ctx.lineWidth = LINE_WIDTH + 1;
    ctx.lineCap = 'round';
    for (const [key, player] of Object.entries(lines)) {
      const col = player === 1 ? COLORS.p1 : COLORS.p2;
      const [partA, partB] = key.split('-');
      const [r1, c1] = partA.split(',').map(Number);
      const [r2, c2] = partB.split(',').map(Number);
      const a = dotPos(r1, c1), b = dotPos(r2, c2);

      // Glow
      ctx.save();
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = col.primary;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
  }

  function drawFilledBoxes() {
    for (const [key, player] of Object.entries(boxes)) {
      const [r, c] = key.split(',').map(Number);
      const tl = dotPos(r, c);
      const col = player === 1 ? COLORS.p1 : COLORS.p2;
      const textCol = player === 1 ? COLORS.p1.light : COLORS.p2.light;

      ctx.fillStyle = col.fill;
      const margin = 6;
      const boxW = CELL_SIZE - margin * 2;
      ctx.beginPath();
      roundedRect(ctx, tl.x + margin, tl.y + margin, boxW, boxW, 6);
      ctx.fill();

      // Player label
      ctx.fillStyle = textCol;
      ctx.font = '600 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${player}`, tl.x + CELL_SIZE / 2, tl.y + CELL_SIZE / 2);
    }
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHoverLine() {
    const { r1, c1, r2, c2 } = hoveredLine;
    const key = lineKey(r1, c1, r2, c2);
    if (lines[key]) return;
    const a = dotPos(r1, c1), b = dotPos(r2, c2);
    const col = currentPlayer === 1 ? COLORS.p1 : COLORS.p2;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = col.primary;
    ctx.lineWidth = LINE_WIDTH + 1;
    ctx.lineCap = 'round';
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }

  function drawDots() {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const { x, y } = dotPos(r, c);

        // Outer glow
        ctx.save();
        ctx.shadowColor = COLORS.dotGlow;
        ctx.shadowBlur = 10;
        ctx.fillStyle = COLORS.dot;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Inner bright dot
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- Interaction ----
  function getClosestLine(mx, my) {
    let best = null;
    let bestDist = Infinity;

    // Check horizontal lines
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const a = dotPos(r, c), b = dotPos(r, c + 1);
        const d = pointToSegmentDist(mx, my, a.x, a.y, b.x, b.y);
        if (d < bestDist) { bestDist = d; best = { r1: r, c1: c, r2: r, c2: c + 1 }; }
      }
    }
    // Check vertical lines
    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize; c++) {
        const a = dotPos(r, c), b = dotPos(r + 1, c);
        const d = pointToSegmentDist(mx, my, a.x, a.y, b.x, b.y);
        if (d < bestDist) { bestDist = d; best = { r1: r, c1: c, r2: r + 1, c2: c }; }
      }
    }

    return bestDist < 18 ? best : null;
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const nx = x1 + t * dx, ny = y1 + t * dy;
    return Math.hypot(px - nx, py - ny);
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousemove', (e) => {
    if (gameOver) return;
    const { x, y } = getMousePos(e);
    const closest = getClosestLine(x, y);

    if (closest) {
      const key = lineKey(closest.r1, closest.c1, closest.r2, closest.c2);
      if (lines[key]) {
        hoveredLine = null;
        canvas.style.cursor = 'default';
      } else {
        hoveredLine = closest;
        canvas.style.cursor = 'pointer';
      }
    } else {
      hoveredLine = null;
      canvas.style.cursor = 'default';
    }
    draw();
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredLine = null;
    draw();
  });

  canvas.addEventListener('click', (e) => {
    if (gameOver) return;
    const { x, y } = getMousePos(e);
    const closest = getClosestLine(x, y);
    if (!closest) return;

    const key = lineKey(closest.r1, closest.c1, closest.r2, closest.c2);
    if (lines[key]) return; // already placed

    // Place line
    lines[key] = currentPlayer;

    // Check for completed boxes
    const completedBoxes = checkNewBoxes(closest);

    if (completedBoxes > 0) {
      scores[currentPlayer - 1] += completedBoxes;
      // Score animation
      animateScore(currentPlayer);

      // Check for game over
      if (scores[0] + scores[1] === totalBoxes) {
        gameOver = true;
        showVictory();
      }
      // Player keeps their turn!
    } else {
      // Switch player
      currentPlayer = currentPlayer === 1 ? 2 : 1;
    }

    updateUI();
    draw();
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameOver) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    const closest = getClosestLine(mx, my);
    if (!closest) return;

    const key = lineKey(closest.r1, closest.c1, closest.r2, closest.c2);
    if (lines[key]) return;

    lines[key] = currentPlayer;
    const completedBoxes = checkNewBoxes(closest);

    if (completedBoxes > 0) {
      scores[currentPlayer - 1] += completedBoxes;
      animateScore(currentPlayer);
      if (scores[0] + scores[1] === totalBoxes) {
        gameOver = true;
        showVictory();
      }
    } else {
      currentPlayer = currentPlayer === 1 ? 2 : 1;
    }
    updateUI();
    draw();
  }, { passive: false });

  function checkNewBoxes(line) {
    const { r1, c1, r2, c2 } = line;
    let completed = 0;

    if (r1 === r2) {
      // Horizontal line at row r, from c to c+1
      const r = r1, c = Math.min(c1, c2);
      // Box above (r-1, c)
      if (r > 0) {
        if (isBoxComplete(r - 1, c)) {
          boxes[`${r - 1},${c}`] = currentPlayer;
          completed++;
        }
      }
      // Box below (r, c)
      if (r < gridSize - 1) {
        if (isBoxComplete(r, c)) {
          boxes[`${r},${c}`] = currentPlayer;
          completed++;
        }
      }
    } else {
      // Vertical line at col c, from r to r+1
      const c = c1, r = Math.min(r1, r2);
      // Box to the left (r, c-1)
      if (c > 0) {
        if (isBoxComplete(r, c - 1)) {
          boxes[`${r},${c - 1}`] = currentPlayer;
          completed++;
        }
      }
      // Box to the right (r, c)
      if (c < gridSize - 1) {
        if (isBoxComplete(r, c)) {
          boxes[`${r},${c}`] = currentPlayer;
          completed++;
        }
      }
    }
    return completed;
  }

  function isBoxComplete(r, c) {
    // Already claimed?
    if (boxes[`${r},${c}`]) return false;
    // Check 4 edges
    const top    = lineKey(r, c, r, c + 1);
    const bottom = lineKey(r + 1, c, r + 1, c + 1);
    const left   = lineKey(r, c, r + 1, c);
    const right  = lineKey(r, c + 1, r + 1, c + 1);
    return !!(lines[top] && lines[bottom] && lines[left] && lines[right]);
  }

  // ---- Animations ----
  function animateScore(player) {
    const el = player === 1 ? p1Score : p2Score;
    el.style.transition = 'none';
    el.style.transform = 'scale(1.4)';
    setTimeout(() => {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'scale(1)';
    }, 50);
  }

  // ---- Victory ----
  function showVictory() {
    const s1 = scores[0], s2 = scores[1];
    const winnerEl = document.getElementById('winner-text');

    if (s1 > s2) {
      winnerEl.textContent = 'Player 1 Wins!';
      winnerEl.className = 'p1-wins';
    } else if (s2 > s1) {
      winnerEl.textContent = 'Player 2 Wins!';
      winnerEl.className = 'p2-wins';
    } else {
      winnerEl.textContent = "It's a Draw!";
      winnerEl.className = 'draw';
    }

    finalScore.textContent = `Score: ${s1} — ${s2}`;
    statusText.textContent = s1 === s2 ? "It's a Draw!" : `Player ${s1 > s2 ? 1 : 2} Wins!`;

    // Show modal with slight delay
    setTimeout(() => {
      modal.classList.remove('hidden');
      spawnConfetti();
    }, 400);
  }

  function spawnConfetti() {
    confettiContainer.innerHTML = '';
    const colors = ['#6366f1', '#a78bfa', '#f43f5e', '#fda4af', '#34d399', '#fbbf24', '#60a5fa'];
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 1.5 + 's';
      piece.style.animationDuration = (2 + Math.random() * 2) + 's';
      piece.style.width = (5 + Math.random() * 6) + 'px';
      piece.style.height = (5 + Math.random() * 6) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      confettiContainer.appendChild(piece);
    }
  }

  // ---- Grid Size Buttons ----
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newSize = parseInt(btn.dataset.size);
      if (newSize === gridSize && Object.keys(lines).length === 0) return;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gridSize = newSize;
      initGame();
    });
  });

  resetBtn.addEventListener('click', initGame);
  playAgainBtn.addEventListener('click', initGame);

  // ---- Background Animation ----
  function initBackground() {
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      bgCanvas.width = window.innerWidth * dpr;
      bgCanvas.height = window.innerHeight * dpr;
      bgCanvas.style.width = window.innerWidth + 'px';
      bgCanvas.style.height = window.innerHeight + 'px';
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Floating particles
    const particles = [];
    const PARTICLE_COUNT = 40;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1.5 + Math.random() * 2,
        alpha: 0.08 + Math.random() * 0.15,
        color: Math.random() > 0.5 ? '99,102,241' : '244,63,94',
      });
    }

    function animateBg() {
      bgCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) p.y = 0;

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(${p.color},${p.alpha})`;
        bgCtx.fill();
      }

      // Draw connections between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            bgCtx.beginPath();
            bgCtx.moveTo(particles[i].x, particles[i].y);
            bgCtx.lineTo(particles[j].x, particles[j].y);
            bgCtx.strokeStyle = `rgba(148,163,184,${0.04 * (1 - dist / 150)})`;
            bgCtx.lineWidth = 0.8;
            bgCtx.stroke();
          }
        }
      }

      requestAnimationFrame(animateBg);
    }
    animateBg();
  }

  // ---- Window resize handler for game canvas ----
  window.addEventListener('resize', () => {
    // Background handled in initBackground
    // Game canvas is fixed size, no resize needed
  });

  // ---- Launch ----
  initBackground();
  initGame();
})();
