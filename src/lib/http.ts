import http from 'http';
import https from 'https';
import Url from 'url';
import { StitchError } from './errors';

interface GetResponse {
  contentType:string,
  data:any
}

export async function get(url:string):Promise<GetResponse>{
  const {protocol} = Url.parse(url);
  const httpType = protocol?.match(/^(https?):$/)?.[1] as 'http'|'https'|null;
  if( !httpType ){
    throw new StitchError('URL must include protocol (http(s))');
  }
  return new Promise((resolve,reject)=>{
    const getter = {http,https}[httpType];
    getter.get(url,res=>{
      const chunks: Buffer[] = [];
      res.on('data',chunk=>{
        chunks.push(chunk);
      });
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        const contentType = res.headers['content-type'];
        const response: GetResponse = {
          contentType: contentType||'application/octet-stream',
          data
        };
        if(contentType?.startsWith('text')){
          response.data = data.toString('utf8');
          return resolve(response);
        }
        else if(contentType?.startsWith('application/json')){
          try{
            response.data = JSON.parse(data.toString('utf8'));
            return resolve(response);
          }
          catch{
            throw new StitchError(
              `Response from ${url} was invalid JSON: ${data.toString('utf8')}`
            );
          }
        }
        return resolve(response);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}
