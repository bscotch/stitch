declare const STITCH_VERSION: string;
declare const STITCH_ENVIRONMENT: 'production' | 'development';
declare const SENTRY_DSN: string;
declare module '*.html' {
  const content: string;
  export default content;
}
