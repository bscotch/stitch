export interface BackupsIndex {
  motes: {
    [name: string]: {
      schema: string;
      date: number;
      checksum: string;
    }[];
  };
}
