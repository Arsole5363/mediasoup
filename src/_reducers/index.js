import { combineReducers } from 'redux';

import { users } from './users.reducer';
import { alert } from './alert.reducer';
import { authentication } from './authentication.reducer';
import { conference } from './conference.reducer';

const rootReducer = combineReducers({
  users,
  alert,
  authentication,
  conference
});

export default rootReducer;