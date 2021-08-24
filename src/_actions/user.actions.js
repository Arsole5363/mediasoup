import { userConstants } from '../_constants';
import { userService } from '../_services';
import { alertActions } from './';
import { history } from '../_helpers';

export const userActions = {
    login,
    logout,
    register,
};

function login(userName, roomName) {
    return dispatch => {
        dispatch(request({ userName, roomName }));
    };
    function request(user) { return { type: userConstants.LOGIN_REQUEST, user } }
}

function logout() {
    return { type: userConstants.LOGOUT };
}

function register(user) {
    return dispatch => {
        dispatch(request(user));
    };
    function request(user) { return { type: userConstants.REGISTER_REQUEST, user } }
    // function success(user) { return { type: userConstants.REGISTER_SUCCESS, user } }
    // function failure(error) { return { type: userConstants.REGISTER_FAILURE, error } }
}

