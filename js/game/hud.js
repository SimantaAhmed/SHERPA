// HUD text and minimap drawing.

import { PLAYER_STATE } from './states.js';

export function createHud(world) {
  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100vw';
  root.style.height = '100vh';
  root.style.pointerEvents = 'none';
  root.style.fontFamily = 'monospace';
  root.style.color = '#f0f6fc';

  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.left = '12px';
  panel.style.top = '12px';
  panel.style.padding = '10px 12px';
  panel.style.background = 'rgba(8, 16, 24, 0.62)';
  panel.style.border = '1px solid rgba(120, 150, 170, 0.5)';
  panel.style.minWidth = '220px';
  root.appendChild(panel);

  const health = document.createElement('div');
  const score = document.createElement('div');
  const mode = document.createElement('div');
  const objective = document.createElement('div');
  const status = document.createElement('div');

  panel.appendChild(health);
  panel.appendChild(score);
  panel.appendChild(mode);
  panel.appendChild(objective);
  panel.appendChild(status);

  const healthbarContainer = document.createElement('div');
  healthbarContainer.style.position = 'absolute';
  healthbarContainer.style.left = '12px';
  healthbarContainer.style.bottom = '12px';
  healthbarContainer.style.width = '200px';
  healthbarContainer.style.height = '24px';
  healthbarContainer.style.background = 'rgba(8, 16, 24, 0.62)';
  healthbarContainer.style.border = '1px solid rgba(120, 150, 170, 0.5)';
  healthbarContainer.style.display = 'flex';
  healthbarContainer.style.alignItems = 'center';
  healthbarContainer.style.overflow = 'hidden';
  root.appendChild(healthbarContainer);

  const healthbarFill = document.createElement('div');
  healthbarFill.style.height = '100%';
  healthbarFill.style.background = 'linear-gradient(90deg, #ef4444, #fbbf24)';
  healthbarFill.style.width = '100%';
  healthbarFill.style.transition = 'width 0.15s ease-out';
  healthbarContainer.appendChild(healthbarFill);

  const healthbarText = document.createElement('div');
  healthbarText.style.position = 'absolute';
  healthbarText.style.left = '8px';
  healthbarText.style.fontSize = '12px';
  healthbarText.style.fontWeight = 'bold';
  healthbarText.style.color = '#f0f6fc';
  healthbarText.style.textShadow = '0 0 4px rgba(0, 0, 0, 0.8)';
  healthbarText.style.pointerEvents = 'none';
  healthbarContainer.appendChild(healthbarText);

  const minimap = document.createElement('canvas');
  minimap.width = 220;
  minimap.height = 220;
  minimap.style.position = 'absolute';
  minimap.style.right = '12px';
  minimap.style.top = '12px';
  minimap.style.border = '1px solid rgba(130, 165, 190, 0.7)';
  minimap.style.background = 'rgba(3, 5, 10, 0.5)';
  root.appendChild(minimap);

  const speech = document.createElement('div');
  speech.style.position = 'absolute';
  speech.style.left = '50%';
  speech.style.bottom = '80px';
  speech.style.transform = 'translateX(-50%)';
  speech.style.padding = '8px 12px';
  speech.style.background = 'rgba(0, 0, 0, 0.7)';
  speech.style.border = '1px solid rgba(150, 200, 255, 0.65)';
  speech.style.display = 'none';
  root.appendChild(speech);

  const gameOver = document.createElement('div');
  gameOver.style.position = 'absolute';
  gameOver.style.left = '50%';
  gameOver.style.top = '50%';
  gameOver.style.transform = 'translate(-50%, -50%)';
  gameOver.style.padding = '16px 22px';
  gameOver.style.background = 'rgba(0, 0, 0, 0.82)';
  gameOver.style.border = '1px solid rgba(250, 180, 180, 0.65)';
  gameOver.style.fontSize = '22px';
  gameOver.style.textAlign = 'center';
  gameOver.style.whiteSpace = 'pre-line';
  gameOver.style.display = 'none';
  gameOver.textContent = 'GAME OVER\nPress R to start over';
  root.appendChild(gameOver);

  document.body.appendChild(root);

  world.hud = { root, panel, health, score, mode, objective, status, speech, gameOver, healthbarFill, healthbarText };
  world.minimapCanvas = minimap;
  world.minimapCtx = minimap.getContext('2d');
}

export function updateHud(world, dt) {
  if (!world.hud) {
    return;
  }

  const playerTile = world.map.quantize(world.player.position);
  const inBlackout = playerTile ? world.map.isBlackoutTile(playerTile) : false;

  world.hud.health.textContent = `Health: ${Math.round(world.player.health)}/${world.player.maxHealth}`;
  world.hud.score.textContent = `Score: ${world.score}`;

  // Update healthbar
  const healthPercent = Math.max(0, Math.min(100, (world.player.health / world.player.maxHealth) * 100));
  world.hud.healthbarFill.style.width = healthPercent + '%';
  world.hud.healthbarText.textContent = `${Math.round(world.player.health)}/${Math.round(world.player.maxHealth)}`;

  const modeLabel = world.player.state === PLAYER_STATE.MECH
    ? 'MECH MODE'
    : (world.player.state === PLAYER_STATE.DRIVE ? 'DRIVE MODE' : 'HACKING');

  const crouchLabel = world.player.isCrouch ? ' [Shift active]' : '';
  world.hud.mode.textContent = `State: ${modeLabel}${crouchLabel}`;

  const completed = world.terminals.filter((t) => t.hacked).length;
  world.hud.objective.textContent = world.extractionUnlocked
    ? 'Objective: Reach extraction point'
    : `Terminals: ${completed}/${world.terminals.length}`;

  if (world.gameOver) {
    if (world.endScreenType === 'clear') {
      world.hud.gameOver.style.border = '1px solid rgba(140, 255, 190, 0.72)';
      world.hud.gameOver.textContent = 'GAME CLEAR\nPress R to start over';
    } else {
      world.hud.gameOver.style.border = '1px solid rgba(250, 180, 180, 0.65)';
      world.hud.gameOver.textContent = 'GAME OVER\nPress R to start over';
    }
    world.hud.gameOver.style.display = 'block';
  } else {
    world.hud.gameOver.style.display = 'none';
  }

  const hackInfo = world.player.hackTarget
    ? `Hacking: ${Math.round((1 - world.player.hackTimer / world.hackDuration) * 100)}%`
    : 'Hack: hold E near terminal';

  const statusBase = world.extractionUnlocked
    ? 'Extraction unlocked: reach the blue ring'
    : hackInfo;

  world.hud.status.textContent = inBlackout
    ? `${statusBase} | BLACKOUT: minimap down`
    : statusBase;

  drawMinimap(world, inBlackout);

  if (world.runFinished) {
    world.hud.status.textContent = 'Run complete: extracted successfully';
  }
}

export function updateMinimap(world) {
  if (!world.minimapCanvas || !world.minimapCtx) return;
  // Use the same blackout logic as drawMinimap
  const playerTile = world.map.quantize(world.player.position);
  const inBlackout = playerTile ? world.map.isBlackoutTile(playerTile) : false;
  drawMinimap(world, inBlackout);
}

export function drawMinimap(world, inBlackout) {
  const ctx = world.minimapCtx;
  const canvas = world.minimapCanvas;
  if (!ctx || !canvas) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (inBlackout) {
    ctx.fillStyle = 'rgba(20, 24, 30, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText('MINIMAP SIGNAL LOST', 24, canvas.height / 2);
    return;
  }

  ctx.fillStyle = 'rgba(12, 16, 24, 0.86)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(130, 150, 170, 0.5)';
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  for (const terminal of world.terminals) {
    const point = worldToMinimap(world, terminal.position, canvas);
    ctx.fillStyle = terminal.hacked ? '#16a34a' : '#facc15';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (world.extractionUnlocked && world.extractionPoint) {
    const point = worldToMinimap(world, world.extractionPoint.position, canvas);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const lurker of world.lurkers) {
    const point = worldToMinimap(world, lurker.position, canvas);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
  }

  const playerPoint = worldToMinimap(world, world.player.position, canvas);
  ctx.fillStyle = '#e0f2fe';
  ctx.beginPath();
  ctx.arc(playerPoint.x, playerPoint.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function worldToMinimap(world, position, canvas) {
  const x = ((position.x - world.map.minX) / world.map.width) * canvas.width;
  const y = ((position.z - world.map.minZ) / world.map.depth) * canvas.height;
  return { x, y };
}
