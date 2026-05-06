export enum StoreName {
  KTOWN4U = 'Ktown4u',
  WEVERSE = 'Weverse Shop',
  WITHMUU = 'Withmuu',
  MAKESTAR = 'Makestar',
  SOUNDWAVE = 'Soundwave',
  APPLE_MUSIC = 'Apple Music',
  HELLO_LIVE = 'Hello Live',
  BLUE_DREAM_MEDIA = 'Blue Dream Media',
  MUSIC_KOREA = 'Music Korea',
  INTER_ASIA = 'Inter Asia',
  MINI_RECORD = 'Mini Record',
  MUSIC_PLANT = 'Music Plant',
  WHOSFAN = 'Whosfan Store',
  FLINK = 'Flink',
  INSIDE_RECORD = 'Inside Record',
  JJ_MUSE = 'JJ Muse',
  JUMP_UP = 'Jump Up',
  ITTA = 'ITTA',
  MOKKET_SHOP = 'Mokket Shop',
  DMC_MUSIC = 'DMC Music',
  MUSIC_N_DRAMA = 'Music & Drama',
  HELLO82 = 'hello82',
  K_N_POPS = 'K&Pops',
  ALL_MD = 'All MD',
  FANPLEE = 'Fanplee',
  MUSIC_ART = 'Music Art',
  RISING_STAR = 'Rising Star',
  DANAL_ENTER = 'Danal Enter Music',
  AMUSE_RECORD = 'Amuse Record'
}

export enum EventType {
  FANSIGN_OFFLINE = 'Offline Fansign',
  FANSIGN_CALL = 'Video Call Fansign',
  FANMEETING = 'Fan Meeting',
  SHOWCASE = 'Comeback Showcase',
  LUCKY_DRAW = 'Lucky Draw',
  PHOTO_EVENT = 'Photo Event',
  MD_EVENT = 'MD/Goods Event'
}

export interface KPopEvent {
  id: string;
  artist: string;
  title: string;
  store: StoreName | string;
  eventType: EventType | string;
  applicationPeriod: string; // e.g., "2023.10.20 ~ 2023.10.23"
  eventDate: string; // e.g., "2023.11.01"
  thumbnailUrl: string;
  status: 'Open' | 'Closed' | 'Upcoming';
  link: string;
  linkVerified?: boolean; // true if link is on the store's known domain; false = Google search fallback
}

export interface ScraperStatus {
  isScraping: boolean;
  message: string;
  progress: number;
}