export interface Backup {
  schema: string;
  date: number;
  lastOpened: number;
  checksum: string;
}
export interface BackupsIndex {
  motes: {
    [name: string]: Backup[];
  };
}
