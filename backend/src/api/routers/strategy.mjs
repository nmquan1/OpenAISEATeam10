import {planPortfolio} from '../../engine/portfolio.js';
import {parseStrategyRequest} from '../../../../contracts/model.js';
export const strategyRoute = {method:'POST', path:'/api/strategy', handle:async body=>planPortfolio(parseStrategyRequest(body))};
