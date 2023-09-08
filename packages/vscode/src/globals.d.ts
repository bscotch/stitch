declare const STITCH_VERSION: string;
declare const STITCH_ENVIRONMENT: 'production' | 'development';
declare module '*.html' {
  const content: string;
  export default content;
}
declare module '*.xml' {
  const content: string;
  export default content;
}
