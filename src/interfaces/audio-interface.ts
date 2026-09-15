import { ReactNode } from 'react';

export interface StyleProps {
  width?: number;
  height?: number;
  lineGap?: number;
  barColor?: string;
  barWidth?: number;
}

type FileState = File | Blob | undefined;
export interface AudioPlayerProps {
  srcfile?: File | Blob | undefined;
  file?: File | Blob | undefined;
  srcUrl?: string;
  downloadOption?: boolean;
  minimal?: boolean;
  loadingComponent?: () => ReactNode;
  style?: StyleProps;
  isTablePlayer?: boolean;
  setFile?: React.Dispatch<React.SetStateAction<FileState>>;
  onChangeTime?: any;
  setIsLoadAudioFile?: (param: boolean) => any;
}

export interface AddGreetingProps {
  drawerState: boolean;
  setDrawerState: (state: boolean) => void;
  greetingType: string;
  /** Undefined by default, in which case CustomSelect falls back to its own
   * default (document.body). Only passed by callers that want this
   * drawer's dropdown menus (Text to Speech's Language/Voice selects) kept
   * inside their own page-scoped styling instead of portaled out to the
   * app root. */
  selectMenuPortalTarget?: any;
}

export interface GreetingForm {
  greeting: string;
  greeting_type: any;
  greetingFile: File | null;
  textToSpeech: string;
  textFile: File | null;
  textToSpeechLocale: any;
  textToSpeechVoice: any;
}

export interface UploadGreetingProps {
  handleTextToSpeech?: () => void;
  isPendingTextToSpeech?: any;
  /** Undefined by default, in which case CustomSelect falls back to its own
   * default (document.body). Only passed by callers that want the
   * Language/Voice dropdown menus kept inside their own page-scoped
   * styling instead of portaled out to the app root. */
  selectMenuPortalTarget?: any;
}
