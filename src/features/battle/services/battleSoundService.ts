/**
 * Battle Sound Service
 *
 * @role 전투 시스템의 효과음 재생 관리
 * @description Web Audio API를 사용하여 공격/처치 효과음 생성 및 재생
 */

// 오디오 컨텍스트 (lazy initialization)
let audioContext: AudioContext | null = null;

/**
 * AudioContext 초기화 (사용자 인터랙션 후 호출 필요)
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * 공격 효과음 재생
 * - 짧고 날카로운 "스윙" 사운드
 */
export function playAttackSound(): void {
  try {
    const ctx = getAudioContext();
    const currentTime = ctx.currentTime;

    // 오실레이터 생성 (공격 스윙 사운드)
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // 날카로운 공격음 설정
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, currentTime + 0.1);

    // 볼륨 엔벨로프
    gainNode.gain.setValueAtTime(0.3, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + 0.15);

    // 추가 임팩트 사운드
    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();

    impactOsc.connect(impactGain);
    impactGain.connect(ctx.destination);

    impactOsc.type = 'square';
    impactOsc.frequency.setValueAtTime(150, currentTime + 0.05);
    impactOsc.frequency.exponentialRampToValueAtTime(50, currentTime + 0.15);

    impactGain.gain.setValueAtTime(0.2, currentTime + 0.05);
    impactGain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);

    impactOsc.start(currentTime + 0.05);
    impactOsc.stop(currentTime + 0.2);
  } catch (error) {
    console.warn('Failed to play attack sound:', error);
  }
}

/**
 * 보스 처치 효과음 재생
 * - 승리 팡파레 느낌의 상승 음계
 */
export function playBossDefeatSound(): void {
  try {
    const ctx = getAudioContext();
    const currentTime = ctx.currentTime;

    // 승리 팡파레 시퀀스
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.15;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, currentTime + index * noteDuration);

      gain.gain.setValueAtTime(0, currentTime + index * noteDuration);
      gain.gain.linearRampToValueAtTime(0.25, currentTime + index * noteDuration + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, currentTime + index * noteDuration + noteDuration);

      osc.start(currentTime + index * noteDuration);
      osc.stop(currentTime + index * noteDuration + noteDuration + 0.05);
    });

    // 마지막 화려한 효과
    setTimeout(() => {
      const finalOsc = ctx.createOscillator();
      const finalGain = ctx.createGain();

      finalOsc.connect(finalGain);
      finalGain.connect(ctx.destination);

      finalOsc.type = 'sine';
      finalOsc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      finalOsc.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 0.3);

      finalGain.gain.setValueAtTime(0.2, ctx.currentTime);
      finalGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      finalOsc.start(ctx.currentTime);
      finalOsc.stop(ctx.currentTime + 0.4);
    }, notes.length * noteDuration * 1000);
  } catch (error) {
    console.warn('Failed to play boss defeat sound:', error);
  }
}

/**
 * 전체 완료 효과음 재생
 * - 더 화려한 승리 팡파레
 */
export function playAllClearSound(): void {
  try {
    const ctx = getAudioContext();
    const currentTime = ctx.currentTime;

    // 화려한 아르페지오
    const notes = [
      { freq: 523.25, time: 0 },
      { freq: 659.25, time: 0.1 },
      { freq: 783.99, time: 0.2 },
      { freq: 1046.5, time: 0.3 },
      { freq: 783.99, time: 0.4 },
      { freq: 1046.5, time: 0.5 },
      { freq: 1318.5, time: 0.6 },
      { freq: 1567.98, time: 0.7 },
    ];

    notes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, currentTime + time);

      gain.gain.setValueAtTime(0, currentTime + time);
      gain.gain.linearRampToValueAtTime(0.2, currentTime + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, currentTime + time + 0.2);

      osc.start(currentTime + time);
      osc.stop(currentTime + time + 0.25);
    });
  } catch (error) {
    console.warn('Failed to play all clear sound:', error);
  }
}
