export interface SearchResult<T> {
  item: T;
  refIndex: number;
  score: number;
}

export type AlertKind = 'error' | 'warning' | 'info' | 'success';
export interface AlertPartial {
  id?: string;
  text: string;
  kind: AlertKind;
  icon?: IconId;
  /** Number of seconds before auto-deleting. */
  ttl?: number;
}
export interface Alert extends AlertPartial {
  id: string;
  createdAt: Date;
}

export interface SectionAction {
  icon: IconId;
  label: string;
  onClick: () => void;
}

/** See {@link https://fonts.google.com/icons?query=ubuntu&category=Monospace&icon.query=info&icon.style=Sharp Google Fonts} */
export type IconId =
  | 'add_circle'
  | 'notifications'
  | 'add'
  | 'volume_up'
  | 'link_off'
  | 'done_all'
  | 'publish'
  | 'check_circle'
  | 'check_box'
  | 'check_box_outline_blank'
  | 'chevron_right'
  | 'chevron_left'
  | 'expand_more'
  | 'expand_less'
  | 'cancel'
  | 'close'
  | 'circle'
  | 'code'
  | 'code_blocks'
  | 'content_copy'
  | 'danger'
  | 'skull'
  | 'fire'
  | 'delete'
  | 'download'
  | 'error'
  | 'flag_circle'
  | 'folder'
  | 'folder_open'
  | 'help'
  | 'info'
  | 'keyboard_double_arrow_left'
  | 'keyboard_double_arrow_right'
  | 'link'
  | 'notification_important'
  | 'pending'
  | 'play_arrow'
  | 'play_circle'
  | 'radio_button_checked'
  | 'radio_button_unchecked'
  | 'refresh'
  | 'remove'
  | 'search'
  | 'sync'
  | 'settings'
  | 'share'
  | 'stop_circle'
  | 'update'
  | 'warning';
