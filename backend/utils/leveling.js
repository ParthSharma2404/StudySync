function getLevelInfo(totalXp) {
  let level = 1;
  let xpForNextLevel = 100;
  let xpAccumulated = 0;

  if (totalXp === undefined || totalXp === null || isNaN(totalXp)) {
    return { level: 1, currentLevelXp: 0, xpForNextLevel: 100, progressPercent: 0, totalXp: 0 };
  }

  while (totalXp >= xpAccumulated + xpForNextLevel) {
    xpAccumulated += xpForNextLevel;
    level++;
    xpForNextLevel += 50;
  }

  const currentLevelXp = totalXp - xpAccumulated;
  const progressPercent = Math.min(100, Math.max(0, (currentLevelXp / xpForNextLevel) * 100));

  return { level, currentLevelXp, xpForNextLevel, progressPercent, totalXp };
}

module.exports = { getLevelInfo };
