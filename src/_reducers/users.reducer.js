import { userConstants } from '../_constants';

export function users(state = {loggingIn: false}, action) {
  switch (action.type) {
    
    case userConstants.LOGIN_REQUEST:
      return {
        loggingIn: true,
        user: action.user
      };
   
    default:
      return state
  }
}