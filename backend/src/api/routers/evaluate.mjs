import {evaluate} from '../../engine/index.js';
import {parseRequest} from '../../../../contracts/model.js';
export const evaluateRoute = {method:'POST', path:'/api/evaluate', handle:async body=>evaluate(parseRequest(body).input)};
