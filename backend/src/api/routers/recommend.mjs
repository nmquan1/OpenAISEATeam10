import {parseRequest} from '../../../../contracts/model.js';
import {HttpError} from '../http.mjs';
export function recommendationRoute(recommend) {
  let busy = false;
  return {method:'POST',path:'/api/recommend', handle:async body=>{
    const input = parseRequest(body,{context:true});
    if (busy) throw new HttpError(429,'Một request AI đang chạy. Chờ hoàn tất.');
    busy = true;
    try { return await recommend(input); } finally { busy = false; }
  }};
}
