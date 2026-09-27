import type { Platform, Tone } from './types';

export interface PlatformSpec {
  id: Platform;
  label: string;
  short: string;
  /** CSS width the image actually renders at in the feed, on a phone. */
  displayWidth: number;
  displayNote: string;
  /** Aspect the feed crops to (w / h). */
  aspect: number;
  /** Sobel edge density above which the image reads as busy at feed size. */
  complexityCeiling: number;
}

export const PLATFORMS: Record<Platform, PlatformSpec> = {
  youtube: {
    id: 'youtube',
    label: 'YouTube thumbnail',
    short: 'YouTube',
    displayWidth: 320,
    displayNote: '320px wide feed tile',
    aspect: 16 / 9,
    complexityCeiling: 0.2,
  },
  ig_post: {
    id: 'ig_post',
    label: 'Instagram post',
    short: 'IG post',
    displayWidth: 375,
    displayNote: '375px phone feed',
    aspect: 4 / 5,
    complexityCeiling: 0.24,
  },
  ig_story: {
    id: 'ig_story',
    label: 'Instagram story',
    short: 'IG story',
    displayWidth: 375,
    displayNote: '375px full-screen story',
    aspect: 9 / 16,
    complexityCeiling: 0.22,
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    short: 'LinkedIn',
    displayWidth: 350,
    displayNote: '350px mobile feed card',
    aspect: 1.91,
    complexityCeiling: 0.18,
  },
  ad: {
    id: 'ad',
    label: 'Ad creative',
    short: 'Ad',
    displayWidth: 300,
    displayNote: '300×250 medium rectangle',
    aspect: 1.2,
    complexityCeiling: 0.18,
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export const TONES: Tone[] = ['playful', 'authoritative', 'warm', 'minimal', 'bold', 'editorial'];

/** Thresholds shared by the rules and the "what differs" list. */
export const MIN_TEXT_PX = 14;
export const MIN_CONTRAST = 3;
export const MIN_FACE_PCT = 8;
