// 음성마다 1배속에서 1초에 읽는 글자 수를 실제로 들은 문장으로 학습해 남은 시간을 계산한다.
const STORAGE_KEY = "tts-reader-speech-rate";

/** 측정 전 기본값. edge-tts 한국어 음성(SunHi 6.8, InJoon 6.6)을 1배속으로 잰 값. */
export const DEFAULT_CHARS_PER_SECOND = 6.7;
/** 이만큼 들어 본 뒤부터 측정값을 쓴다. */
const MIN_SAMPLE_SECONDS = 30;
/** 최근 기록 위주로 남기려고, 이 길이를 넘으면 누적값을 절반으로 줄인다. */
const MAX_SAMPLE_SECONDS = 3600;

export type SpeechSample = { chars: number; seconds: number };
export type SpeechRates = Record<string, SpeechSample>;

export function loadSpeechRates(): SpeechRates {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SpeechRates | null) ?? {};
  } catch {
    return {};
  }
}

export function saveSpeechRates(rates: SpeechRates): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
}

/** 끝까지 들은 문장 하나를 더한다. secondsAtNormalSpeed는 1배속 기준 재생 시간. */
export function addSpeechSample(
  rates: SpeechRates,
  voice: string,
  chars: number,
  secondsAtNormalSpeed: number,
): SpeechRates {
  if (chars <= 0 || !(secondsAtNormalSpeed > 0)) {
    return rates;
  }
  let sample = rates[voice] ?? { chars: 0, seconds: 0 };
  sample = { chars: sample.chars + chars, seconds: sample.seconds + secondsAtNormalSpeed };
  if (sample.seconds > MAX_SAMPLE_SECONDS) {
    sample = { chars: sample.chars / 2, seconds: sample.seconds / 2 };
  }
  return { ...rates, [voice]: sample };
}

/** 1배속 기준 초당 글자 수. 충분히 듣지 않았으면 기본값. */
export function charsPerSecond(rates: SpeechRates, voice: string): number {
  const sample = rates[voice];
  if (!sample || sample.seconds < MIN_SAMPLE_SECONDS) {
    return DEFAULT_CHARS_PER_SECOND;
  }
  return sample.chars / sample.seconds;
}

export function isMeasured(rates: SpeechRates, voice: string): boolean {
  return (rates[voice]?.seconds ?? 0) >= MIN_SAMPLE_SECONDS;
}

export function estimateSeconds(chars: number, rate: number, speed: number): number {
  return chars / rate / speed;
}

/** "2시간 5분", "35분", "1분 미만" */
export function formatRemaining(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return seconds > 0 ? "1분 미만" : "0분";
  }
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}
