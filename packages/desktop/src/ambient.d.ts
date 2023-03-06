declare module '@bscotch/stitch-ui' {
  import { type Handler } from 'express';
  const handler: Handler[];
  export { handler };
}

declare module 'electron-squirrel-startup' {
  const isStartup: boolean;
  export default isStartup;
}
